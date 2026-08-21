"""Create Natsume v18 from the audited v17 baseline with one isolated fix."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(r"E:\code\2\lora\AI\OneTrainer")
SOURCE = ROOT / "training_configs" / "shiki_natsume_v17_wd14_curated.json"
TARGET = ROOT / "training_configs" / "shiki_natsume_v18_wd14_balanced_r18.json"


def main() -> None:
    config = json.loads(SOURCE.read_text(encoding="utf-8"))
    config["workspace_dir"] = str(ROOT / "workspace" / "shiki_natsume_v18_wd14_balanced_r18")
    config["output_model_destination"] = str(ROOT / "output" / "shiki_natsume_v18_wd14_balanced_r18.safetensors")
    config["tensorboard"] = False
    config["sample_after"] = 40
    config["backup_after"] = 20
    config["save_every"] = 20
    config["save_filename_prefix"] = "shiki_natsume_v18_wd14_balanced_r18"
    for concept in config["concepts"]:
        concept["name"] = str(concept["name"]).replace("v17", "v18")
        if "identity_r18" in concept["name"]:
            concept["loss_weight"] = 0.4
        else:
            concept["loss_weight"] = 1.0
    TARGET.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    provenance = {
        "schema": "ai-cg-studio.natsume-v18-balanced-r18-config/v1",
        "source_config": str(SOURCE),
        "only_training_change": "identity_r18 concept loss_weight 1.0 -> 0.4",
        "reason": "official R18 CG has no honest full-body frame; reduce crop association while retaining the unified gate",
        "epochs": config["epochs"],
    }
    TARGET.with_suffix(".provenance.json").write_text(
        json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(TARGET)


if __name__ == "__main__":
    main()
