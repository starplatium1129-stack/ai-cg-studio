"""Build one-reference-per-scene contact sheets from the extracted official CG library."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


AI_ROOT = Path(r"E:\code\2\lora\AI")
LIBRARY = AI_ROOT / "Assets" / "OfficialCG"
MANIFEST = LIBRARY / "manifest.json"
OUTPUT = LIBRARY / "ReferenceSheets"
CHARACTERS = {"nene": "绫地宁宁", "natsume": "四季夏目"}
COLS, ROWS = 4, 3
THUMB = (448, 252)
LABEL_HEIGHT = 38


def scene_key(value: str) -> tuple[int, str]:
    try:
        return int(value, 16), value
    except ValueError:
        return 10**9, value


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default(size=18)
    index: list[dict[str, str]] = []

    for character, display_name in CHARACTERS.items():
        entries = manifest["characters"][character]["files"]
        representatives: dict[str, dict] = {}
        for entry in entries:
            representatives.setdefault(entry["scene"], entry)
        ordered = sorted(representatives.values(), key=lambda item: scene_key(item["scene"]))
        per_sheet = COLS * ROWS

        for page, offset in enumerate(range(0, len(ordered), per_sheet), start=1):
            batch = ordered[offset : offset + per_sheet]
            sheet = Image.new(
                "RGB",
                (COLS * THUMB[0], ROWS * (THUMB[1] + LABEL_HEIGHT)),
                "#17131b",
            )
            draw = ImageDraw.Draw(sheet)
            for item_index, entry in enumerate(batch):
                row, col = divmod(item_index, COLS)
                left = col * THUMB[0]
                top = row * (THUMB[1] + LABEL_HEIGHT)
                source = LIBRARY / display_name / entry["file"]
                with Image.open(source) as opened:
                    image = ImageOps.contain(opened.convert("RGB"), THUMB, Image.Resampling.LANCZOS)
                x = left + (THUMB[0] - image.width) // 2
                y = top + (THUMB[1] - image.height) // 2
                sheet.paste(image, (x, y))
                draw.text(
                    (left + 12, top + THUMB[1] + 8),
                    f"{entry['scene']}  {entry['variant']}",
                    fill="#f8edf5",
                    font=font,
                )
                index.append(
                    {
                        "character": character,
                        "scene": entry["scene"],
                        "variant": entry["variant"],
                        "reference": str(source),
                    }
                )
            target = OUTPUT / f"{character}-{page:02d}.jpg"
            sheet.save(target, quality=94, optimize=True)
            print(target)

    (OUTPUT / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
