"""Create conservative official-only v14 identity refinement configs."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path


ROOT = Path(r"E:\code\2\lora\AI")
CONFIGS = ROOT / "OneTrainer" / "training_configs"
OUTPUT = ROOT / "OneTrainer" / "output"
DATASETS = ROOT / "Datasets" / "Refinement"

JOBS = {
    "ayachi_nene_v14_identity": {
        "source_config": CONFIGS / "ayachi_nene_v13_refine.json",
        "base_lora": ROOT / "OneTrainer" / "workspace" / "run" / "save" / "2026-07-22_12-33-45-save-210-15-0.safetensors",
        "dataset": DATASETS / "ayachi_nene_v14_identity",
        "prefix": "nene",
    },
    "shiki_natsume_v14_identity": {
        "source_config": CONFIGS / "shiki_natsume_v13_refine.json",
        "base_lora": ROOT / "OneTrainer" / "workspace" / "run" / "save" / "2026-07-22_13-24-24-save-225-15-0.safetensors",
        "dataset": DATASETS / "shiki_natsume_v14_identity",
        "prefix": "natsume",
    },
}


def concept_from(template: dict, path: Path, name: str, repeats: float, keep_tags: int) -> dict:
    concept = deepcopy(template)
    concept["path"] = str(path)
    concept["name"] = name
    concept["balancing"] = repeats
    concept["balancing_strategy"] = "REPEATS"
    concept["loss_weight"] = 1.0
    concept["aspect_ratio_bucketing"] = True
    concept["enable_crop_jitter"] = False
    concept["enable_random_flip"] = False
    concept["enable_random_rotate"] = False
    concept.setdefault("text", {})
    concept["text"]["enable_tag_shuffling"] = True
    concept["text"]["keep_tags_count"] = keep_tags
    concept["text"]["tag_delimiter"] = ","
    return concept


def main() -> None:
    for name, job in JOBS.items():
        target = CONFIGS / f"{name}.json"
        if target.exists():
            raise FileExistsError(f"refusing to overwrite config: {target}")
        if not job["base_lora"].is_file():
            raise FileNotFoundError(job["base_lora"])
        for folder in ["general", "face_anchors", "outfits"]:
            if not (job["dataset"] / folder).is_dir():
                raise FileNotFoundError(job["dataset"] / folder)

        config = json.loads(job["source_config"].read_text(encoding="utf-8"))
        config["lora_model_name"] = str(job["base_lora"])
        config["output_model_destination"] = str(OUTPUT / f"{name}.safetensors")
        config["epochs"] = 12
        config["unet_learning_rate"] = 0.000005
        config["text_encoder_learning_rate"] = 0.0
        config["train_text_encoder"] = True
        for encoder_name in ["text_encoder", "text_encoder_2"]:
            encoder = config[encoder_name]
            encoder["train"] = True
            encoder["learning_rate"] = 0.0
            encoder["stop_training_after"] = 0
            encoder["stop_training_after_unit"] = "EPOCH"
        config["save_every"] = 3
        config["save_every_unit"] = "EPOCH"
        config["sample_every_epochs"] = 99999

        template = config["concepts"][0]
        prefix = job["prefix"]
        config["concepts"] = [
            concept_from(template, job["dataset"] / "general", f"{prefix}_official_general", 1.0, 1),
            concept_from(template, job["dataset"] / "face_anchors", f"{prefix}_official_face_anchors", 2.0, 1),
            concept_from(template, job["dataset"] / "outfits", f"{prefix}_official_outfits", 1.5, 2),
        ]
        target.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
        print(target)


if __name__ == "__main__":
    main()
