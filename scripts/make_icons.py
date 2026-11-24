#!/usr/bin/env python3
"""Generates the PWA PNG icons into public/ (needs Pillow: pip install pillow).
The vector master is public/icon.svg; these PNGs are drawn directly so no SVG renderer is required."""
from PIL import Image, ImageDraw, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public')
CY, PK, BG = (61, 245, 255), (255, 61, 139), (7, 11, 26)


def draw(size: int, safe: float = 1.0, rounded: bool = True) -> Image.Image:
    S = 4  # supersample for smooth edges
    n = size * S
    img = Image.new('RGBA', (n, n), BG + (255,))
    d = ImageDraw.Draw(img)
    # radial-ish background
    for i in range(24):
        r = n * (0.9 - i * 0.03)
        c = (int(20 + 2 * (24 - i)), int(40 + 2 * (24 - i)), int(90 + 2 * (24 - i)), 18)
        d.ellipse((n / 2 - r, n * 0.3 - r, n / 2 + r, n * 0.3 + r), fill=c)
    k = n / 512 * safe
    o = n * (1 - safe) / 2

    def P(x, y):
        return (o + x * k, o + y * k)

    def box(x0, y0, x1, y1):
        return (*P(x0, y0), *P(x1, y1))

    glow = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(box(218, 322, 294, 398), fill=CY + (200,))
    gd.rounded_rectangle(box(136, 64, 376, 448), 28 * k, outline=CY + (160,), width=int(10 * k))
    glow = glow.filter(ImageFilter.GaussianBlur(10 * S))
    img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box(136, 64, 376, 448), 28 * k, fill=(10, 29, 61, 255), outline=CY + (255,), width=int(8 * k))
    d.line((*P(136, 256), *P(376, 256)), fill=CY, width=int(6 * k))
    d.ellipse(box(208, 208, 304, 304), outline=CY, width=int(6 * k))
    d.line((*P(196, 64), *P(316, 64)), fill=PK, width=int(12 * k))
    d.line((*P(196, 448), *P(316, 448)), fill=CY, width=int(12 * k))
    for cx, cy, col, hc in ((256, 360, CY, (207, 233, 255)), (256, 152, PK, (255, 224, 234))):
        d.ellipse(box(cx - 34, cy - 34, cx + 34, cy + 34), fill=(13, 28, 51), outline=col, width=int(6 * k))
        d.ellipse(box(cx - 14, cy - 14, cx + 14, cy + 14), fill=hc)
    d.ellipse(box(280, 242, 320, 282), fill=(232, 240, 255), outline=CY, width=int(4 * k))
    if rounded:
        mask = Image.new('L', (n, n), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, n, n), radius=int(n * 0.19), fill=255)
        img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    draw(192).save(os.path.join(OUT, 'icon-192.png'))
    draw(512).save(os.path.join(OUT, 'icon-512.png'))
    draw(512, safe=0.78, rounded=False).save(os.path.join(OUT, 'icon-maskable-512.png'))  # maskable: content inside the safe zone
    draw(180, rounded=False).convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))  # iOS rounds it itself
    print('icons written to', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
