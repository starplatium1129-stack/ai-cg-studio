"""Build non-destructive v13 LoRA refinement datasets.

The v13 datasets keep every successful v11 identity sample, add a small set
of verified official CGs, and lightly emphasize one character-specific outfit
with a CG plus a full-body standing illustration.  Images are NTFS hard links,
so the datasets do not create another large copy of the source files.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(r"E:\code\2\lora\AI")
DESTINATION_ROOT = ROOT / "RefinementDatasets"

CHARACTERS = {
    "nene": {
        "base": ROOT / "Ayachi_nene_Train",
        "official": ROOT / "Ayachi_nene_Train_v12",
        "destination": DESTINATION_ROOT / "ayachi_nene_v13_refine",
        # Exclude vertical CGs, staged standing art, and couple/ambiguous frames.
        "official_images": [
            "v12_cg_01",
            "v12_cg_02",
            "v12_cg_03",
            "v12_cg_04",
            "v12_cg_05",
            "v12_cg_11",
            "v12_stand_01",
        ],
        "outfit_samples": {
            "v12_cg_11": "ayachi_nene, nene_witch_outfit, solo, witch_hat, black_cape, pink_lining, striped_legwear, handgun, aiming, night, action_pose",
            "v12_stand_01": "ayachi_nene, nene_witch_outfit, solo, full_body, standing, witch_hat, black_cape, pink_lining, striped_legwear, midriff, simple_background",
        },
    },
    "natsume": {
        "base": ROOT / "Shiki_Natsume_Train",
        "official": ROOT / "Shiki_Natsume_Train_v12",
        "destination": DESTINATION_ROOT / "shiki_natsume_v13_refine",
        # Solo, landscape CGs only.  Couple frames and staged standing art are excluded.
        "official_images": [
            "v12_cg_02",
            "v12_cg_03",
            "v12_cg_04",
            "v12_cg_08",
            "v12_cg_09",
            "v12_cg_10",
            "v12_stand_03",
        ],
        "outfit_samples": {
            "v12_cg_04": "shiki_natsume, natsume_qipao, mole_under_eye, solo, red_china_dress, gold_trim, black_thighhighs, standing, indoors, looking_at_viewer",
            "v12_stand_03": "shiki_natsume, natsume_qipao, mole_under_eye, solo, full_body, red_china_dress, gold_trim, black_thighhighs, hair_bun, standing, simple_background",
        },
    },
}

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def image_dimensions(image_path: Path) -> tuple[int, int]:
    with Image.open(image_path) as image:
        width, height = image.size
        return width, height


def hardlink(source: Path, destination: Path) -> None:
    if destination.exists():
        raise FileExistsError(f"Refusing to overwrite existing file: {destination}")
    os.link(source, destination)


def copy_pair(
    source_image: Path,
    destination: Path,
    prefix: str,
    source_kind: str,
    *,
    require_landscape_cg: bool = False,
    caption_override: str | None = None,
) -> dict[str, object]:
    source_caption = source_image.with_suffix(".txt")
    if not source_caption.exists():
        raise FileNotFoundError(f"Missing caption: {source_caption}")
    dimensions = image_dimensions(source_image)
    if require_landscape_cg and (
        dimensions[0] <= dimensions[1] or dimensions[0] < 1024 or dimensions[1] < 768
    ):
        raise ValueError(
            f"Expected a sufficiently large landscape CG, got {source_image} "
            f"({dimensions[0]}x{dimensions[1]})"
        )
    name = f"{prefix}_{source_image.name}"
    destination_image = destination / name
    hardlink(source_image, destination_image)
    destination_caption = destination_image.with_suffix(".txt")
    if caption_override is None:
        shutil.copy2(source_caption, destination_caption)
        caption = source_caption.read_text(encoding="utf-8").strip()
    else:
        destination_caption.write_text(caption_override + "\n", encoding="utf-8")
        caption = caption_override
    return {
        "file": name,
        "source_kind": source_kind,
        "source": str(source_image),
        "dimensions": f"{dimensions[0]}x{dimensions[1]}",
        "caption": caption,
    }


def main() -> None:
    DESTINATION_ROOT.mkdir(parents=True, exist_ok=True)
    report: dict[str, object] = {}

    for character, config in CHARACTERS.items():
        base: Path = config["base"]
        official: Path = config["official"]
        destination: Path = config["destination"]
        if destination.exists():
            raise FileExistsError(f"Refusing to overwrite existing dataset: {destination}")
        destination.mkdir(parents=True)

        entries = []
        base_images = sorted(item for item in base.iterdir() if item.suffix.lower() in IMAGE_SUFFIXES)
        for image in base_images:
            entries.append(copy_pair(image, destination, "base", "v11_identity"))

        outfit_samples: dict[str, str] = config["outfit_samples"]
        official_sample_count = 0
        for stem in config["official_images"]:
            image = official / f"{stem}.png"
            if not image.exists():
                raise FileNotFoundError(f"Missing selected official CG: {image}")
            is_standing_art = stem.startswith("v12_stand_")
            copies = 2 if stem in outfit_samples else 1
            for copy_index in range(1, copies + 1):
                prefix = "official" if copy_index == 1 else f"official_repeat_{copy_index}"
                entries.append(
                    copy_pair(
                        image,
                        destination,
                        prefix,
                        "verified_official_outfit" if stem in outfit_samples else "verified_official_cg",
                        require_landscape_cg=not is_standing_art,
                        caption_override=outfit_samples.get(stem),
                    )
                )
                official_sample_count += 1

        report[character] = {
            "destination": str(destination),
            "v11_identity_samples": len(base_images),
            "official_addition_samples": official_sample_count,
            "total_samples": len(entries),
            "entries": entries,
        }

    manifest = DESTINATION_ROOT / "v13_refinement_manifest.json"
    manifest.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
