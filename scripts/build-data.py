"""Build the game's map data from OpenStreetMap (Overpass API) and CBS province outlines.

Usage:  python scripts/build-data.py            (uses cached downloads in data-raw/ when present)
        python scripts/build-data.py --refresh  (re-downloads everything)

Outputs public/data/roads.json, land.json and junctions.json (fetched by the app at runtime).
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
    overpass("knooppunten_geo.json", f'[out:json][timeout:180];{area}(node["highway"="motorway_junction"]["name"~"^Knooppunt ",i](area.a);node["junction"="yes"]["name"~"^Knooppunt ",i](area.a);node["highway"="motorway_junction"]["name"~"^(Heerenveen)$"](area.a););out;')
    gem = os.path.join(RAW, "gemeenten.json")
    if REFRESH or not os.path.exists(gem) or os.path.getsize(gem) < 10_000_000:
        print("downloading CBS municipality polygons (about 100 MB)")
        subprocess.run(["curl", "-sL", "-A", UA, "-o", gem, "https://service.pdok.nl/cbs/wijkenbuurten/2023/wfs/v1_0?request=GetFeature&service=WFS&version=2.0.0&typeName=wijkenbuurten:gemeenten&outputFormat=json&srsName=EPSG:4326&count=2000"])

def dp(pts, tol):
    """Douglas-Peucker line simplification."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
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
    return [p for p, k in zip(pts, keep) if k]

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
    out = []; total = 0
    for ref, ways in roads.items():
        k = kind(ref); lines = [dp(l, 2.5 if k == "A" else 4) for l in chain(ways)]
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
    json.dump(out, open(os.path.join(OUT, "roads.json"), "w"), separators=(",", ":"))
    print("roads:", len(out), "points:", total, dict(collections.Counter(r["kind"] for r in out)))
    return out

def build_land():
    """Dissolve the CBS land-only municipality polygons into one detailed land shape (rivers and lakes stay open)."""
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union, transform
    d = json.load(open(os.path.join(RAW, "gemeenten.json"), encoding="utf-8"))
    geoms = [transform(lambda lon, lat, z=None: proj(lon, lat), shape(f["geometry"])) for f in d["features"] if f["properties"].get("water") == "NEE"]
    land = unary_union(geoms).buffer(0)
    land = land.simplify(3, preserve_topology=True)
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

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
    if L2 == 0: return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

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
    roads = build_roads(); build_land(); build_junctions(roads)
