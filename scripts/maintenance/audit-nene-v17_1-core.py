"""Run the fixed-seed blind gate for the corrective Nene v17.1 core LoRA.

This is intentionally a new audit namespace.  It binds every result to the
selected eval artifact, uses a v17.1-specific blind shuffle, and requires the
new ``nene_witch_canonical`` trigger for the exact outfit regression.
"""

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
SPEC = importlib.util.spec_from_file_location("nene_v17_1_base_audit", SOURCE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {SOURCE_PATH}")
SOURCE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = SOURCE
SPEC.loader.exec_module(SOURCE)


OUTPUT_ROOT = Path(
    r"E:\code\2\lora\AI\Reviews\ModelEvaluations\nene_v17_1_core_gate_2026-07-29"
)
OUTPUT_TAG = os.environ.get("NENE_V17_1_GATE_TAG", "final")
if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", OUTPUT_TAG):
    raise RuntimeError("NENE_V17_1_GATE_TAG must use lowercase letters, numbers, _ or -")

EVAL_LORA_PATH = Path(
    r"E:\code\2\lora\AI\Data\Models\Lora\ayachi_nene_v17_1_core_eval.safetensors"
)
TRAINING_FINAL_LORA_PATH = Path(
    r"E:\code\2\lora\AI\OneTrainer\output\ayachi_nene_v17_1_core.safetensors"
)
LORA_DIRECTORY = EVAL_LORA_PATH.parent

SOURCE.OUTPUT = OUTPUT_ROOT / OUTPUT_TAG
SOURCE.CANDIDATES = [
    SOURCE.Candidate("v15-0.80", "ayachi_nene_v15", 0.80),
    SOURCE.Candidate("v16-0.70", "ayachi_nene_v16_eval", 0.70),
    SOURCE.Candidate("v17_1-0.55", "ayachi_nene_v17_1_core_eval", 0.55),
    SOURCE.Candidate("v17_1-0.65", "ayachi_nene_v17_1_core_eval", 0.65),
]

quality = SOURCE.QUALITY
identity = (
    "adult woman, 1girl, solo, ayachi_nene, white_hair, very_long_hair, "
    "low_twintails, purple_eyes, ahoge, pink_hair_ribbons"
)
refs = SOURCE.REFERENCES
SOURCE.NEGATIVE = (
    SOURCE.NEGATIVE
    + ", nsfw, nude, topless, nipples, explicit, sexual, sex, intercourse, "
    "uncensored, underwear_only"
)
SOURCE.TESTS = [
    SOURCE.Test(
        "face-minimal-trigger",
        f"{quality}, adult woman, 1girl, solo, ayachi_nene, head_and_shoulders, "
        "centered_face, frontal_view, looking_at_viewer, calm_gentle_expression, "
        "closed_mouth, simple_background, soft_even_lighting",
        refs / "nene_stand_02.png",
        "face",
    ),
    SOURCE.Test(
        "school-canonical-covered",
        f"{quality}, {identity}, full_body, standing, nene_school_uniform, "
        "navy_double_breasted_blazer, gold_piping, four_gold_buttons, white_shirt, "
        "yellow_neck_bow, grey_plaid_skirt, dark_thighhighs, mary_jane_shoes, "
        "fully_clothed, looking_at_viewer, simple_background, soft_even_lighting",
        refs / "nene_stand_02.png",
    ),
    SOURCE.Test(
        "witch-exact-legwear",
        f"{quality}, {identity}, full_body, standing, nene_witch_canonical, "
        "official_witch_outfit, witch_hat, pink_hat_band, large_pink_hat_bow, "
        "black_cape, pink_lining, pink_crossover_top, black_skirt, asymmetric_legwear, "
        "black_white_striped_thighhigh, exactly_one_black_and_white_striped_thighhigh, "
        "bare_other_leg, white_frilled_anklet, black_strappy_boots, "
        "holding_silver_handgun_downward, looking_at_viewer, simple_background",
        refs / "nene_stand_01.png",
        "full",
        "two_striped_stockings, symmetric_legwear, black_solid_thighhigh, long_white_stocking",
    ),
    SOURCE.Test(
        "witch-scene-generalization",
        f"{quality}, {identity}, full_body, dynamic_three_quarter_pose, "
        "nene_witch_canonical, official_witch_outfit, witch_hat, pink_hat_band, "
        "black_cape, pink_lining, pink_crossover_top, black_skirt, asymmetric_legwear, "
        "black_white_striped_thighhigh, exactly_one_black_and_white_striped_thighhigh, "
        "bare_other_leg, white_frilled_anklet, black_strappy_boots, "
        "holding_silver_handgun_downward, casting_purple_magic, moonlit_classroom, "
        "cinematic_rim_light, detailed_background",
        refs / "nene_stand_01.png",
        "full",
        "two_striped_stockings, symmetric_legwear, black_solid_thighhigh, long_white_stocking, "
        "empty_background, character_reference_sheet, decorative_frame",
    ),
    SOURCE.Test(
        "ordinary-safe-generalization",
        f"{quality}, {identity}, fully_clothed, casual_summer_dress, cafe_interior, "
        "gentle_smile, sitting_at_table, both_hands_visible, warm_afternoon_light",
        refs / "nene_stand_02.png",
        "face",
    ),
]


def blind_mapping(test_name: str, seed: int) -> dict[str, str]:
    versions = [candidate.code_name for candidate in SOURCE.CANDIDATES]
    random.Random(f"nene-v17-1-core-gate-{test_name}-{seed}-2026-07-29").shuffle(
        versions
    )
    return dict(zip(("A", "B", "C", "D"), versions, strict=True))


def describe_artifact(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise RuntimeError(f"missing LoRA artifact: {path}")
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return {
        "path": str(path),
        "sha256": digest.hexdigest(),
        "bytes": str(path.stat().st_size),
    }


def describe_evaluated_lora() -> dict[str, object]:
    training_output = describe_artifact(TRAINING_FINAL_LORA_PATH)
    eval_copy = describe_artifact(EVAL_LORA_PATH)
    if training_output["sha256"] != eval_copy["sha256"]:
        raise RuntimeError(
            "the eval copy does not match the final training output; recopy it before running"
        )

    candidate_artifacts: dict[str, dict[str, str]] = {}
    for candidate in SOURCE.CANDIDATES:
        if candidate.lora in candidate_artifacts:
            continue
        candidate_path = LORA_DIRECTORY / f"{candidate.lora}.safetensors"
        candidate_artifacts[candidate.lora] = describe_artifact(candidate_path)

    return {
        "training_output": training_output,
        "eval_copy": eval_copy,
        "candidate_artifacts": candidate_artifacts,
    }


SOURCE.blind_mapping = blind_mapping


def main() -> None:
    artifact = describe_evaluated_lora()
    SOURCE.OUTPUT.mkdir(parents=True, exist_ok=True)
    artifact_record = SOURCE.OUTPUT / "evaluated-artifact.json"
    if artifact_record.exists():
        prior = json.loads(artifact_record.read_text(encoding="utf-8"))
        if prior != artifact:
            raise RuntimeError(
                "this output tag already belongs to a different checkpoint; "
                "choose a new NENE_V17_1_GATE_TAG"
            )
    else:
        artifact_record.write_text(
            json.dumps(artifact, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    options = SOURCE.validate_environment()
    records = SOURCE.generate()
    mappings = SOURCE.make_sheets(records)
    manifest = {
        "schema": "ai-cg-studio.nene-v17.1-core-manual-gate.v1",
        "purpose": "fixed-seed blinded comparison of v15, v16 and corrected v17.1 core",
        "checkpoint_gate": SOURCE.EXPECTED_CHECKPOINT,
        "gate_tag": OUTPUT_TAG,
        "evaluated_lora_artifact": artifact,
        "priority": {
            "face_and_facial_proportions": 0.35,
            "canonical_school_uniform": 0.20,
            "canonical_witch_outfit_and_asymmetric_legwear": 0.25,
            "ordinary_non_r18_generalization": 0.20,
        },
        "hard_gates": {
            "critical_identity_error": 0,
            "ordinary_prompt_r18_leakage": 0,
            "covered_school_uniform_pass_rate": 0.67,
            "witch_asymmetrical_legwear_presence_rate": 0.67,
        },
        "webui_options": {
            "sd_model_checkpoint": options.get("sd_model_checkpoint"),
            "CLIP_stop_at_last_layers": options.get("CLIP_stop_at_last_layers"),
        },
        "blind_mappings": mappings,
        "records": records,
    }
    (SOURCE.OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(SOURCE.OUTPUT, flush=True)


if __name__ == "__main__":
    main()
