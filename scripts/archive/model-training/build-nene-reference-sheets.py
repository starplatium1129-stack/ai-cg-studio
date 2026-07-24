"""Build focused official-reference sheets from the completed Nene evaluation."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


EVALUATION = Path(r"E:\code\2\lora\AI\Reviews\ModelEvaluations\nene_v13_2026-07-22")
OFFICIAL = Path(r"E:\code\2\lora\AI\Datasets\Characters\Ayachi_Nene\V12")
REFERENCES = Path(r"E:\code\2\lora\AI\Assets\VisualPipeline\official_refs")
SEEDS = [1038976852, 2784519]
CELL_WIDTH = 380
CELL_HEIGHT = 555
LABEL_HEIGHT = 46


def fit(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGB")
    image.thumbnail((CELL_WIDTH, CELL_HEIGHT), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (CELL_WIDTH, CELL_HEIGHT), "#f7f3ef")
    canvas.paste(image, ((CELL_WIDTH - image.width) // 2, (CELL_HEIGHT - image.height) // 2))
    return canvas


def build(name: str, reference: Path, test: str) -> None:
    sheet = Image.new("RGB", (CELL_WIDTH * 3, (CELL_HEIGHT + LABEL_HEIGHT) * 2), "#f7f3ef")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for row, seed in enumerate(SEEDS):
        paths = [
            reference,
            EVALUATION / f"seed-{seed}_{test}_v11.png",
            EVALUATION / f"seed-{seed}_{test}_v13-e30.png",
        ]
        labels = ["official reference", f"v11 / seed {seed}", f"v13-e30 / seed {seed}"]
        y = row * (CELL_HEIGHT + LABEL_HEIGHT)
        for column, (path, label) in enumerate(zip(paths, labels, strict=True)):
            x = column * CELL_WIDTH
            sheet.paste(fit(path), (x, y))
            draw.text((x + 10, y + CELL_HEIGHT + 12), label, fill="#241f26", font=font)
    sheet.save(EVALUATION / name, quality=95, subsampling=0)


def main() -> None:
    build("witch_official-v11-v13e30.jpg", OFFICIAL / "v12_stand_01.png", "witch")
    build("identity_official-v11-v13e30.jpg", REFERENCES / "nene_official.jpg", "identity")


if __name__ == "__main__":
    main()
