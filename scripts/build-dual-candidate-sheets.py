"""Build side-by-side sheets for direct visual review of dual-scene candidates."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = PROJECT_ROOT.parent / "AI" / "Reviews" / "DualShowcase" / "2026-07-23_regional_v1"


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidate = Path("C:/Windows/Fonts/msyh.ttc")
    return ImageFont.truetype(str(candidate), size) if candidate.exists() else ImageFont.load_default()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--attempts", default="4,5")
    args = parser.parse_args()
    attempts = [int(value.strip()) for value in args.attempts.split(",") if value.strip()]
    output = args.source / "review-sheets"
    output.mkdir(parents=True, exist_ok=True)

    for scene_dir in sorted((args.source / "images").iterdir()):
        if not scene_dir.is_dir():
            continue
        available = [(attempt, scene_dir / f"attempt-{attempt}.png") for attempt in attempts]
        available = [(attempt, source) for attempt, source in available if source.is_file()]
        if not available:
            continue
        cell = (672, 448)
        label_height = 48
        canvas = Image.new("RGB", (cell[0] * len(available), cell[1] + label_height), "#17151a")
        draw = ImageDraw.Draw(canvas)
        for index, (attempt, source) in enumerate(available):
            image = Image.open(source).convert("RGB")
            image.thumbnail(cell, Image.Resampling.LANCZOS)
            x = index * cell[0] + (cell[0] - image.width) // 2
            y = (cell[1] - image.height) // 2
            canvas.paste(image, (x, y))
            draw.text((index * cell[0] + 18, cell[1] + 9), f"{scene_dir.name} · attempt {attempt}", fill="white", font=font(22))
        target = output / f"{scene_dir.name}_a{'-'.join(map(str, attempts))}.jpg"
        canvas.save(target, "JPEG", quality=94, subsampling=0)
        print(target)


if __name__ == "__main__":
    main()
