"""Build a contact sheet using each candidate scene's latest passing audit attempt."""

from __future__ import annotations

import argparse
import json
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


DEFAULT_IDS = (
    "sc002,sc004,sc006,sc007,sc014,sc019,sc025,sc028,sc033,sc044,sc046,"
    "sc061,sc078,sc085,sc096,sc105,sc138,sc142,sc164,sc215,sc234,sc256"
)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/msyh.ttc"),
        Path("C:/Windows/Fonts/simhei.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--scenes", type=Path, default=Path("data/scenes.json"))
    parser.add_argument("--ids", default=DEFAULT_IDS)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    scenes = {item["id"]: item for item in json.loads(args.scenes.read_text(encoding="utf-8"))}
    review = json.loads((args.audit / "manual-review.json").read_text(encoding="utf-8"))["records"]
    ids = [item.strip() for item in args.ids.split(",") if item.strip()]
    output = args.output or args.audit / "featured-candidates.jpg"

    cell_width, image_height, caption_height = 500, 620, 130
    columns = 4
    rows = (len(ids) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_width, rows * (image_height + caption_height)), "#f7f4ef")
    title_font, body_font = font(25), font(18)
    draw = ImageDraw.Draw(sheet)

    for index, scene_id in enumerate(ids):
        scene = scenes[scene_id]
        attempt = int(review[scene_id]["attempt"])
        image_path = args.audit / "images" / scene_id / f"attempt-{attempt}.png"
        source = Image.open(image_path).convert("RGB")
        source.thumbnail((cell_width, image_height), Image.Resampling.LANCZOS)
        x = (index % columns) * cell_width
        y = (index // columns) * (image_height + caption_height)
        paste_x = x + (cell_width - source.width) // 2
        paste_y = y + (image_height - source.height) // 2
        sheet.paste(source, (paste_x, paste_y))
        draw.text((x + 12, y + image_height + 8), f"{scene_id}  {scene['title']}  · attempt {attempt}", fill="#25212b", font=title_font)
        story = scene["story"].split("】", 1)[-1]
        wrapped = textwrap.wrap(story, width=34)[:2]
        draw.multiline_text((x + 12, y + image_height + 48), "\n".join(wrapped), fill="#5a5362", font=body_font, spacing=4)

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=91, subsampling=0)
    print(json.dumps({"output": str(output), "scenes": len(ids)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
