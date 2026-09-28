"""Derive every brand asset from branding/logo.png (wide) and branding/icon.png (square):
public/logo.png (trimmed), icon-*.png, favicon.ico (a red A-shield) and og.jpg (share card with the map).

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

# Square app icon: the tilted A-shield on the blue sign, drawn as branding/icon.png by the logo SVG.
sq = Image.open(os.path.join(ROOT, "branding", "icon.png")).convert("RGBA")
bg = Image.new("RGBA", sq.size, LIGHT_BG + (255,))
bg.alpha_composite(sq)
sq = bg
for s in (512, 192, 64, 32):
    sq.resize((s, s), Image.LANCZOS).save(os.path.join(PUB, f"icon-{s}.png"))
# Static favicon fallback: a red A-shield (the app draws a random one at runtime).
from PIL import ImageFont
fav = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
fd = ImageDraw.Draw(fav)
fd.rounded_rectangle((0, 24, 128, 104), radius=16, fill=(255, 255, 255))
fd.rounded_rectangle((4, 28, 124, 100), radius=12, fill=(201, 0, 2))
fd.rounded_rectangle((10, 36, 118, 92), radius=8, outline=(255, 255, 255), width=5)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 48)
except OSError:
    font = ImageFont.load_default()
fd.text((64, 64), "A1", fill=(255, 255, 255), font=font, anchor="mm")
fav.save(os.path.join(PUB, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# Android status-bar badge for push notifications: white shapes on transparent only, or Android shows a white square.
# A shield outline with the A cut out, so the letter stays readable at 24 px.
badge = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
bd = ImageDraw.Draw(badge)
bd.rounded_rectangle((8, 44, 184, 148), radius=22, fill=(255, 255, 255, 255))
bd.rounded_rectangle((22, 58, 170, 134), radius=14, fill=(0, 0, 0, 0))
bd.rounded_rectangle((30, 66, 162, 126), radius=10, fill=(255, 255, 255, 255))
try:
    bfont = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 66)
except OSError:
    bfont = ImageFont.load_default()
cut = Image.new("L", (192, 192), 0)
ImageDraw.Draw(cut).text((96, 96), "A", fill=255, font=bfont, anchor="mm")
badge.putalpha(Image.composite(Image.new("L", (192, 192), 0), badge.getchannel("A"), cut))
badge.resize((96, 96), Image.LANCZOS).save(os.path.join(PUB, "badge-96.png"))

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
