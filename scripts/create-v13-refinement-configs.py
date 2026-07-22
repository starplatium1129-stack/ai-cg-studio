"""Create conservative v11-resume configs for the v13 refinement experiment."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path


ROOT = Path(r"E:\code\2\lora\AI")
CONFIG_DIR = ROOT / "OneTrainer" / "training_configs"
DATASET_ROOT = ROOT / "RefinementDatasets"
MODEL_ROOT = ROOT / "Data" / "Models" / "Lora"
OUTPUT_ROOT = ROOT / "OneTrainer" / "output"


JOBS = {
    "ayachi_nene_v13_refine": {
        "source_config": "ayachi_nene_v11.json",
        "base_lora": MODEL_ROOT / "ayachi_nene_v11.safetensors",
        "dataset": DATASET_ROOT / "ayachi_nene_v13_refine",
    },
    "shiki_natsume_v13_refine": {
        "source_config": "shiki_natsume_v11.json",
        "base_lora": MODEL_ROOT / "shiki_natsume_v11.safetensors",
        "dataset": DATASET_ROOT / "shiki_natsume_v13_refine",
    },
}


def main() -> None:
    for name, job in JOBS.items():
        source = CONFIG_DIR / job["source_config"]
        target = CONFIG_DIR / f"{name}.json"
        if target.exists():
            raise FileExistsError(f"Refusing to overwrite existing config: {target}")
        if not job["base_lora"].is_file():
            raise FileNotFoundError(f"Missing v11 base LoRA: {job['base_lora']}")
        if not job["dataset"].is_dir():
            raise FileNotFoundError(f"Missing refinement dataset: {job['dataset']}")

        config = deepcopy(json.loads(source.read_text(encoding="utf-8")))
        config["lora_model_name"] = str(job["base_lora"])
        config["output_model_destination"] = str(OUTPUT_ROOT / f"{name}.safetensors")
        config["epochs"] = 45
        config["unet_learning_rate"] = 0.00002
        # v11 stores LoRA layers in both SDXL text encoders.  OneTrainer must
        # construct those real layers to load them; a false `train` flag
        # creates dummy modules and rejects the resume.  Mark them trainable
        # for construction, then stop at epoch zero so they receive no
        # gradients or optimizer updates.
        config["train_text_encoder"] = True
        for text_encoder_name in ("text_encoder", "text_encoder_2"):
            text_encoder = config[text_encoder_name]
            text_encoder["train"] = True
            text_encoder["learning_rate"] = 0.0
            text_encoder["stop_training_after"] = 0
            text_encoder["stop_training_after_unit"] = "EPOCH"
        config["text_encoder_learning_rate"] = 0.0
        # Keep three independent refinement candidates.  The trainer writes
        # these below its workspace, never over the final output path.
        config["save_every"] = 15
        config["save_every_unit"] = "EPOCH"
        config["sample_every_epochs"] = 99999
        concept = config["concepts"][0]
        concept["path"] = str(job["dataset"])
        concept["name"] = job["dataset"].name
        target.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
        print(target)


if __name__ == "__main__":
    main()
