"""Focused blind gate for Natsume v17 intermediate checkpoints."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import random
import sys
from pathlib import Path


SOURCE_PATH = Path(__file__).with_name("audit-nene-v16.py")
SPEC = importlib.util.spec_from_file_location("natsume_checkpoint_audit", SOURCE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {SOURCE_PATH}")
SOURCE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = SOURCE
SPEC.loader.exec_module(SOURCE)

MODEL_DIR = Path(r"E:\code\2\lora\AI\Data\Models\Lora")
OUTPUT = Path(r"E:\code\2\lora\AI\Reviews\ModelEvaluations\natsume_v17_wd14_gate_2026-07-30\checkpoint_focus")
ARTIFACTS = {
    "v17-e60-0.65": MODEL_DIR / "shiki_natsume_v17_e60_eval.safetensors",
    "v17-e120-0.65": MODEL_DIR / "shiki_natsume_v17_e120_eval.safetensors",
    "v17-final-0.65": MODEL_DIR / "shiki_natsume_v17_wd14_eval.safetensors",
}

SOURCE.OUTPUT = OUTPUT
SOURCE.CANDIDATES = [
    SOURCE.Candidate("v15-0.90", "shiki_natsume_v15", 0.90),
    SOURCE.Candidate("v17-e60-0.65", "shiki_natsume_v17_e60_eval", 0.65),
    SOURCE.Candidate("v17-e120-0.65", "shiki_natsume_v17_e120_eval", 0.65),
    SOURCE.Candidate("v17-final-0.65", "shiki_natsume_v17_wd14_eval", 0.65),
]
quality = SOURCE.QUALITY
identity = "adult woman, 1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip"
refs = Path(r"E:\code\2\lora\AI\Datasets\Characters\Shiki_Natsume\V12_Curated")
SOURCE.TESTS = [
    SOURCE.Test("face-minimal-trigger", f"{quality}, adult woman, 1girl, solo, shiki_natsume, head_and_shoulders, centered_face, frontal_view, looking_at_viewer, calm_expression, closed_mouth, simple_background, soft_even_lighting", refs / "v12_stand_01.png", "face", "nsfw, nude, nipples, explicit, sexual"),
    SOURCE.Test("body-casual-generalization", f"{quality}, {identity}, full_body, standing, casual_summer_dress, natural_body_proportions, simple_background, soft_even_lighting", refs / "v12_stand_01.png", "full", "nsfw, nude, nipples, explicit, sexual"),
    SOURCE.Test("r18-solo-body-identity", f"{quality}, {identity}, natsume_r18, nude, full_body, standing, solo, looking_at_viewer, natural_body_proportions, accurate_anatomy, soft_even_lighting, simple_bedroom_background", refs / "v12_stand_01.png", "full", "clothes, dress, china_dress, multiple_girls, 1boy, censored"),
]


def blind_mapping(test_name: str, seed: int) -> dict[str, str]:
    versions = [candidate.code_name for candidate in SOURCE.CANDIDATES]
    random.Random(f"natsume-v17-checkpoints-{test_name}-{seed}-2026-07-30").shuffle(versions)
    return dict(zip(("A", "B", "C", "D"), versions, strict=True))


SOURCE.blind_mapping = blind_mapping


def main() -> None:
    hashes = {}
    for code, path in ARTIFACTS.items():
        if not path.is_file():
            raise RuntimeError(f"missing checkpoint artifact: {path}")
        hashes[code] = {"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    options = SOURCE.validate_environment()
    records = SOURCE.generate()
    mappings = SOURCE.make_sheets(records)
    manifest = {
        "schema": "ai-cg-studio.natsume-v17-checkpoint-focus.v1",
        "purpose": "test whether an earlier checkpoint preserves face gains without final R18 framing regression",
        "artifacts": hashes,
        "webui_options": {"sd_model_checkpoint": options.get("sd_model_checkpoint")},
        "blind_mappings": mappings,
        "records": records,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(OUTPUT, flush=True)


if __name__ == "__main__":
    main()
