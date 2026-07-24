"""Build small official-only identity anchor datasets for v14 refinement.

The v13 run proved that long refinement degraded identity after epoch 15.  This
dataset therefore uses only verified official CGs, high-resolution face crops,
and a few official outfit references for a short, low-learning-rate pass.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(r"E:\code\2\lora\AI")
DESTINATION = ROOT / "Datasets" / "Refinement"
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}

CHARACTERS = {
    "nene": {
        "trigger": "ayachi_nene",
        "source": ROOT / "Datasets" / "Characters" / "Ayachi_Nene" / "V12_Curated",
        "dataset": DESTINATION / "ayachi_nene_v14_identity",
        "general": [
            "v12_cg_01", "v12_cg_02", "v12_cg_03", "v12_cg_04", "v12_cg_05",
            "v12_cg_06", "v12_cg_09", "v12_cg_10", "v12_cg_11",
        ],
        "face_crops": {
            "v12_cg_01": (0.10, 0.04, 0.52, 0.82),
            "v12_cg_02": (0.28, 0.00, 0.70, 0.78),
            "v12_cg_03": (0.06, 0.00, 0.48, 0.78),
            "v12_cg_04": (0.06, 0.00, 0.48, 0.78),
            "v12_cg_05": (0.10, 0.02, 0.52, 0.80),
            "v12_cg_06": (0.50, 0.00, 0.92, 0.78),
        },
        "face_caption": "ayachi_nene, solo, close-up, portrait, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, hair_ribbon",
        "outfits": {
            "v12_stand_01": "ayachi_nene, solo, full_body, official_witch_outfit, witch_hat, black_cape, pink_lining, striped_legwear, midriff, simple_background",
            "v12_stand_02": "ayachi_nene, solo, full_body, official_school_uniform, navy_school_blazer, gray_pleated_skirt, black_thighhighs, simple_background",
            "v12_cg_11": "ayachi_nene, solo, official_witch_outfit, witch_hat, black_cape, pink_lining, handgun, aiming, night",
        },
    },
    "natsume": {
        "trigger": "shiki_natsume",
        "source": ROOT / "Datasets" / "Characters" / "Shiki_Natsume" / "V12_Curated",
        "dataset": DESTINATION / "shiki_natsume_v14_identity",
        "general": [
            "v12_cg_01", "v12_cg_02", "v12_cg_03", "v12_cg_04",
            "v12_cg_08", "v12_cg_09", "v12_cg_10", "v12_cg_11",
        ],
        "face_crops": {
            "v12_cg_01": (0.54, 0.00, 0.94, 0.74),
            "v12_cg_02": (0.08, 0.02, 0.50, 0.80),
            "v12_cg_03": (0.50, 0.00, 0.92, 0.78),
            "v12_cg_04": (0.06, 0.00, 0.48, 0.78),
            "v12_cg_08": (0.18, 0.00, 0.60, 0.78),
        },
        "face_caption": "shiki_natsume, solo, close-up, portrait, black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip",
        "outfits": {
            "v12_stand_02": "shiki_natsume, solo, full_body, official_cafe_uniform, pink_cafe_uniform, white_frilled_apron, simple_background",
            "v12_stand_03": "shiki_natsume, solo, full_body, official_qipao_outfit, red_china_dress, gold_embroidery, black_pantyhose, hair_bun, red_hair_flower, simple_background",
            "v12_cg_04": "shiki_natsume, solo, official_qipao_outfit, red_china_dress, gold_embroidery, black_pantyhose, hair_bun, indoors",
        },
    },
}


def find_image(source: Path, stem: str) -> Path:
    matches = [path for path in source.glob(stem + ".*") if path.suffix.lower() in IMAGE_SUFFIXES]
    if len(matches) != 1:
        raise FileNotFoundError(f"expected one image for {source / stem}, got {matches}")
    return matches[0]


def hardlink_pair(source: Path, destination: Path, caption: str | None = None) -> dict:
    destination.parent.mkdir(parents=True, exist_ok=True)
    os.link(source, destination)
    caption_source = source.with_suffix(".txt")
    caption_text = caption if caption is not None else caption_source.read_text(encoding="utf-8").strip()
    destination.with_suffix(".txt").write_text(caption_text + "\n", encoding="utf-8")
    with Image.open(source) as image:
        size = image.size
    return {"source": str(source), "file": str(destination), "dimensions": list(size), "caption": caption_text}


def face_crop(source: Path, destination: Path, box: tuple[float, float, float, float], caption: str) -> dict:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = image.convert("RGB")
        width, height = image.size
        pixels = (
            round(box[0] * width), round(box[1] * height),
            round(box[2] * width), round(box[3] * height),
        )
        cropped = image.crop(pixels)
        cropped.save(destination, quality=98, subsampling=0)
    destination.with_suffix(".txt").write_text(caption + "\n", encoding="utf-8")
    return {"source": str(source), "file": str(destination), "crop": list(box), "caption": caption}


def main() -> None:
    report = {}
    for character, config in CHARACTERS.items():
        source: Path = config["source"]
        dataset: Path = config["dataset"]
        if dataset.exists():
            raise FileExistsError(f"refusing to overwrite existing dataset: {dataset}")
        entries = {"general": [], "face_anchors": [], "outfits": []}
        for stem in config["general"]:
            image = find_image(source, stem)
            entries["general"].append(hardlink_pair(image, dataset / "general" / image.name))
        for stem, box in config["face_crops"].items():
            image = find_image(source, stem)
            entries["face_anchors"].append(
                face_crop(image, dataset / "face_anchors" / f"{stem}_face.jpg", box, config["face_caption"])
            )
        for stem, caption in config["outfits"].items():
            image = find_image(source, stem)
            entries["outfits"].append(hardlink_pair(image, dataset / "outfits" / image.name, caption))
        report[character] = {
            "dataset": str(dataset),
            "counts": {key: len(values) for key, values in entries.items()},
            "entries": entries,
        }
    manifest = DESTINATION / "v14_identity_manifest.json"
    manifest.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
