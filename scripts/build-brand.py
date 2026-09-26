"""Derive every brand asset from branding/logo.png (wide, transparent):
public/logo.png (trimmed), icon-*.png and favicon.ico (square crop of the HG mark), og.jpg (share card with the map).

Usage: python scripts/build-brand.py   (needs Pillow; run after build-data.py)
"""
import json, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
DATA = os.path.join(PUB, "data")
LIGHT_BG = (10, 22, 40)  # navy, matches the app background
NAVY = (9, 27, 44)
ORANGE = (239, 113, 47)
LAND, EDGE, ABROAD = (27, 74, 141), (47, 111, 208), (21, 36, 58)

logo = Image.open(os.path.join(ROOT, "branding", "logo.png")).convert("RGBA")
logo = logo.crop(logo.getbbox())
w, h = logo.size
logo.resize((1200, round(1200 * h / w)), Image.LANCZOS).save(os.path.join(PUB, "logo.png"))
print("logo", logo.size)

# Square app icon: the HG mark with the sign, on the light background.
mark = logo.crop((round(w * 0.495), 0, w, round(h * 0.78)))
mark = mark.crop(mark.getbbox())
side = max(mark.size) + 40
sq = Image.new("RGBA", (side, side), LIGHT_BG + (255,))
glow = Image.new("RGBA", (side, side), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((side * 0.08, side * 0.12, side * 0.92, side * 0.88), fill=(90, 150, 255, 120))
glow = glow.filter(ImageFilter.GaussianBlur(side * 0.12))
sq.alpha_composite(glow)
sq.paste(mark, ((side - mark.size[0]) // 2, (side - mark.size[1]) // 2), mark)
for s in (512, 192, 64, 32):
    sq.resize((s, s), Image.LANCZOS).save(os.path.join(PUB, f"icon-{s}.png"))
sq.resize((64, 64), Image.LANCZOS).save(os.path.join(PUB, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# Share card: logo on the left, the road network on the right, light theme.
W, H = 1200, 630
def decode(line):
    out = [line[0], line[1]]
    for i in range(2, len(line), 2):
        out.append(out[-2] + line[i]); out.append(out[-2] + line[i + 1])
    return out
land = json.load(open(os.path.join(DATA, "land.json"), encoding="utf-8"))
abroad = json.load(open(os.path.join(DATA, "abroad.json"), encoding="utf-8")) if os.path.exists(os.path.join(DATA, "abroad.json")) else []
roads = json.load(open(os.path.join(DATA, "roads-core.json"), encoding="utf-8"))
xs = [c for p in land for r in p["rings"] for c in r[0::2]]; ys = [c for p in land for r in p["rings"] for c in r[1::2]]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
mx, my, mw, mh = 560, 20, 620, 590
scale = min(mw / (x1 - x0), mh / (y1 - y0))
ox = mx + (mw - (x1 - x0) * scale) / 2; oy = my + (mh - (y1 - y0) * scale) / 2
S = 2
img = Image.new("RGB", (W * S, H * S), LIGHT_BG)
d = ImageDraw.Draw(img)
P = lambda x, y: ((ox + (x - x0) * scale) * S, (oy + (y - y0) * scale) * S)
for poly in abroad:
    d.polygon([P(poly["rings"][0][i], poly["rings"][0][i + 1]) for i in range(0, len(poly["rings"][0]), 2)], fill=ABROAD)
for poly in land:
    rings = poly["rings"]
    d.polygon([P(rings[0][i], rings[0][i + 1]) for i in range(0, len(rings[0]), 2)], fill=LAND, outline=EDGE)
    for hole in rings[1:]:
        d.polygon([P(hole[i], hole[i + 1]) for i in range(0, len(hole), 2)], fill=LIGHT_BG)
for kind, col, wdt in (("N", (255, 210, 63), 2), ("A", (246, 248, 252), 4)):
    for r in roads:
        if r["kind"] != kind: continue
        for line in r["lines"]:
            pts = decode(line)
            d.line([P(pts[i], pts[i + 1]) for i in range(0, len(pts), 2)], fill=col, width=wdt * S, joint="curve")
img = img.resize((W, H), Image.LANCZOS)
lw = 500
lg = logo.resize((lw, round(lw * h / w)), Image.LANCZOS)
halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(halo).ellipse((10, H // 2 - 190, 560, H // 2 + 190), fill=(90, 150, 255, 110))
halo = halo.filter(ImageFilter.GaussianBlur(60))
img = img.convert("RGBA")
img.alpha_composite(halo)
img.paste(lg, (30, (H - lg.size[1]) // 2), lg)
img = img.convert("RGB")
img.save(os.path.join(PUB, "og.jpg"), quality=88)
print("wrote icons, favicon and og.jpg")
