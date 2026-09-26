"""Render the Open Graph share image (public/og.jpg): the logo next to the real road network.

Usage: python scripts/build-og.py   (needs Pillow; run after build-data.py)
"""
import json, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")
W, H = 1200, 630
BG, LAND, EDGE, A_COL, N_COL = (10, 22, 40), (27, 74, 141), (47, 111, 208), (246, 248, 252), (255, 210, 63)

def decode(line):
    out = [line[0], line[1]]
    for i in range(2, len(line), 2):
        out.append(out[-2] + line[i]); out.append(out[-2] + line[i + 1])
    return out

land = json.load(open(os.path.join(DATA, "land.json"), encoding="utf-8"))
roads = json.load(open(os.path.join(DATA, "roads.json"), encoding="utf-8"))
xs = [c for p in land for r in p["rings"] for c in r[0::2]]; ys = [c for p in land for r in p["rings"] for c in r[1::2]]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
# Map on the right 58% of the card, logo on the left.
mx, my, mw, mh = 470, 20, 710, 590
scale = min(mw / (x1 - x0), mh / (y1 - y0))
ox = mx + (mw - (x1 - x0) * scale) / 2; oy = my + (mh - (y1 - y0) * scale) / 2
S = 2  # supersample for smoother lines
img = Image.new("RGB", (W * S, H * S), BG)
d = ImageDraw.Draw(img)
P = lambda x, y: ((ox + (x - x0) * scale) * S, (oy + (y - y0) * scale) * S)
for poly in land:
    rings = poly["rings"]
    d.polygon([P(rings[0][i], rings[0][i + 1]) for i in range(0, len(rings[0]), 2)], fill=LAND, outline=EDGE)
    for hole in rings[1:]:
        d.polygon([P(hole[i], hole[i + 1]) for i in range(0, len(hole), 2)], fill=BG)
for kind, col, wdt in (("N", N_COL, 2), ("A", A_COL, 4)):
    for r in roads:
        if r["kind"] != kind: continue
        for line in r["lines"]:
            pts = decode(line)
            d.line([P(pts[i], pts[i + 1]) for i in range(0, len(pts), 2)], fill=col, width=wdt * S, joint="curve")
img = img.resize((W, H), Image.LANCZOS)
logo = Image.open(os.path.join(ROOT, "branding", "logo-transparent.png")).convert("RGBA").resize((440, 440), Image.LANCZOS)
img.paste(logo, (20, 95), logo)
img.save(os.path.join(ROOT, "public", "og.jpg"), quality=88)
icon = Image.open(os.path.join(ROOT, "public", "icon-64.png")).convert("RGBA")
icon.save(os.path.join(ROOT, "public", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("wrote public/og.jpg and public/favicon.ico")
