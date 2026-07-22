"""Create a face-only, ultra-low-LR refinement config for Nene."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(r"E:\code\2\lora\AI")
SOURCE = ROOT / "OneTrainer" / "training_configs" / "ayachi_nene_v14_identity.json"
TARGET = ROOT / "OneTrainer" / "training_configs" / "ayachi_nene_v14_face.json"
BASE_LORA = ROOT / "OneTrainer" / "workspace" / "run" / "save" / "2026-07-22_12-33-45-save-210-15-0.safetensors"
OUTPUT = ROOT / "OneTrainer" / "output" / "ayachi_nene_v14_face.safetensors"
FACE_DATASET = ROOT / "RefinementDatasets" / "ayachi_nene_v14_identity" / "face_anchors"


def main() -> None:
    for path in [SOURCE, BASE_LORA, FACE_DATASET]:
        if not path.exists():
            raise FileNotFoundError(path)
    if TARGET.exists():
        raise FileExistsError(f"refusing to overwrite config: {TARGET}")

    config = json.loads(SOURCE.read_text(encoding="utf-8"))
    config["lora_model_name"] = str(BASE_LORA)
    config["output_model_destination"] = str(OUTPUT)
    config["epochs"] = 6
    config["batch_size"] = 2
    config["unet_learning_rate"] = 0.000001
    config["text_encoder_learning_rate"] = 0.0
    config["save_every"] = 1
    config["save_every_unit"] = "EPOCH"
    config["sample_every_epochs"] = 99999

    face = config["concepts"][1]
    face["name"] = "nene_official_face_only"
    face["path"] = str(FACE_DATASET)
    face["balancing"] = 1.0
    face["loss_weight"] = 1.0
    face["enable_crop_jitter"] = False
    face["enable_random_flip"] = False
    face["enable_random_rotate"] = False
    face["text"]["enable_tag_shuffling"] = True
    face["text"]["keep_tags_count"] = 1
    config["concepts"] = [face]

    TARGET.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")
    print(TARGET)


if __name__ == "__main__":
    main()
