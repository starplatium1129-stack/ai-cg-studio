#!/usr/bin/env python
"""
Generate a grayscale inpaint mask PNG for the ComfyUI local-repair pipeline.

The mask is white (255) inside the painted shapes and black (0) outside, in the
requested pixel size. A feather (gaussian blur) softens the edge so the masked
img2img transition blends naturally; the same blur is applied via PIL only when
feather > 0.

Usage:
  python inpaint-maskgen.py <out.png> <width> <height> \
      --ellipse cx cy rx ry [feather] ...      (repeatable)
      --rect x0 y0 x1 y1 [feather] ...         (repeatable)

All coordinates are in the requested pixel space (the upscaled crop space when
used as the ComfyUI mask input). 0 <= value <= 255 fills.
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

WHITE = (255, 255, 255)


def parse_shapes(args):
    shapes = []
    i = 0
    while i < len(args):
        kind = args[i]
        if kind == "--ellipse":
            cx, cy, rx, ry = (int(v) for v in args[i + 1 : i + 5])
            feather = int(args[i + 5]) if i + 5 < len(args) and args[i + 5].lstrip("-").isdigit() else 6
            shapes.append(("ellipse", (cx, cy, rx, ry), feather))
            i += 5 if i + 5 == len(args) or args[i + 5].startswith("--") else 6
        elif kind == "--rect":
            x0, y0, x1, y1 = (int(v) for v in args[i + 1 : i + 5])
            feather = int(args[i + 5]) if i + 5 < len(args) and args[i + 5].lstrip("-").isdigit() else 6
            shapes.append(("rect", (x0, y0, x1, y1), feather))
            i += 5 if i + 5 == len(args) or args[i + 5].startswith("--") else 6
        else:
            raise SystemExit(f"unknown shape token: {kind}")
    return shapes


def main():
    if len(sys.argv) < 5:
        raise SystemExit(__doc__)
    out, width, height = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    shapes = parse_shapes(sys.argv[4:])
    if not shapes:
        raise SystemExit("no shapes provided")

    img = Image.new("L", (width, height), 0)
    d = ImageDraw.Draw(img)
    for kind, params, _ in shapes:
        if kind == "ellipse":
            cx, cy, rx, ry = params
            d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
        else:
            x0, y0, x1, y1 = params
            d.rectangle([x0, y0, x1, y1], fill=255)
    max_feather = max(f for _, _, f in shapes)
    if max_feather > 0:
        img = img.filter(ImageFilter.GaussianBlur(max_feather))
    img.save(out, "PNG")
    print(f"wrote {out} ({width}x{height}, shapes={[(s, p) for s, p, _ in shapes]})")


if __name__ == "__main__":
    main()
