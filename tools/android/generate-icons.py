#!/usr/bin/env python3
"""
SWK ONE launcher / splash / notification icon generator.

Source of truth: assets-src/swk-logo.png (official SWK Properties white mark, 512 canvas, mark = 339x275 px).
Every output is a Lanczos resize of that master at the exact Android density size (the old pipeline used
nearest-neighbour and wrong sizes, which produced soft/jagged icons). Only the splash icon on xxhdpi/xxxhdpi screens is
up-scaled (at most 1.4x, followed by a light unsharp mask); every other asset is a down-scale.

  python3 tools/android/generate-icons.py        (needs Pillow)

It also rebuilds the installable-web-app (PWA) icons and favicons in public/ from the same master: the old
generator up-scaled a 180px favicon with nearest-neighbour, which is what made the 512px app icon look blocky.

Writes into android/app/src/main/res:
  mipmap-<d>/ic_launcher_foreground.png   adaptive foreground (108dp canvas, mark inside the 66dp safe zone)
  mipmap-<d>/ic_launcher_monochrome.png   Android 13 themed-icon layer (alpha silhouette)
  drawable-<d>/ic_stat_swk.png            status-bar glyph (24dp, white on transparent)
  drawable-<d>/splash_icon.png            Android 12+ splash icon (288dp canvas, mark 120dp wide inside the 192dp circle)
  mipmap-anydpi/ic_launcher[_round].xml, values/ic_launcher_background.xml
and the Play Store icon android/app/src/main/ic_launcher-playstore.png (512x512).
"""
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets-src" / "swk-logo.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
MAIN = ROOT / "android" / "app" / "src" / "main"

BACKGROUND = "#0B1A33"           # Midnight navy: same as navigation bar / splash (values/styles.xml)
BG_RGB = tuple(int(BACKGROUND[i:i + 2], 16) for i in (1, 3, 5))
DENSITY = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}

master = Image.open(SRC).convert("RGBA")
mark = master.crop(master.getchannel("A").getbbox())          # 339 x 275, tight crop
MW, MH = mark.size

# Roof-and-swoosh glyph for the status bar: the wordmark is illegible at 24dp, the house is not.
ROOF_H = 150                                                  # rows of `mark` that hold roof + swoosh + window
glyph = mark.crop((0, 0, MW, ROOF_H))
glyph = glyph.crop(glyph.getchannel("A").getbbox())


def fit(img, box_w, box_h):
    """Lanczos-resize `img` to fit inside box_w x box_h (never up-scaling beyond the source)."""
    s = min(box_w / img.width, box_h / img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def on_canvas(img, size, *, bg=None):
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    canvas.alpha_composite(img, ((size - img.width) // 2, (size - img.height) // 2))
    return canvas


def silhouette(img, alpha_boost=True):
    """White alpha-only version. The mark's pale shading is lifted so thin strokes still read."""
    a = img.getchannel("A")
    if alpha_boost:
        a = a.point(lambda v: min(255, int(v * 1.6)))
    out = Image.new("RGBA", img.size, (255, 255, 255, 0))
    out.putalpha(a)
    return out


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)


for name, scale in DENSITY.items():
    # --- adaptive icon layers: 108dp canvas, visible mask is the central 72dp, safe zone is a 66dp circle ---
    canvas = round(108 * scale)
    safe = 66 * scale
    # fit the mark's diagonal inside the safe circle, so it survives circle / squircle / teardrop masks
    diag = (MW ** 2 + MH ** 2) ** 0.5
    k = min(1.0, safe / diag)
    m = mark.resize((round(MW * k), round(MH * k)), Image.LANCZOS)
    save(on_canvas(m, canvas), RES / f"mipmap-{name}" / "ic_launcher_foreground.png")
    save(on_canvas(silhouette(m), canvas), RES / f"mipmap-{name}" / "ic_launcher_monochrome.png")

    # --- status-bar glyph, 24dp ---
    sp = round(24 * scale)
    g = fit(silhouette(glyph), round(sp * 0.92), round(sp * 0.92))
    save(on_canvas(g, sp), RES / f"drawable-{name}" / "ic_stat_swk.png")

    # --- splash icon: 288dp canvas; mark is 120dp wide, so even xxxhdpi only up-scales ~1.4x (light unsharp mask restores edges)
    sc = round(288 * scale)
    target_w = round(120 * scale)
    sm_ = mark.resize((target_w, round(MH * target_w / MW)), Image.LANCZOS)
    if target_w > MW:
        sm_ = sm_.filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2))
    save(on_canvas(sm_, sc), RES / f"drawable-{name}" / "splash_icon.png")

# --- Play Store / listing icon: full-bleed square, mark inside the safe zone ---
store = Image.new("RGBA", (512, 512), BG_RGB + (255,))
sm = fit(mark, round(512 * 0.62), round(512 * 0.62))
store.alpha_composite(sm, ((512 - sm.width) // 2, (512 - sm.height) // 2))
save(store.convert("RGB"), MAIN / "ic_launcher-playstore.png")

# --- XML ---
adaptive = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
"""
for n in ("ic_launcher.xml", "ic_launcher_round.xml"):
    p = RES / "mipmap-anydpi" / n
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(adaptive)
(RES / "values" / "ic_launcher_background.xml").write_text(
    f"""<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">{BACKGROUND}</color>
</resources>
"""
)

# =====================================================================================================
# Web: PWA icons + favicons (graphite tile, same master, Lanczos only)
# =====================================================================================================
import struct

PUBLIC = ROOT / "public"
WEB_TILE = (13, 19, 16)            # #0d1310, matches manifest background_color / theme


def web_tile(size, ratio):
    tile = Image.new("RGBA", (size, size), WEB_TILE + (255,))
    m = fit(mark, round(size * ratio), round(size * ratio))
    tile.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return tile


fav = PUBLIC / "favicon"
for n in (16, 32, 48, 64, 128, 180, 192, 256, 512):
    # tiny sizes use a bigger mark (they are never masked); >=192 keeps the mark inside the maskable safe zone
    ratio = 0.86 if n <= 64 else 0.74 if n <= 180 else 0.62
    save(web_tile(n, ratio), fav / f"favicon-{n}.png")
save(web_tile(180, 0.74), fav / "apple-touch-icon.png")
save(web_tile(192, 0.62), PUBLIC / "app-icon-192.png")
save(web_tile(512, 0.62), PUBLIC / "app-icon-512.png")

(fav / "favicon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image href="/favicon/favicon-512.png" width="512" height="512"/></svg>'
)

entries = [(n, (fav / f"favicon-{n}.png").read_bytes()) for n in (16, 32, 48)]
header = struct.pack("<HHH", 0, 1, len(entries))
offset = 6 + 16 * len(entries)
directory, blobs = b"", b""
for n, data in entries:
    directory += struct.pack("<BBBBHHII", n, n, 0, 0, 1, 32, len(data), offset)
    blobs += data
    offset += len(data)
(fav / "favicon.ico").write_bytes(header + directory + blobs)

print("SWK ONE icons generated from", SRC.relative_to(ROOT))
