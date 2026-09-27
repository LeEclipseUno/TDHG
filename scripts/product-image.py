"""Product image for the Wegenkenner Plus listing on Lemon Squeezy: branding/plus-product.png (1400x1000, 7:5).
The logo, the gold Plus plate and the map sit inside a safe area so a crop to 4:3 or 16:10 keeps everything.

Usage: python scripts/product-image.py   (needs Pillow; run after build-data.py)
"""
import json, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "public", "data")
BG = (10, 22, 40)
LAND, EDGE, ABROAD = (27, 74, 141), (47, 111, 208), (21, 36, 58)
AMBER, NAVY = (255, 176, 0), (10, 22, 40)

W, H = 1400, 1000
S = 2  # supersample

def decode(line):
    out = [line[0], line[1]]
    for i in range(2, len(line), 2):
        out.append(out[-2] + line[i]); out.append(out[-2] + line[i + 1])
    return out

land = json.load(open(os.path.join(DATA, "land.json"), encoding="utf-8"))
abroad = json.load(open(os.path.join(DATA, "abroad.json"), encoding="utf-8"))
roads = json.load(open(os.path.join(DATA, "roads-core.json"), encoding="utf-8"))
xs = [c for p in land for r in p["rings"] for c in r[0::2]]; ys = [c for p in land for r in p["rings"] for c in r[1::2]]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)

# Map on the right two thirds, with breathing room.
mx, my, mw, mh = 560, 60, 780, 880
scale = min(mw / (x1 - x0), mh / (y1 - y0))
ox = mx + (mw - (x1 - x0) * scale) / 2; oy = my + (mh - (y1 - y0) * scale) / 2
img = Image.new("RGB", (W * S, H * S), BG)
d = ImageDraw.Draw(img)
P = lambda x, y: ((ox + (x - x0) * scale) * S, (oy + (y - y0) * scale) * S)
for poly in abroad:
    d.polygon([P(poly["rings"][0][i], poly["rings"][0][i + 1]) for i in range(0, len(poly["rings"][0]), 2)], fill=ABROAD)
for poly in land:
    rings = poly["rings"]
    d.polygon([P(rings[0][i], rings[0][i + 1]) for i in range(0, len(rings[0]), 2)], fill=LAND, outline=EDGE)
    for hole in rings[1:]:
        d.polygon([P(hole[i], hole[i + 1]) for i in range(0, len(hole), 2)], fill=BG)
for kind, col, wdt in (("N", (255, 210, 63), 2), ("A", (246, 248, 252), 4)):
    for r in roads:
        if r["kind"] != kind: continue
        for line in r["lines"]:
            pts = decode(line)
            d.line([P(pts[i], pts[i + 1]) for i in range(0, len(pts), 2)], fill=col, width=wdt * S, joint="curve")
img = img.resize((W, H), Image.LANCZOS).convert("RGBA")

# Soft glow behind the logo so it sits on the dark side of the card.
halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(halo).ellipse((-40, 180, 640, 700), fill=(90, 150, 255, 120))
img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(70)))

# Logo, top left of the safe area.
logo = Image.open(os.path.join(ROOT, "branding", "logo.png")).convert("RGBA")
logo = logo.crop(logo.getbbox())
lw = 520
lg = logo.resize((lw, round(lw * logo.size[1] / logo.size[0])), Image.LANCZOS)
lx, ly = 70, 300
img.paste(lg, (lx, ly), lg)

# Gold Plus plate under the logo, in the sign style: amber plate, navy border, bold text.
def font(size, bold=True):
    for name in (["arialbd.ttf", "arial.ttf"] if bold else ["arial.ttf"]):
        try:
            return ImageFont.truetype("C:/Windows/Fonts/" + name, size)
        except OSError:
            continue
    return ImageFont.load_default()

d = ImageDraw.Draw(img)
px, py = lx + 6, ly + lg.size[1] + 36
pw, ph = 250, 84
d.rounded_rectangle((px, py, px + pw, py + ph), radius=12, fill=AMBER, outline=NAVY, width=4)
d.rounded_rectangle((px + 9, py + 9, px + pw - 9, py + ph - 9), radius=7, outline=NAVY, width=2)
f = font(54)
tw = d.textlength("PLUS", font=f)
d.text((px + (pw - tw) / 2, py + ph / 2 - 30), "PLUS", fill=NAVY, font=f)

# One line of promise under the plate.
f2 = font(30, bold=False)
d.text((px, py + ph + 28), "Een jaar lang alles open.", fill=(230, 236, 245), font=f2)

img.convert("RGB").save(os.path.join(ROOT, "branding", "plus-product.png"))
print("wrote branding/plus-product.png", W, "x", H)
