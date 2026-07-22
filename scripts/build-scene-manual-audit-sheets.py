"""Build compact scene sheets for direct human/agent visual review."""

from __future__ import annotations

import argparse
import json
import re
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


CARD_WIDTH = 760
IMAGE_HEIGHT = 930
CAPTION_HEIGHT = 300
CARD_HEIGHT = IMAGE_HEIGHT + CAPTION_HEIGHT
COLS = 3
ROWS = 2
PER_SHEET = COLS * ROWS
FONT_PATHS = (
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\simhei.ttf"),
)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_PATHS:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def fit_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS
    )
    left = max(0, (resized.width - target_w) // 2)
    top = max(0, (resized.height - target_h) // 2)
    return resized.crop((left, top, left + target_w, top + target_h))


def compact_story(scene: dict) -> str:
    story = re.sub(r"^【[^】]+】", "", str(scene.get("story") or "")).strip()
    return story[:145] + ("…" if len(story) > 145 else "")


def compact_prompt(scene: dict) -> str:
    ignored = {
        "1girl", "solo", "adult", "ayachi_nene", "shiki_natsume",
        "white_hair", "black_hair", "very_long_hair", "long_hair",
        "low_twintails", "purple_eyes", "yellow_eyes", "ahoge",
        "hair_ribbon", "mole_under_eye", "hairclip",
    }
    tags = []
    for raw in str(scene.get("prompt") or "").split(","):
        tag = raw.strip()
        if not tag or tag in ignored or tag.startswith("<lora:"):
            continue
        tags.append(tag)
    value = ", ".join(tags)
    return value[:220] + ("…" if len(value) > 220 else "")


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    width: int,
    line_limit: int,
    spacing: int = 6,
) -> None:
    lines = textwrap.wrap(text, width=width, break_long_words=True)[:line_limit]
    draw.multiline_text(xy, "\n".join(lines), font=font, fill=fill, spacing=spacing)


def card(scene: dict, image_path: Path) -> Image.Image:
    canvas = Image.new("RGB", (CARD_WIDTH, CARD_HEIGHT), "#f6f2ed")
    image = Image.open(image_path).convert("RGB")
    canvas.paste(fit_cover(image, (CARD_WIDTH, IMAGE_HEIGHT)), (0, 0))
    draw = ImageDraw.Draw(canvas)
    title_font = load_font(29)
    body_font = load_font(20)
    small_font = load_font(17)
    draw.rectangle((0, IMAGE_HEIGHT, CARD_WIDTH, CARD_HEIGHT), fill="#f6f2ed")
    draw.text(
        (22, IMAGE_HEIGHT + 16),
        f"{scene['id']}  {scene.get('title', '')}",
        font=title_font,
        fill="#302b35",
    )
    meta = f"{scene.get('rating', 'All')} · {scene.get('category', '')} · {scene.get('char', '')}"
    draw.text((22, IMAGE_HEIGHT + 58), meta, font=small_font, fill="#7c6675")
    draw_wrapped(
        draw,
        (22, IMAGE_HEIGHT + 92),
        "故事：" + compact_story(scene),
        body_font,
        "#413943",
        width=31,
        line_limit=4,
    )
    draw_wrapped(
        draw,
        (22, IMAGE_HEIGHT + 205),
        "画面要求：" + compact_prompt(scene),
        small_font,
        "#675965",
        width=43,
        line_limit=3,
    )
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenes", type=Path, default=Path("data/scenes.json"))
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--attempt", type=int, default=1)
    args = parser.parse_args()

    scenes = load_json(args.scenes)
    output = args.audit / "manual_sheets"
    output.mkdir(parents=True, exist_ok=True)
    manifest = []
    available = []
    for scene in scenes:
        candidate = args.audit / "images" / scene["id"] / f"attempt-{args.attempt}.png"
        if candidate.exists():
            available.append((scene, candidate))

    for offset in range(0, len(available), PER_SHEET):
        batch = available[offset : offset + PER_SHEET]
        sheet = Image.new("RGB", (CARD_WIDTH * COLS, CARD_HEIGHT * ROWS), "#e9e2dc")
        ids = []
        for index, (scene, image_path) in enumerate(batch):
            x = (index % COLS) * CARD_WIDTH
            y = (index // COLS) * CARD_HEIGHT
            sheet.paste(card(scene, image_path), (x, y))
            ids.append(scene["id"])
        target = output / f"sheet-{offset // PER_SHEET + 1:03d}_{ids[0]}-{ids[-1]}.jpg"
        sheet.save(target, quality=92, subsampling=0)
        manifest.append({"sheet": str(target), "scene_ids": ids})

    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({"sheets": len(manifest), "scenes": len(available)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
