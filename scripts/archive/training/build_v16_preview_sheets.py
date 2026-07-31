#!/usr/bin/env python3
"""Build safe, blurred adult contact sheets for the local training workbench.

The workbench exposes these sheets only through an allowlisted local route. The
source frames stay in the v16 dataset; this artifact is intentionally blurred
before it is written so a thumbnail cannot reveal the adult source image.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


CELL = 280
LABEL_HEIGHT = 24
COLS = 4
ROWS = 4
BACKGROUND = (18, 18, 22)
LABEL_BACKGROUND = (0, 0, 0)
LABEL_COLOUR = (220, 220, 228)
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif"}


def flatten(source: Path) -> Image.Image:
    with Image.open(source) as image:
        rgba = image.convert("RGBA")
        canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        canvas.alpha_composite(rgba)
        return canvas.convert("RGB")


def build_sheet(paths: list[Path], target: Path, character: str) -> dict[str, object]:
    rows = (len(paths) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * CELL, rows * (CELL + LABEL_HEIGHT)), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for index, source in enumerate(paths):
        column, row = index % COLS, index // COLS
        x, y = column * CELL, row * (CELL + LABEL_HEIGHT)
        thumb = flatten(source)
        thumb.thumbnail((CELL, CELL), Image.Resampling.LANCZOS)
        thumb = thumb.filter(ImageFilter.GaussianBlur(radius=18))
        sheet.paste(thumb, (x + (CELL - thumb.width) // 2, y + (CELL - thumb.height) // 2))
        draw.rectangle((x, y + CELL, x + CELL, y + CELL + LABEL_HEIGHT), fill=LABEL_BACKGROUND)
        draw.text((x + 6, y + 6 + CELL), f"sample {index + 1:02d}", fill=LABEL_COLOUR)

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp.jpg")
    sheet.save(temporary, format="JPEG", quality=84, optimize=True)
    temporary.replace(target)
    return {
        "sheet": str(target),
        "character": character,
        "count": len(paths),
        "blur_radius": 18,
        "source_policy": "adult categories from dataset-manifest.json",
    }


def build_character(ai_root: Path, character: str) -> dict[str, object]:
    dataset_root = ai_root / "Datasets" / "v16" / character
    manifest_path = dataset_root / "dataset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    paths: list[Path] = []
    for entry in manifest.get("entries", []):
        category = str(entry.get("category", ""))
        if "adult" not in category:
            continue
        relative = Path(str(entry.get("file", "")))
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError(f"unsafe dataset entry: {relative}")
        source = (dataset_root / relative).resolve()
        if dataset_root.resolve() not in source.parents or source.suffix.lower() not in IMAGE_EXTENSIONS:
            raise ValueError(f"unsafe adult source: {source}")
        if not source.is_file():
            raise FileNotFoundError(source)
        paths.append(source)
    paths.sort(key=lambda item: item.name)
    if not paths:
        raise ValueError(f"no adult samples found for {character}")
    output = ai_root / "Reviews" / "ModelEvaluations" / "v16_dataset_audit"
    target = output / f"{character}-adult-v16-blurred-01.jpg"
    return build_sheet(paths, target, character)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ai-root", type=Path, required=True)
    args = parser.parse_args()
    ai_root = args.ai_root.resolve()
    records = [build_character(ai_root, character) for character in ("nene", "natsume")]
    index = ai_root / "Reviews" / "ModelEvaluations" / "v16_dataset_audit" / "adult-preview-index.json"
    index.write_text(json.dumps({"schema": "ai-cg-studio.v16-adult-preview", "sheets": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": records}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
