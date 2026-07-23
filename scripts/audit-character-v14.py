"""Blindly compare v14 identity-refinement checkpoints with the prior winner."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


SOURCE = Path(__file__).with_name("audit-character-identity.py")
SPEC = importlib.util.spec_from_file_location("identity_audit", SOURCE)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {SOURCE}")
audit = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = audit
SPEC.loader.exec_module(audit)

audit.OUTPUT = Path(r"E:\code\2\lora\AI\Reviews\ModelEvaluations\identity_v14_gate_2026-07-22")
audit.CHARACTERS["nene"]["weight"] = 0.80
audit.CHARACTERS["nene"]["candidates"] = {
    "v13-e15": "ayachi_nene_v13_e15_audit",
    "v14-e3": "ayachi_nene_v14_e3_audit",
    "v14-e6": "ayachi_nene_v14_e6_audit",
    "v14-e9": "ayachi_nene_v14_e9_audit",
    "v14-e12": "ayachi_nene_v14_e12_audit",
}
audit.CHARACTERS["natsume"]["weight"] = 0.95
audit.CHARACTERS["natsume"]["candidates"] = {
    "v13-e15": "shiki_natsume_v13_e15_audit",
    "v14-e3": "shiki_natsume_v14_e3_audit",
    "v14-e6": "shiki_natsume_v14_e6_audit",
    "v14-e9": "shiki_natsume_v14_e9_audit",
    "v14-e12": "shiki_natsume_v14_e12_audit",
}


if __name__ == "__main__":
    audit.main()
