"""Run a fixed-seed blind identity gate for Natsume v17 WD14 versus v15."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import random
import re
import sys
from pathlib import Path


SOURCE_PATH = Path(__file__).with_name("audit-nene-v16.py")
SPEC = importlib.util.spec_from_file_location("natsume_v17_base_audit", SOURCE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {SOURCE_PATH}")
SOURCE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = SOURCE
SPEC.loader.exec_module(SOURCE)

OUTPUT_ROOT = Path(r"E:\code\2\lora\AI\Reviews\ModelEvaluations\natsume_v17_wd14_gate_2026-07-30")
OUTPUT_TAG = os.environ.get("NATSUME_V17_GATE_TAG", "final")
if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", OUTPUT_TAG):
    raise RuntimeError("invalid NATSUME_V17_GATE_TAG")
EVAL_LORA_PATH = Path(r"E:\code\2\lora\AI\Data\Models\Lora\shiki_natsume_v17_wd14_eval.safetensors")

SOURCE.OUTPUT = OUTPUT_ROOT / OUTPUT_TAG
SOURCE.CANDIDATES = [
    SOURCE.Candidate("v15-0.75", "shiki_natsume_v15", 0.75),
    SOURCE.Candidate("v15-0.90", "shiki_natsume_v15", 0.90),
    SOURCE.Candidate("v17-0.65", "shiki_natsume_v17_wd14_eval", 0.65),
    SOURCE.Candidate("v17-0.75", "shiki_natsume_v17_wd14_eval", 0.75),
]
quality = SOURCE.QUALITY
identity = "adult woman, 1girl, solo, shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip"
refs = Path(r"E:\code\2\lora\AI\Datasets\Characters\Shiki_Natsume\V12_Curated")
SOURCE.TESTS = [
    SOURCE.Test("face-minimal-trigger", f"{quality}, adult woman, 1girl, solo, shiki_natsume, head_and_shoulders, centered_face, frontal_view, looking_at_viewer, calm_expression, closed_mouth, simple_background, soft_even_lighting", refs / "v12_stand_01.png", "face", "nsfw, nude, nipples, explicit, sexual"),
    SOURCE.Test("face-three-quarter", f"{quality}, {identity}, close-up_portrait, three-quarter_view, looking_at_viewer, reserved_gentle_smile, light_blush, simple_background, soft_even_lighting", refs / "v12_cg_03.png", "face", "nsfw, nude, nipples, explicit, sexual"),
    SOURCE.Test("body-casual-generalization", f"{quality}, {identity}, full_body, standing, casual_summer_dress, natural_body_proportions, simple_background, soft_even_lighting", refs / "v12_stand_01.png", "full", "nsfw, nude, nipples, explicit, sexual"),
    SOURCE.Test("qipao-canonical-full-body", f"{quality}, {identity}, natsume_official_qipao, full_body, standing, chinese_clothes, china_dress, red_dress, gold_trim, floral_print, double_bun, red_flower, side_slit, black_pantyhose, black_footwear, looking_at_viewer, simple_background", refs / "v12_stand_03.png", "full", "nsfw, nude, nipples, explicit, sexual"),
    SOURCE.Test("ordinary-safe-no-leakage", f"{quality}, {identity}, fully_clothed, white_blouse, long_skirt, bookstore_interior, reading_a_book, warm_afternoon_light", refs / "v12_stand_01.png", "face", "nsfw, nude, topless, nipples, explicit, sexual, underwear_only"),
    SOURCE.Test("r18-solo-body-identity", f"{quality}, {identity}, natsume_r18, nude, full_body, standing, solo, looking_at_viewer, natural_body_proportions, accurate_anatomy, soft_even_lighting, simple_bedroom_background", refs / "v12_stand_01.png", "full", "clothes, dress, china_dress, multiple_girls, 1boy, censored"),
]


def blind_mapping(test_name: str, seed: int) -> dict[str, str]:
    versions = [candidate.code_name for candidate in SOURCE.CANDIDATES]
    random.Random(f"natsume-v17-wd14-{test_name}-{seed}-2026-07-30").shuffle(versions)
    return dict(zip(("A", "B", "C", "D"), versions, strict=True))


def artifact() -> dict[str, str]:
    if not EVAL_LORA_PATH.is_file():
        raise RuntimeError(f"missing evaluated artifact: {EVAL_LORA_PATH}")
    digest = hashlib.sha256(EVAL_LORA_PATH.read_bytes()).hexdigest()
    return {"path": str(EVAL_LORA_PATH), "sha256": digest, "bytes": str(EVAL_LORA_PATH.stat().st_size)}


SOURCE.blind_mapping = blind_mapping


def main() -> None:
    evaluated = artifact()
    SOURCE.OUTPUT.mkdir(parents=True, exist_ok=True)
    record = SOURCE.OUTPUT / "evaluated-artifact.json"
    if record.exists() and json.loads(record.read_text(encoding="utf-8")) != evaluated:
        raise RuntimeError("output tag already belongs to another artifact")
    record.write_text(json.dumps(evaluated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    options = SOURCE.validate_environment()
    records = SOURCE.generate()
    mappings = SOURCE.make_sheets(records)
    manifest = {
        "schema": "ai-cg-studio.natsume-v17-wd14-manual-gate.v1",
        "purpose": "fixed-seed blinded v15/v17 identity, body, qipao, safe and R18 comparison",
        "evaluated_lora_artifact": evaluated,
        "priority": {"face_and_facial_proportions": 0.45, "body_and_character_features": 0.20, "non_official_outfit_generalization": 0.10, "canonical_qipao": 0.15, "r18_identity_and_body": 0.10},
        "hard_gates": {"critical_identity_error": 0, "v17_face_not_worse_than_v15": True, "ordinary_prompt_r18_leakage": 0, "qipao_full_body_pass_rate": 0.67},
        "webui_options": {"sd_model_checkpoint": options.get("sd_model_checkpoint"), "CLIP_stop_at_last_layers": options.get("CLIP_stop_at_last_layers")},
        "blind_mappings": mappings,
        "records": records,
    }
    (SOURCE.OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(SOURCE.OUTPUT, flush=True)


if __name__ == "__main__":
    main()
