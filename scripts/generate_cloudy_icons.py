#!/usr/bin/env python3
"""Generate valid Cloudy English PWA icons (opaque RGB PNG).

Install: python -m pip install Pillow
Run from repository root: python scripts/generate_cloudy_icons.py
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

def make_icon(size: int) -> Image.Image:
    n = size * 3
    top, bottom = (6, 20, 58), (12, 43, 100)
    image = Image.new("RGB", (n, n), top)
    pixels = image.load()
    for y in range(n):
        t = y / (n - 1)
        for x in range(n):
            glow = max(0.0, 1 - math.sqrt(((x/n-.5)/.8)**2 + ((y/n-.4)/.85)**2)) ** 2 * .18
            pixels[x, y] = tuple(int(min(255, top[k]*(1-t) + bottom[k]*t + glow*(30 if k == 2 else 18))) for k in range(3))

    halo = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((n*.19, n*.22, n*.81, n*.78), fill=(71,157,255,38))
    image = Image.alpha_composite(image.convert("RGBA"), halo.filter(ImageFilter.GaussianBlur(n*.075)))
    cx, cy = n*.5, n*.52

    shadow = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for ox, oy, radius in [(-.19,.035,.17),(-.035,-.075,.22),(.16,-.005,.18),(.0,.06,.31)]:
        x, y, r = cx+ox*n, cy+oy*n, radius*n
        sd.ellipse((x-r,y-r+n*.018,x+r,y+r+n*.018), fill=(0,0,0,95))
    sd.rounded_rectangle((n*.22,n*.48,n*.78,n*.70), radius=n*.12, fill=(0,0,0,95))
    image = Image.alpha_composite(image, shadow.filter(ImageFilter.GaussianBlur(n*.018)))

    draw = ImageDraw.Draw(image)
    cloud = (245,250,255,255)
    for ox, oy, radius in [(-.19,.015,.17),(-.035,-.095,.22),(.16,-.015,.18)]:
        x, y, r = cx+ox*n, cy+oy*n, radius*n
        draw.ellipse((x-r,y-r,x+r,y+r), fill=cloud)
    draw.rounded_rectangle((n*.22,n*.47,n*.78,n*.69), radius=n*.11, fill=cloud)
    draw.arc((n*.25,n*.48,n*.75,n*.76), 8, 172, fill=(190,214,244,255), width=max(2,int(n*.008)))
    eye_y = n*.535
    for ex in (n*.425,n*.575):
        draw.ellipse((ex-n*.018,eye_y-n*.025,ex+n*.018,eye_y+n*.025), fill=(20,43,82,255))
        draw.ellipse((ex-n*.006,eye_y-n*.018,ex+n*.003,eye_y-n*.008), fill=(255,255,255,255))
    draw.arc((n*.455,n*.535,n*.545,n*.615), 15, 165, fill=(20,43,82,255), width=max(3,int(n*.012)))
    for ex in (n*.37,n*.63):
        draw.ellipse((ex-n*.026,n*.575,ex+n*.026,n*.60), fill=(255,151,169,115))
    draw.ellipse((n*.72,n*.25,n*.745,n*.275), fill=(191,225,255,210))
    draw.ellipse((n*.27,n*.32,n*.285,n*.335), fill=(191,225,255,180))
    return image.convert("RGB").resize((size,size), Image.Resampling.LANCZOS)

def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for size, filename in ((180,"apple-touch-icon.png"),(180,"cloudy-icon.png"),(512,"icon-512.png")):
        path = PUBLIC / filename
        make_icon(size).save(path, format="PNG", optimize=True)
        with Image.open(path) as check:
            check.verify()
        print(f"Generated and verified {path} ({size}x{size}, RGB)")

if __name__ == "__main__":
    main()
