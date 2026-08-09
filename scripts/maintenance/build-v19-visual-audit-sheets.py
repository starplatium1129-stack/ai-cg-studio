"""Build pair contact sheets for the V-10 human visual audit."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


CARD_WIDTH = 1500
IMAGE_WIDTH = 730
IMAGE_HEIGHT = 500
CAPTION_HEIGHT = 110
CARD_HEIGHT = IMAGE_HEIGHT + CAPTION_HEIGHT
COLS = 2
ROWS = 2
PER_SHEET = COLS * ROWS
FONT_PATHS = (
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\simhei.ttf"),
)


def load_font(size: int):
    for path in FONT_PATHS:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def fit_contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = min(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "#18151b")
    canvas.paste(resized, ((target_w - resized.width) // 2, (target_h - resized.height) // 2))
    return canvas


def pair_card(pair: dict) -> Image.Image:
    canvas = Image.new("RGB", (CARD_WIDTH, CARD_HEIGHT), "#eee8e2")
    draw = ImageDraw.Draw(canvas)
    sd = Image.open(pair["sd"]["image_path"]).convert("RGB")
    anima = Image.open(pair["anima"]["image_path"]).convert("RGB")
    canvas.paste(fit_contain(sd, (IMAGE_WIDTH, IMAGE_HEIGHT)), (20, 0))
    canvas.paste(fit_contain(anima, (IMAGE_WIDTH, IMAGE_HEIGHT)), (750, 0))
    title = load_font(28)
    body = load_font(21)
    draw.text((24, IMAGE_HEIGHT + 14), f"{pair['scene_id']} · seed {pair['seed']} · {pair['title']}", font=title, fill="#302b35")
    draw.text((24, IMAGE_HEIGHT + 59), "左：SD v18 基线        右：Anima v19 候选", font=body, fill="#695c68")
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, required=True)
    args = parser.parse_args()
    audit = args.audit.resolve()
    manifest_path = audit / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    records = manifest["records"]
    by_key = {(item["sceneId"], item["seed"], item["engine"]): item for item in records}
    pairs = []
    for scene in manifest["scenes"]:
        for seed in manifest["seeds"]:
            sd = by_key[(scene["id"], seed, "sd")]
            anima = by_key[(scene["id"], seed, "anima")]
            pairs.append({
                "scene_id": scene["id"],
                "title": scene["title"],
                "seed": seed,
                "sd": {"image_path": str(audit / sd["image"])},
                "anima": {"image_path": str(audit / anima["image"])},
            })
    output = audit / "contact_sheets"
    output.mkdir(parents=True, exist_ok=True)
    sheet_manifest = []
    for offset in range(0, len(pairs), PER_SHEET):
        batch = pairs[offset : offset + PER_SHEET]
        sheet = Image.new("RGB", (CARD_WIDTH * COLS, CARD_HEIGHT * ROWS), "#d9d0ca")
        for index, pair in enumerate(batch):
            x = (index % COLS) * CARD_WIDTH
            y = (index // COLS) * CARD_HEIGHT
            sheet.paste(pair_card(pair), (x, y))
        target = output / f"sheet-{offset // PER_SHEET + 1:02d}.jpg"
        sheet.save(target, quality=92, subsampling=0)
        sheet_manifest.append({
            "sheet": str(target),
            "scene_seeds": [f"{pair['scene_id']}:{pair['seed']}" for pair in batch],
        })
    (output / "manifest.json").write_text(json.dumps(sheet_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sheets": len(sheet_manifest), "pairs": len(pairs), "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
