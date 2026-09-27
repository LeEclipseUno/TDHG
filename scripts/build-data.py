"""Build the game's map data from OpenStreetMap (Overpass API) and CBS province outlines.

Usage:  python scripts/build-data.py            (uses cached downloads in data-raw/ when present)
        python scripts/build-data.py --refresh  (re-downloads everything)

Outputs public/data/roads-core.json (A and national N), roads-extra.json (provincial), links.json, structures.json (bridges, tunnels),
land.json, abroad.json, junctions.json, exits.json and places.json.
Polylines are delta encoded: [x0, y0, dx1, dy1, dx2, dy2, ...] in whole metres.
Coordinates are projected to a local metre grid (x east, y south) so the app never needs a projection library.
Data (c) OpenStreetMap contributors, ODbL. Land outline: CBS Wijk- en Buurtkaart via PDOK (CC BY 4.0).
Requires: python 3, curl on the PATH, and the shapely package (pip install shapely).
"""
import json, os, sys, math, re, glob, time, subprocess, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data-raw"); OUT = os.path.join(ROOT, "public", "data")
os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
REFRESH = "--refresh" in sys.argv
UA = "the-dutch-highway-guesser data build (github.com)"
OVERPASS = "https://overpass-api.de/api/interpreter"

LON0, LAT0 = 3.2, 53.7
KX = 111320 * math.cos(math.radians(52.2)); KY = 111320
def proj(lon, lat): return ((lon - LON0) * KX, (LAT0 - lat) * KY)

def overpass(name, query):
    path = os.path.join(RAW, name)
    if not REFRESH and os.path.exists(path) and os.path.getsize(path) > 1000:
        return json.load(open(path, encoding="utf-8"))
    qfile = os.path.join(RAW, "_query.txt"); open(qfile, "w").write(query)
    for _ in range(6):
        subprocess.run(["curl", "-s", "-A", UA, "-H", "Accept: */*", "-o", path, "--data-urlencode", f"data@{qfile}", OVERPASS])
        try:
            d = json.load(open(path, encoding="utf-8")); print(name, "downloaded", len(d["elements"]), "elements"); return d
        except Exception:
            print(name, "retrying in 20s"); time.sleep(20)
    raise SystemExit("Overpass keeps failing for " + name)

def download_all():
    area = 'area["ISO3166-1"="NL"]["admin_level"="2"]->.a;'
    batches = {"A": '^A[0-9]+$', "N0": '^N[0-9]{1,2}$'}
    for i in range(1, 10):
        batches[f"N{i}"] = f'^N{i}[0-9]{{2}}$'
    for name, rx in batches.items():
        overpass(f"geom_{name}.json", f'[out:json][timeout:300];{area}relation["type"="route"]["route"="road"]["ref"~"{rx}"]["network"~"^NL:[AN]$"](area.a);out geom;')
    overpass("links.json", f'[out:json][timeout:300];{area}way["highway"~"^(motorway_link|trunk_link)$"](area.a);out geom;')
    overpass("structures.json", f'[out:json][timeout:300];{area}(way["highway"~"^(motorway|trunk|motorway_link|trunk_link)$"]["bridge"](area.a);way["highway"~"^(motorway|trunk|motorway_link|trunk_link)$"]["tunnel"](area.a););out geom;')
    overpass("minor_secondary.json", f'[out:json][timeout:600];{area}way["highway"~"^(secondary|secondary_link)$"](area.a);out geom;')
    overpass("minor_tertiary.json", f'[out:json][timeout:600];{area}way["highway"~"^(tertiary|tertiary_link)$"](area.a);out geom;')
    overpass("water.json", f'[out:json][timeout:600];{area}(way["waterway"="river"](area.a);way["waterway"="canal"]["CEMT"](area.a););out geom;')
    overpass("provinces.json", f'[out:json][timeout:600];{area}relation["boundary"="administrative"]["admin_level"="4"](area.a);out geom;')
    overpass("abroad.json", '[out:json][timeout:300];(relation(52411);relation(62761);relation(62771););out geom;')  # Belgium, NRW, Lower Saxony
    overpass("exits_places.json", f'[out:json][timeout:300];{area}(node["highway"="motorway_junction"]["ref"](area.a);node["place"~"^(city|town)$"](area.a););out;')
    ne = os.path.join(RAW, "ne_land.geojson")
    if REFRESH or not os.path.exists(ne):
        subprocess.run(["curl", "-sL", "-A", UA, "-o", ne, "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson"])
    overpass("knooppunten_geo.json", f'[out:json][timeout:180];{area}(node["highway"="motorway_junction"]["name"~"^Knooppunt ",i](area.a);node["junction"="yes"]["name"~"^Knooppunt ",i](area.a);node["highway"="motorway_junction"]["name"~"^(Heerenveen)$"](area.a););out;')
    gem = os.path.join(RAW, "gemeenten.json")
    if REFRESH or not os.path.exists(gem) or os.path.getsize(gem) < 10_000_000:
        print("downloading CBS municipality polygons (about 100 MB)")
        subprocess.run(["curl", "-sL", "-A", UA, "-o", gem, "https://service.pdok.nl/cbs/wijkenbuurten/2023/wfs/v1_0?request=GetFeature&service=WFS&version=2.0.0&typeName=wijkenbuurten:gemeenten&outputFormat=json&srsName=EPSG:4326&count=2000"])

def dp(pts, tol, must_keep=None):
    """Douglas-Peucker line simplification. Points in must_keep (rounded coordinate tuples) are never dropped."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    if must_keep:
        for i, p in enumerate(pts):
            if (round(p[0], 1), round(p[1], 1)) in must_keep: keep[i] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]; dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
        best = -1; bi = -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L2 == 0: d = math.hypot(px - ax, py - ay)
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2)); d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > best: best = d; bi = i
        if best > tol: keep[bi] = True; stack.append((a, bi)); stack.append((bi, b))
    # Forced points split the recursion so the tolerance is honoured on both sides of them.
    if must_keep:
        forced = [i for i in range(1, len(pts) - 1) if keep[i] and (round(pts[i][0], 1), round(pts[i][1], 1)) in must_keep]
        bounds = [0, *forced, len(pts) - 1]
        for a, b in zip(bounds, bounds[1:]):
            if b - a < 2: continue
            sub = dp(pts[a:b + 1], tol)
            subset = {(round(q[0], 1), round(q[1], 1)) for q in sub}
            for i in range(a + 1, b):
                if (round(pts[i][0], 1), round(pts[i][1], 1)) in subset: keep[i] = True
    return [p for p, k in zip(pts, keep) if k]

SHARED = set()   # coordinates where two different ways meet: kept through simplification so the road graph stays connected

def collect_shared(way_lists):
    counts = collections.Counter()
    for ways in way_lists:
        for w in ways:
            for p in {(round(x, 1), round(y, 1)) for x, y in w}:
                counts[p] += 1
    SHARED.update(p for p, c in counts.items() if c >= 2)

def chain(ways):
    """Join way geometries that share an endpoint into longer polylines."""
    ways = [w for w in ways if len(w) >= 2]
    key = lambda p: (round(p[0], 1), round(p[1], 1))
    used = [False] * len(ways); ends = collections.defaultdict(list)
    for i, w in enumerate(ways): ends[key(w[0])].append(i); ends[key(w[-1])].append(i)
    out = []
    for i in range(len(ways)):
        if used[i]: continue
        used[i] = True; line = list(ways[i])
        for direction in (1, -1):
            while True:
                end = key(line[-1]) if direction == 1 else key(line[0])
                cands = [j for j in ends[end] if not used[j]]
                if len(cands) != 1: break
                w = ways[cands[0]]
                seg = w if key(w[0]) == end else (w[::-1] if key(w[-1]) == end else None)
                if seg is None: break
                used[cands[0]] = True
                line = line + seg[1:] if direction == 1 else list(reversed(seg))[:-1] + line
        out.append(line)
    return out

def encode(line):
    """Delta encode a flat [x, y, x, y, ...] list of integer metres."""
    out = [line[0], line[1]]
    for i in range(2, len(line), 2):
        out.append(line[i] - line[i - 2]); out.append(line[i + 1] - line[i - 1])
    return out

def kind(ref):
    if ref[0] == "A": return "A"
    return "N" if len(ref) <= 3 else "P"   # N = national N-road (1-2 digits), P = provincial (3 digits)

def build_roads():
    roads = collections.defaultdict(list)
    for f in sorted(glob.glob(os.path.join(RAW, "geom_*.json"))):
        for e in json.load(open(f, encoding="utf-8"))["elements"]:
            for m in e.get("members", []):
                if m["type"] == "way" and "geometry" in m:
                    roads[e["tags"]["ref"]].append([proj(p["lon"], p["lat"]) for p in m["geometry"]])
    links = json.load(open(os.path.join(RAW, "links.json"), encoding="utf-8"))["elements"]
    link_ways = [[proj(p["lon"], p["lat"]) for p in e["geometry"]] for e in links if "geometry" in e]
    collect_shared([w for w in roads.values()] + [link_ways])
    out = []; total = 0
    for ref, ways in roads.items():
        k = kind(ref); lines = [dp(l, 1, SHARED) for l in chain(ways)]
        lines = [[(round(x), round(y)) for x, y in l] for l in lines]
        total += sum(len(l) for l in lines)
        length = sum(math.hypot(l[i + 1][0] - l[i][0], l[i + 1][1] - l[i][1]) for l in lines for i in range(len(l) - 1))
        if k == "A": length /= 2   # two carriageways mapped separately
        xs = [p[0] for l in lines for p in l]; ys = [p[1] for l in lines for p in l]
        longest = max(lines, key=len); mid = longest[len(longest) // 2]
        out.append({"ref": ref, "kind": k, "num": int(ref[1:]), "km": round(length / 1000),
                    "bbox": [min(xs), min(ys), max(xs), max(ys)], "anchor": list(mid),
                    "lines": [[c for p in l for c in p] for l in lines]})
    out.sort(key=lambda r: (r["kind"], r["num"]))
    packed = [dict(r, lines=[encode(l) for l in r["lines"]]) for r in out]
    # Core (A and national N) paints first; the provincial roads follow in the background.
    json.dump([r for r in packed if r["kind"] != "P"], open(os.path.join(OUT, "roads-core.json"), "w"), separators=(",", ":"))
    json.dump([r for r in packed if r["kind"] == "P"], open(os.path.join(OUT, "roads-extra.json"), "w"), separators=(",", ":"))
    old = os.path.join(OUT, "roads.json")
    if os.path.exists(old): os.remove(old)
    print("roads:", len(out), "points:", total, dict(collections.Counter(r["kind"] for r in out)))
    return out

def build_links():
    """Ramps and connector roads of interchanges: motorway_link (drawn like A), trunk_link (drawn like N),
    except trunk_link ramps that only touch a provincial road, which are drawn like that road (P)."""
    d = json.load(open(os.path.join(RAW, "links.json"), encoding="utf-8"))["elements"]
    key = lambda p: (round(p[0], 1), round(p[1], 1))
    main_pts, prov_pts = set(), set()
    for f in sorted(glob.glob(os.path.join(RAW, "geom_*.json"))):
        for e in json.load(open(f, encoding="utf-8"))["elements"]:
            target = prov_pts if kind(e["tags"]["ref"]) == "P" else main_pts
            for m in e.get("members", []):
                if m["type"] == "way" and "geometry" in m:
                    target.update(key(proj(p["lon"], p["lat"])) for p in m["geometry"])
    groups = {"A": [], "N": [], "P": []}
    for e in d:
        if "geometry" not in e: continue
        pts = [proj(p["lon"], p["lat"]) for p in e["geometry"]]
        if e["tags"].get("highway") == "motorway_link": k = "A"
        else:
            # Ramps that touch an A or N road belong to it; everything else is a provincial ramp.
            k = "N" if any(key(p) in main_pts for p in pts) else "P"
        groups[k].append(pts)
    out = []; pts = 0
    for k, ways in groups.items():
        for line in chain(ways):
            line = [(round(x), round(y)) for x, y in dp(line, 1, SHARED)]
            if len(line) < 2: continue
            xs = [p[0] for p in line]; ys = [p[1] for p in line]; pts += len(line)
            out.append({"k": k, "b": [min(xs), min(ys), max(xs), max(ys)], "l": encode([c for p in line for c in p])})
    json.dump(out, open(os.path.join(OUT, "links.json"), "w"), separators=(",", ":"))
    print("links:", len(out), "points:", pts)

def build_structures():
    """Bridge and tunnel segments of the main roads, drawn with rails or a dashed casing at deep zoom."""
    d = json.load(open(os.path.join(RAW, "structures.json"), encoding="utf-8"))["elements"]
    out = []; pts = 0
    for e in d:
        if "geometry" not in e or len(e["geometry"]) < 2: continue
        t = e["tags"]
        kind = "t" if t.get("tunnel") and t.get("tunnel") != "no" else "b"
        if kind == "b" and t.get("bridge") == "no": continue
        line = [(round(x), round(y)) for x, y in dp([proj(p["lon"], p["lat"]) for p in e["geometry"]], 1)]
        length = sum(math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]) for i in range(len(line) - 1))
        if length < 25: continue   # tiny culvert crossings are noise
        xs = [p[0] for p in line]; ys = [p[1] for p in line]; pts += len(line)
        out.append({"t": kind, "b": [min(xs), min(ys), max(xs), max(ys)], "l": encode([c for p in line for c in p])})
    json.dump(out, open(os.path.join(OUT, "structures.json"), "w"), separators=(",", ":"))
    print("structures:", len(out), "points:", pts, dict(collections.Counter(o["t"] for o in out)))

def build_minor():
    """Local roads (secondary and tertiary) as map context only: not named, not playable."""
    out = []; pts = 0
    for cls, fname in (("s", "minor_secondary.json"), ("t", "minor_tertiary.json")):
        d = json.load(open(os.path.join(RAW, fname), encoding="utf-8"))["elements"]
        ways = [[proj(p["lon"], p["lat"]) for p in e["geometry"]] for e in d if "geometry" in e]
        for line in chain(ways):
            line = [(round(x), round(y)) for x, y in dp(line, 3)]
            if len(line) < 2: continue
            xs = [p[0] for p in line]; ys = [p[1] for p in line]; pts += len(line)
            out.append({"c": cls, "b": [min(xs), min(ys), max(xs), max(ys)], "l": encode([c for p in line for c in p])})
    json.dump(out, open(os.path.join(OUT, "minor.json"), "w"), separators=(",", ":"))
    print("minor roads:", len(out), "points:", pts, dict(collections.Counter(o["c"] for o in out)))

def build_water():
    """Rivers and the main shipping canals (CEMT class III and up), drawn as water lines."""
    d = json.load(open(os.path.join(RAW, "water.json"), encoding="utf-8"))["elements"]
    big = {"III", "IV", "Va", "Vb", "VIa", "VIb", "VIc", "VII"}
    groups = {"r": [], "c": []}
    for e in d:
        if "geometry" not in e: continue
        t = e["tags"]
        if t.get("waterway") == "canal":
            if t.get("CEMT", "").strip() not in big: continue
            groups["c"].append([proj(p["lon"], p["lat"]) for p in e["geometry"]])
        else:
            groups["r"].append([proj(p["lon"], p["lat"]) for p in e["geometry"]])
    out = []; pts = 0
    for cls, ways in groups.items():
        for line in chain(ways):
            line = [(round(x), round(y)) for x, y in dp(line, 5)]
            if len(line) < 2: continue
            xs = [p[0] for p in line]; ys = [p[1] for p in line]; pts += len(line)
            out.append({"c": cls, "b": [min(xs), min(ys), max(xs), max(ys)], "l": encode([c for p in line for c in p])})
    json.dump(out, open(os.path.join(OUT, "water.json"), "w"), separators=(",", ":"))
    print("water lines:", len(out), "points:", pts, dict(collections.Counter(o["c"] for o in out)))

def build_land():
    """Dissolve the CBS land-only municipality polygons into one detailed land shape (rivers and lakes stay open)."""
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union, transform
    d = json.load(open(os.path.join(RAW, "gemeenten.json"), encoding="utf-8"))
    geoms = [transform(lambda lon, lat, z=None: proj(lon, lat), shape(f["geometry"])) for f in d["features"] if f["properties"].get("water") == "NEE"]
    land = unary_union(geoms).buffer(0)
    land = land.simplify(20, preserve_topology=True)
    polys = list(land.geoms) if land.geom_type == "MultiPolygon" else [land]
    out = []; pts = 0
    for poly in polys:
        if poly.area < 20000: continue   # drop slivers smaller than about 2 hectares
        rings = []
        for ring in [poly.exterior, *poly.interiors]:
            flat = []
            for x, y in ring.coords:
                flat.append(round(x)); flat.append(round(y))
            rings.append(flat); pts += len(flat) // 2
        out.append({"name": "", "rings": rings})
    json.dump(out, open(os.path.join(OUT, "land.json"), "w"), separators=(",", ":"))
    print("land polygons:", len(out), "points:", pts)

def build_abroad():
    """Neighbouring land (Belgium, NRW, Lower Saxony) clipped to a band around the country, drawn muted under the map."""
    from shapely.geometry import shape, LineString, box, MultiPolygon
    from shapely.ops import unary_union, polygonize, transform
    d = json.load(open(os.path.join(RAW, "abroad.json"), encoding="utf-8"))["elements"]
    lines = []
    for rel in d:
        for m in rel.get("members", []):
            if m["type"] == "way" and m.get("role") in ("outer", "") and "geometry" in m:
                pts = [proj(p["lon"], p["lat"]) for p in m["geometry"]]
                if len(pts) >= 2: lines.append(LineString(pts))
    polys = list(polygonize(unary_union(lines)))
    region = unary_union(polys)
    land_mask = unary_union([transform(lambda lon, lat, z=None: proj(lon, lat), shape(f["geometry"])) for f in json.load(open(os.path.join(RAW, "ne_land.geojson"), encoding="utf-8"))["features"]
                             if shape(f["geometry"]).intersects(box(0, 48, 12, 56))])
    nl = json.load(open(os.path.join(OUT, "land.json"), encoding="utf-8"))
    xs = [c for p in nl for r in p["rings"] for c in r[0::2]]; ys = [c for p in nl for r in p["rings"] for c in r[1::2]]
    band = box(min(xs) - 140000, min(ys) - 140000, max(xs) + 140000, max(ys) + 140000)
    abroad = region.intersection(land_mask).intersection(band).simplify(40, preserve_topology=True)
    geoms = list(abroad.geoms) if isinstance(abroad, MultiPolygon) else [abroad]
    out = []; pts = 0
    for poly in geoms:
        if poly.is_empty or poly.area < 2e6: continue
        rings = []
        for ring in [poly.exterior, *poly.interiors]:
            flat = []
            for x, y in ring.coords:
                flat.append(round(x)); flat.append(round(y))
            rings.append(flat); pts += len(flat) // 2
        out.append({"name": "", "rings": rings})
    json.dump(out, open(os.path.join(OUT, "abroad.json"), "w"), separators=(",", ":"))
    print("abroad polygons:", len(out), "points:", pts)

def build_exits_places(roads):
    """Numbered motorway exits (clustered per number and name, attached to the nearest A or N road) and the city/town gazetteer."""
    d = json.load(open(os.path.join(RAW, "exits_places.json"), encoding="utf-8"))["elements"]
    big = [r for r in roads if r["kind"] in ("A", "N")]
    by = collections.defaultdict(list)
    places = []
    for e in d:
        t = e["tags"]
        if t.get("place"):
            places.append({"n": t.get("name", ""), "x": round(proj(e["lon"], e["lat"])[0]), "y": round(proj(e["lon"], e["lat"])[1]), "c": 1 if t["place"] == "city" else 0})
            continue
        if not t.get("name"): continue
        by[(t["ref"].strip(), t["name"].strip())].append(proj(e["lon"], e["lat"]))
    exits = []
    for (ref, name), pts in by.items():
        x = sum(p[0] for p in pts) / len(pts); y = sum(p[1] for p in pts) / len(pts)
        best = None; bestd = 400
        for r in big:
            bx0, by0, bx1, by1 = r["bbox"]
            if x < bx0 - 400 or x > bx1 + 400 or y < by0 - 400 or y > by1 + 400: continue
            for l in r["lines"]:
                for i in range(0, len(l) - 2, 2):
                    dd = seg_dist(x, y, l[i], l[i + 1], l[i + 2], l[i + 3])
                    if dd < bestd: bestd = dd; best = r["ref"]
        if best and ref.replace("-", "").isalnum():
            exits.append({"n": name, "r": ref, "road": best, "x": round(x), "y": round(y)})
    exits.sort(key=lambda e: (e["road"][0], int(e["road"][1:]), e["n"]))
    places = [p for p in places if p["n"]]
    places.sort(key=lambda p: (-p["c"], p["n"]))
    json.dump(exits, open(os.path.join(OUT, "exits.json"), "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    json.dump(places, open(os.path.join(OUT, "places.json"), "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print("exits:", len(exits), "places:", len(places))

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
    if L2 == 0: return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

PROV_CODES = {"Groningen": "GR", "Fryslân": "FR", "Friesland": "FR", "Drenthe": "DR", "Overijssel": "OV", "Flevoland": "FL", "Gelderland": "GE",
              "Utrecht": "UT", "Noord-Holland": "NH", "Zuid-Holland": "ZH", "Zeeland": "ZE", "Noord-Brabant": "NB", "Limburg": "LI"}

def build_provinces():
    """Province polygons (for tagging) and their land borders as dashed lines. Returns {code: prepared polygon}."""
    from shapely.geometry import shape, LineString, MultiPolygon
    from shapely.ops import unary_union, polygonize
    from shapely.prepared import prep
    d = json.load(open(os.path.join(RAW, "provinces.json"), encoding="utf-8"))["elements"]
    provs = {}
    for rel in d:
        name = rel["tags"].get("name:nl") or rel["tags"].get("name", "")
        code = PROV_CODES.get(name)
        if not code: continue
        lines = [LineString([proj(p["lon"], p["lat"]) for p in m["geometry"]]) for m in rel.get("members", []) if m["type"] == "way" and m.get("role") in ("outer", "") and "geometry" in m and len(m["geometry"]) >= 2]
        polys = list(polygonize(unary_union(lines)))
        if not polys: continue
        provs[code] = unary_union(polys)
    nl = json.load(open(os.path.join(OUT, "land.json"), encoding="utf-8"))
    from shapely import make_valid
    land = make_valid(unary_union([make_valid(shape({"type": "Polygon", "coordinates": [[(r[i], r[i + 1]) for i in range(0, len(r), 2)] for r in poly["rings"]]})) for poly in nl]))
    inland = make_valid(land.buffer(-300))
    provs = {code: make_valid(g) for code, g in provs.items()}
    borders = make_valid(unary_union([make_valid(g.boundary) for g in provs.values()])).intersection(inland).simplify(25, preserve_topology=True)
    from shapely.ops import linemerge
    def flatten(g):
        if hasattr(g, "geoms"):
            for x in g.geoms: yield from flatten(x)
        else: yield g
    pieces = [g for g in flatten(borders) if g.geom_type == "LineString"]
    merged = list(flatten(linemerge(pieces))) if pieces else []
    out = []; pts = 0
    for g in merged:
        if g.geom_type != "LineString" or g.length < 2000: continue
        line = [(round(x), round(y)) for x, y in g.coords]
        xs = [p[0] for p in line]; ys = [p[1] for p in line]; pts += len(line)
        out.append({"b": [min(xs), min(ys), max(xs), max(ys)], "l": encode([c for p in line for c in p])})
    json.dump({"codes": sorted(provs.keys()), "borders": out}, open(os.path.join(OUT, "provinces.json"), "w"), separators=(",", ":"))
    print("provinces:", len(provs), "border lines:", len(out), "points:", pts)
    return {code: prep(g) for code, g in provs.items()}

def tag_provinces(prepared):
    """Add a province code list to roads, junctions and exits (sampled along each road)."""
    from shapely.geometry import Point
    def codes_for(points):
        found = set()
        for x, y in points:
            pt = Point(x, y)
            for code, g in prepared.items():
                if g.contains(pt): found.add(code); break
        return sorted(found)
    for fname in ("roads-core.json", "roads-extra.json"):
        path = os.path.join(OUT, fname)
        roads = json.load(open(path, encoding="utf-8"))
        for r in roads:
            pts = []
            for line in r["lines"]:
                # decode delta line and sample every ~15th point
                x, y = line[0], line[1]; pts.append((x, y)); n = 0
                for i in range(2, len(line), 2):
                    x += line[i]; y += line[i + 1]; n += 1
                    if n % 15 == 0: pts.append((x, y))
                pts.append((x, y))
            r["p"] = codes_for(pts)
        json.dump(roads, open(path, "w"), separators=(",", ":"))
    for fname, key in (("junctions.json", None), ("exits.json", None)):
        path = os.path.join(OUT, fname)
        items = json.load(open(path, encoding="utf-8"))
        for it in items: it["p"] = codes_for([(it["x"], it["y"])])
        json.dump(items, open(path, "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print("province tags added")

def build_junctions(roads):
    d = json.load(open(os.path.join(RAW, "knooppunten_geo.json"), encoding="utf-8"))["elements"]
    by = collections.defaultdict(list)
    for e in d:
        n = e["tags"]["name"]
        if re.match(r"^knooppunt\s*[\d-]", n, re.I): continue          # cycling network nodes
        plain = re.sub(r"^knooppunt\s+", "", n, flags=re.I)
        if plain.lower() in ("intermedia", "wetering"): continue        # not motorway interchanges
        if plain == n and e["tags"].get("ref"): continue               # plain-named node with an exit number is an exit
        by[plain].append((e["lat"], e["lon"]))
    for half in ("Ridderkerk-Noord", "Ridderkerk-Zuid"):               # halves of one interchange
        if half in by: by["Ridderkerk"].extend(by.pop(half))
    big = roads
    out = []
    for name, pts in by.items():
        lat = sum(p[0] for p in pts) / len(pts); lon = sum(p[1] for p in pts) / len(pts)
        x, y = proj(lon, lat)
        near = []
        for r in big:
            bx0, by0, bx1, by1 = r["bbox"]
            if x < bx0 - 900 or x > bx1 + 900 or y < by0 - 900 or y > by1 + 900: continue
            best = 1e9
            for l in r["lines"]:
                for i in range(0, len(l) - 2, 2):
                    best = min(best, seg_dist(x, y, l[i], l[i + 1], l[i + 2], l[i + 3]))
                    if best < 900: break
                if best < 900: break
            if best < 900: near.append(r["ref"])
        near.sort(key=lambda s: (s[0] != "A", int(s[1:])))
        out.append({"name": name, "x": round(x), "y": round(y), "roads": near})
    out.sort(key=lambda j: j["name"])
    json.dump(out, open(os.path.join(OUT, "junctions.json"), "w", encoding="utf-8"), separators=(",", ":"), ensure_ascii=False)
    print("junctions:", len(out))
    for j in out:
        if len(j["roads"]) < 2: print("  WARN few roads at", j["name"], j["roads"])
    return out

if __name__ == "__main__":
    download_all()
    roads = build_roads(); build_links(); build_structures(); build_minor(); build_water(); build_land(); build_abroad(); build_junctions(roads); build_exits_places(roads)
    tag_provinces(build_provinces())
