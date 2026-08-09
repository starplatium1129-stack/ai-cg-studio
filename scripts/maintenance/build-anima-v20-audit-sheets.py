"""Build labelled E08/E12/V19 sheets for the Anima v20 checkpoint audit."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


CELL_WIDTH = 640
IMAGE_HEIGHT = 438
LABEL_HEIGHT = 72
COLS = 3
ROWS = 3
FONT_PATHS = (Path(r"C:\Windows\Fonts\msyh.ttc"), Path(r"C:\Windows\Fonts\simhei.ttf"))


def load_font(size: int):
    for path in FONT_PATHS:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def fit_contain(image: Image.Image) -> Image.Image:
    scale = min(CELL_WIDTH / image.width, IMAGE_HEIGHT / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS
    )
    canvas = Image.new("RGB", (CELL_WIDTH, IMAGE_HEIGHT), "#17141a")
    canvas.paste(resized, ((CELL_WIDTH - resized.width) // 2, (IMAGE_HEIGHT - resized.height) // 2))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    args = parser.parse_args()

    audit = args.audit.resolve()
    baseline = args.baseline.resolve()
    candidate_manifest = json.loads((audit / "manifest.json").read_text(encoding="utf-8"))
    baseline_manifest = json.loads((baseline / "manifest.json").read_text(encoding="utf-8"))
    candidates = {
        (item["sceneId"], item["seed"], item["candidate"]): audit / item["image"]
        for item in candidate_manifest["records"]
    }
    production = {
        (item["sceneId"], item["seed"]): baseline / item["image"]
        for item in baseline_manifest["records"]
        if item["engine"] == "anima"
    }
    seeds = sorted({item["seed"] for item in candidate_manifest["records"]})
    assert len(seeds) == ROWS, f"expected {ROWS} seeds, found {len(seeds)}"

    output = audit / "contact_sheets"
    output.mkdir(parents=True, exist_ok=True)
    title_font = load_font(25)
    detail_font = load_font(20)
    manifest = []

    for scene_id in candidate_manifest["scenes"]:
        sheet = Image.new("RGB", (CELL_WIDTH * COLS, (IMAGE_HEIGHT + LABEL_HEIGHT) * ROWS), "#d8d0cb")
        draw = ImageDraw.Draw(sheet)
        for row, seed in enumerate(seeds):
            paths = (
                ("V20 E08", candidates[(scene_id, seed, "e08")]),
                ("V20 E12", candidates[(scene_id, seed, "e12")]),
                ("V19 PROD", production[(scene_id, seed)]),
            )
            for col, (label, image_path) in enumerate(paths):
                x = col * CELL_WIDTH
                y = row * (IMAGE_HEIGHT + LABEL_HEIGHT)
                with Image.open(image_path) as source:
                    sheet.paste(fit_contain(source.convert("RGB")), (x, y))
                draw.rectangle((x, y + IMAGE_HEIGHT, x + CELL_WIDTH, y + IMAGE_HEIGHT + LABEL_HEIGHT), fill="#eee8e2")
                draw.text((x + 18, y + IMAGE_HEIGHT + 8), f"{scene_id} · {label}", font=title_font, fill="#302b35")
                draw.text((x + 18, y + IMAGE_HEIGHT + 39), f"seed {seed}", font=detail_font, fill="#6b5e68")
        target = output / f"{scene_id}-e08-e12-v19.jpg"
        sheet.save(target, quality=94, subsampling=0)
        manifest.append({"sceneId": scene_id, "sheet": str(target), "seeds": seeds})

    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"sheets": len(manifest), "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
