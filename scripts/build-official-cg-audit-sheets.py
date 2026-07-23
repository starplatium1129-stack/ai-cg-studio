"""Build side-by-side official-reference/WebUI-result audit sheets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"E:\code\2\lora\AI-CG-Studio")
AUDIT = Path(r"E:\code\2\lora\AI\OfficialCGAudits\2026-07-23_v14")


def fit_image(path: Path, width: int, height: int) -> Image.Image:
    with Image.open(path) as source:
        image = source.convert("RGB")
    image.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), "#17191f")
    canvas.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", default="")
    parser.add_argument("--attempt", type=int, default=1)
    parser.add_argument("--per-sheet", type=int, default=4)
    args = parser.parse_args()

    candidates = json.loads(
        (ROOT / "data" / "official-cg-candidates.json").read_text(encoding="utf-8")
    )
    wanted = [value.strip() for value in args.ids.split(",") if value.strip()]
    if wanted:
        by_id = {item["id"]: item for item in candidates}
        candidates = [by_id[value] for value in wanted]

    pairs = []
    for candidate in candidates:
        result = AUDIT / "images" / f"{candidate['id']}-a{args.attempt}.png"
        if result.exists():
            pairs.append((candidate, result))

    output = AUDIT / "sheets"
    output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 22)
    small = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 17)
    cell_w, image_h, header_h = 1344, 300, 42

    for sheet_index in range(0, len(pairs), args.per_sheet):
        batch = pairs[sheet_index : sheet_index + args.per_sheet]
        sheet = Image.new(
            "RGB", (cell_w, len(batch) * (header_h + image_h)), "#101217"
        )
        draw = ImageDraw.Draw(sheet)
        for row, (candidate, result) in enumerate(batch):
            top = row * (header_h + image_h)
            draw.text(
                (12, top + 7),
                f"{candidate['id']}  {candidate['title']}",
                fill="#f4f0e8",
                font=font,
            )
            draw.text((470, top + 11), "官方参考", fill="#d5a7bc", font=small)
            draw.text((1120, top + 11), f"WebUI a{args.attempt}", fill="#9ecbed", font=small)
            left = fit_image(Path(candidate["reference"]), cell_w // 2, image_h)
            right = fit_image(result, cell_w // 2, image_h)
            sheet.paste(left, (0, top + header_h))
            sheet.paste(right, (cell_w // 2, top + header_h))
        target = output / f"audit-a{args.attempt}-{sheet_index // args.per_sheet + 1:02d}.jpg"
        sheet.save(target, quality=93)
        print(target)


if __name__ == "__main__":
    main()
