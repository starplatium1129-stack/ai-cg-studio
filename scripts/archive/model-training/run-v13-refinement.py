"""Run a v13 OneTrainer job with an isolated SDXL dual-text-encoder fix.

The installed OneTrainer revision tests ``startswith("text_encoder")`` while
loading a LoRA.  For SDXL that lets ``text_encoder_2.*`` leak into the first
encoder wrapper, creating dummy modules that cannot be hooked.  The wrapper
below narrows every incoming state dictionary to the exact dotted prefix before
delegating to OneTrainer.  It changes nothing in the OneTrainer installation.
"""

from __future__ import annotations

import argparse
import runpy
import sys
from pathlib import Path


ONE_TRAINER_ROOT = Path(r"E:\code\2\lora\AI\OneTrainer")
sys.path.insert(0, str(ONE_TRAINER_ROOT))
sys.path.insert(0, str(ONE_TRAINER_ROOT / "scripts"))

from modules.module.LoRAModule import LoRAModuleWrapper


original_load_state_dict = LoRAModuleWrapper.load_state_dict


def load_state_dict_with_exact_component_prefix(self: LoRAModuleWrapper, state_dict, *args, **kwargs):
    exact_prefix = f"{self.prefix}."
    component_state = {key: value for key, value in state_dict.items() if key.startswith(exact_prefix)}
    return original_load_state_dict(self, component_state, *args, **kwargs)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config-path", required=True, type=Path)
    args = parser.parse_args()
    config_path = args.config_path.resolve()
    if not config_path.is_file():
        raise FileNotFoundError(config_path)

    LoRAModuleWrapper.load_state_dict = load_state_dict_with_exact_component_prefix
    sys.argv = ["train.py", "--config-path", str(config_path)]
    runpy.run_path(str(ONE_TRAINER_ROOT / "scripts" / "train.py"), run_name="__main__")


if __name__ == "__main__":
    main()
