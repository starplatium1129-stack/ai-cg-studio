"""Build focused official-reference sheets from the final Natsume evaluation."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


EVALUATION = Path(r"E:\code\2\lora\AI\Evaluations\natsume_v13_2026-07-22")
REFERENCE = Path(
    r"E:\code\2\lora\AI\RefinementDatasets\shiki_natsume_v13_balanced\official_qipao\official_v12_stand_03.png"
)
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


def main() -> None:
    columns = 3
    sheet = Image.new(
        "RGB",
        (CELL_WIDTH * columns, (CELL_HEIGHT + LABEL_HEIGHT) * len(SEEDS)),
        "#f7f3ef",
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for row, seed in enumerate(SEEDS):
        paths = [
            REFERENCE,
            EVALUATION / f"seed-{seed}_qipao_v11.png",
            EVALUATION / f"seed-{seed}_qipao_v13-e30.png",
        ]
        labels = ["official reference", f"v11 / seed {seed}", f"v13-e30 / seed {seed}"]
        y = row * (CELL_HEIGHT + LABEL_HEIGHT)
        for column, (path, label) in enumerate(zip(paths, labels, strict=True)):
            x = column * CELL_WIDTH
            sheet.paste(fit(path), (x, y))
            draw.text((x + 10, y + CELL_HEIGHT + 12), label, fill="#241f26", font=font)
    sheet.save(EVALUATION / "qipao_official-v11-v13e30.jpg", quality=96, subsampling=0)
    print(EVALUATION / "qipao_official-v11-v13e30.jpg")


if __name__ == "__main__":
    main()
