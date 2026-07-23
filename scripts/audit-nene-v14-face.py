"""Blindly compare Nene's face-only refinement checkpoints."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


SOURCE = Path(__file__).with_name("audit-character-identity.py")
SPEC = importlib.util.spec_from_file_location("nene_face_audit", SOURCE)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {SOURCE}")
audit = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = audit
SPEC.loader.exec_module(audit)

audit.OUTPUT = Path(r"E:\code\2\lora\AI\Reviews\ModelEvaluations\nene_v14_face_gate_2026-07-22")
nene = audit.CHARACTERS["nene"]
nene["weight"] = 0.80
nene["candidates"] = {
    "v13-e15": "ayachi_nene_v13_e15_audit",
    "v14f-e1": "ayachi_nene_v14f_e1_audit",
    "v14f-e2": "ayachi_nene_v14f_e2_audit",
    "v14f-e4": "ayachi_nene_v14f_e4_audit",
    "v14f-e6": "ayachi_nene_v14f_e6_audit",
}
audit.CHARACTERS = {"nene": nene}


if __name__ == "__main__":
    audit.main()
