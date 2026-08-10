"""Build the WAI/E08 baseline/corrected ordinary-fullbody A/B sheet."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ab", type=Path, required=True)
    args = parser.parse_args()
    root = args.ab.resolve()
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    seeds = manifest["seeds"]
    cols = [("wai_v18", "WAI v18"), ("baseline", "E08 baseline"), ("corrected", "E08 corrected")]
    records = {(item["variant"], item["seed"]): root / item["image"] for item in manifest["records"]}
    cell_w, cell_h, label_h = 560, 383, 54
    sheet = Image.new("RGB", (cell_w * len(cols), (cell_h + label_h) * len(seeds)), "#d8d0cb")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for row, seed in enumerate(seeds):
        for col, (variant, label) in enumerate(cols):
            with Image.open(records[(variant, seed)]) as source:
                image = source.convert("RGB")
                scale = min(cell_w / image.width, cell_h / image.height)
                image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
            x, y = col * cell_w, row * (cell_h + label_h)
            sheet.paste(image, (x + (cell_w - image.width) // 2, y + (cell_h - image.height) // 2))
            draw.rectangle((x, y + cell_h, x + cell_w, y + cell_h + label_h), fill="#eee8e2")
            draw.text((x + 12, y + cell_h + 8), f"{label} · seed {seed}", fill="#302b35", font=font)
    target = root / "contact-sheet.jpg"
    sheet.save(target, quality=94, subsampling=0)
    print(json.dumps({"sheet": str(target), "rows": len(seeds), "columns": len(cols)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
