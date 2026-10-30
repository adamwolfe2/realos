#!/usr/bin/env python3
"""Pixel-diff the *.before.png / *.after.png pairs written by pixel-diff.mjs.

    .venv-fonts/bin/python scripts/fonts/compare.py <outDir>

Per pair: changed pixels, largest per-pixel delta (0-255) and pixels off by
more than 15. Deltas of a few levels on glyph edges are sub-pixel rounding;
large deltas are real changes. Writes <name>.diff.png (changes in red).
"""
import glob, os, sys
from PIL import Image, ImageChops

out = sys.argv[1]
changed = 0
for stale in glob.glob(os.path.join(out, "*.diff.png")):
    os.remove(stale)
for b in sorted(glob.glob(os.path.join(out, "*.before.png"))):
    name = os.path.basename(b)[: -len(".before.png")]
    a = b.replace(".before.png", ".after.png")
    if not os.path.exists(a):
        changed += 1
        print(f"{name}: MISSING after screenshot")
        continue
    ib, ia = Image.open(b).convert("RGB"), Image.open(a).convert("RGB")
    if ib.size != ia.size:
        changed += 1
        print(f"{name}: SIZE {ib.size} -> {ia.size}")
        continue
    hist = ImageChops.difference(ib, ia).convert("L").histogram()
    n = sum(hist[1:])
    if n:
        changed += 1
        mask = ImageChops.difference(ib, ia).convert("L").point(lambda v: 255 if v else 0)
        overlay = Image.blend(ib, Image.new("RGB", ib.size, "white"), 0.7)
        overlay.paste(Image.new("RGB", ib.size, (255, 0, 0)), mask=mask)
        overlay.save(os.path.join(out, name + ".diff.png"))
        print(f"{name}: {n} px, max delta {max(i for i, v in enumerate(hist) if v)}, {sum(hist[16:])} px > 15")
    else:
        print(f"{name}: identical")
print(f"{changed} of {len(glob.glob(os.path.join(out, '*.before.png')))} pairs differ or are missing")
