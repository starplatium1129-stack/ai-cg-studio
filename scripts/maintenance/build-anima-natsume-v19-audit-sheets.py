"""Build labelled Natsume v19 product-matrix contact sheets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


CELL_WIDTH = 420
IMAGE_HEIGHT = 300
LABEL_HEIGHT = 48
FONT_PATHS = (Path(r"C:\Windows\Fonts\msyh.ttc"), Path(r"C:\Windows\Fonts\simhei.ttf"))


def font(size: int):
    for path in FONT_PATHS:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def fit(image: Image.Image) -> Image.Image:
    scale = min(CELL_WIDTH / image.width, IMAGE_HEIGHT / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (CELL_WIDTH, IMAGE_HEIGHT), "#17141a")
    canvas.paste(resized, ((CELL_WIDTH - resized.width) // 2, (IMAGE_HEIGHT - resized.height) // 2))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matrix", type=Path, required=True)
    args = parser.parse_args()
    root = args.matrix.resolve()
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    candidates = ["wai_v18", "base", "e06", "e08", "e10", "e12", "e14"]
    labels = {"wai_v18": "WAI v18", "base": "Anima base", "e06": "E06", "e08": "E08", "e10": "E10", "e12": "E12", "e14": "E14"}
    seeds = manifest["seeds"]
    records = {(item["candidate"], item["sceneId"], item["seed"]): root / item["image"] for item in manifest["records"]}
    output = root / "contact_sheets"
    output.mkdir(parents=True, exist_ok=True)
    title = font(19)
    detail = font(15)
    sheets = []
    for scene in manifest["scenes"]:
        sheet = Image.new("RGB", (CELL_WIDTH * len(candidates), (IMAGE_HEIGHT + LABEL_HEIGHT) * len(seeds)), "#d8d0cb")
        draw = ImageDraw.Draw(sheet)
        for row, seed in enumerate(seeds):
            for col, candidate in enumerate(candidates):
                image_path = records[(candidate, scene["id"], seed)]
                with Image.open(image_path) as image:
                    sheet.paste(fit(image.convert("RGB")), (col * CELL_WIDTH, row * (IMAGE_HEIGHT + LABEL_HEIGHT)))
                x = col * CELL_WIDTH
                y = row * (IMAGE_HEIGHT + LABEL_HEIGHT) + IMAGE_HEIGHT
                draw.rectangle((x, y, x + CELL_WIDTH, y + LABEL_HEIGHT), fill="#eee8e2")
                draw.text((x + 10, y + 5), f"{scene['label']} · {labels[candidate]}", font=title, fill="#302b35")
                draw.text((x + 10, y + 28), f"seed {seed}", font=detail, fill="#6b5e68")
        target = output / f"{scene['id']}.jpg"
        sheet.save(target, quality=94, subsampling=0)
        sheets.append({"sceneId": scene["id"], "label": scene["label"], "sheet": str(target), "candidates": candidates, "seeds": seeds})
    (output / "manifest.json").write_text(json.dumps(sheets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": len(sheets), "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
