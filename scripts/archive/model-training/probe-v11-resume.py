"""Diagnose unmatched layers while restoring a LoRA in OneTrainer.

Run from the OneTrainer directory.  This does not alter its source tree; it
only wraps the in-memory hook method long enough to print unmatched keys.
"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path


ONE_TRAINER_ROOT = Path(r"E:\code\2\lora\AI\OneTrainer")
sys.path.insert(0, str(ONE_TRAINER_ROOT))
sys.path.insert(0, str(ONE_TRAINER_ROOT / "scripts"))

from modules.module.LoRAModule import LoRAModuleWrapper


original_hook = LoRAModuleWrapper.hook_to_module


def probe_hook(self: LoRAModuleWrapper):
    unmatched = [
        name
        for name, module in self.lora_modules.items()
        if isinstance(module, self.dummy_klass)
    ]
    print(
        "V11_RESUME_PROBE",
        self.prefix,
        f"dummy_count={len(unmatched)}",
        f"names={unmatched[:40]}",
    )
    return original_hook(self)


LoRAModuleWrapper.hook_to_module = probe_hook
sys.argv = ["train.py", "--config-path", str(ONE_TRAINER_ROOT / "training_configs" / "ayachi_nene_v13_refine.json")]
runpy.run_path(str(ONE_TRAINER_ROOT / "scripts" / "train.py"), run_name="__main__")
