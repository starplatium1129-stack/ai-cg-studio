"""Convert one candidate PNG into a compressed big JPEG + a real thumbnail JPEG.

Reuses the production save_jpeg from build-scene-showcase.py so the publish
output matches the existing scene-showcase image pipeline exactly (LANCZOS
thumbnail, progressive JPEG, subsampling=0).

Usage:
  python convert-showcase-image.py <source> <big-out> <thumb-out> \
      [--image-box 1800x2400] [--image-quality 94] \
      [--thumb-box 480x640] [--thumb-quality 85]

Exits non-zero with a message on stderr on any error. Never writes into the
candidate/review directory; outputs go exactly where the caller says.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path


def load_builder():
    root = Path(__file__).resolve().parents[1]  # scripts/
    source = root / "maintenance" / "build-scene-showcase.py"
    spec = importlib.util.spec_from_file_location("scene_showcase_builder", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load builder module: {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_box(value: str) -> tuple[int, int]:
    parts = str(value).lower().split("x")
    if len(parts) != 2:
        raise ValueError(f"expected WxH box, got {value!r}")
    width, height = int(parts[0]), int(parts[1])
    if width <= 0 or height <= 0:
        raise ValueError(f"box dimensions must be positive: {value!r}")
    return width, height


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("image_out", type=Path)
    parser.add_argument("thumb_out", type=Path)
    parser.add_argument("--image-box", default="1800x2400")
    parser.add_argument("--image-quality", type=int, default=94)
    parser.add_argument("--thumb-box", default="480x640")
    parser.add_argument("--thumb-quality", type=int, default=85)
    args = parser.parse_args()

    try:
        from PIL import Image
        source = args.source.resolve()
        if not source.is_file():
            raise RuntimeError(f"missing source image: {source}")
        builder = load_builder()
        image_box = parse_box(args.image_box)
        thumb_box = parse_box(args.thumb_box)
        if args.image_quality < 1 or args.image_quality > 100 or args.thumb_quality < 1 or args.thumb_quality > 100:
            raise ValueError("jpeg quality must be in 1..100")
        image_out = args.image_out.resolve()
        thumb_out = args.thumb_out.resolve()
        with Image.open(source) as image:
            builder.save_jpeg(image, image_out, image_box, args.image_quality)
        with Image.open(source) as image:
            builder.save_jpeg(image, thumb_out, thumb_box, args.thumb_quality)
        print(json.dumps({
            "source": str(source),
            "image": str(image_out),
            "thumb": str(thumb_out),
            "imageBytes": image_out.stat().st_size,
            "thumbBytes": thumb_out.stat().st_size,
        }, ensure_ascii=False))
    except Exception as error:  # noqa: BLE001
        print(f"convert-showcase-image failed: {error}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
