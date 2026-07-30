#!/usr/bin/env python3
"""Build labelled local audit sheets from a dataset manifest."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
CELL = (320, 320)
LABEL_HEIGHT = 40
COLS = 4


def flatten(path: Path) -> Image.Image:
    with Image.open(path) as source:
        rgba = source.convert("RGBA")
    background = Image.new("RGBA", rgba.size, "white")
    background.alpha_composite(rgba)
    return background.convert("RGB")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--per-sheet", type=int, default=12)
    args = parser.parse_args()

    dataset = args.dataset.resolve()
    manifest = json.loads((dataset / "dataset-manifest.json").read_text(encoding="utf-8"))
    entries = manifest.get("entries", [])
    args.output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()
    index: list[dict[str, object]] = []

    for page, start in enumerate(range(0, len(entries), args.per_sheet), start=1):
        batch = entries[start : start + args.per_sheet]
        rows = (len(batch) + COLS - 1) // COLS
        sheet = Image.new(
            "RGB", (CELL[0] * COLS, (CELL[1] + LABEL_HEIGHT) * rows), "#15151a"
        )
        draw = ImageDraw.Draw(sheet)
        page_entries: list[dict[str, str]] = []
        for offset, entry in enumerate(batch):
            relative = Path(str(entry["file"]))
            if relative.is_absolute() or ".." in relative.parts:
                raise RuntimeError(f"unsafe path: {relative}")
            source = dataset / relative
            if source.suffix.lower() not in IMAGE_SUFFIXES or not source.is_file():
                raise RuntimeError(f"invalid image: {source}")
            image = ImageOps.contain(flatten(source), CELL, Image.Resampling.LANCZOS)
            column, row = offset % COLS, offset // COLS
            x, y = column * CELL[0], row * (CELL[1] + LABEL_HEIGHT)
            sheet.paste(image, (x + (CELL[0] - image.width) // 2, y + (CELL[1] - image.height) // 2))
            sample_id = str(entry.get("id") or source.stem)
            category = str(entry.get("category", ""))
            draw.rectangle((x, y + CELL[1], x + CELL[0], y + CELL[1] + LABEL_HEIGHT), fill="#050507")
            draw.text((x + 6, y + CELL[1] + 5), sample_id[:40], fill="#f4f1e9", font=font)
            draw.text((x + 6, y + CELL[1] + 21), category[:40], fill="#b9b3c6", font=font)
            page_entries.append({"id": sample_id, "file": relative.as_posix(), "category": category})
        target = args.output / f"audit-{page:02d}.jpg"
        sheet.save(target, quality=94, subsampling=0)
        index.append({"sheet": str(target), "entries": page_entries})

    (args.output / "index.json").write_text(
        json.dumps({"dataset": str(dataset), "sheets": index}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"sheets": len(index), "entries": len(entries)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
