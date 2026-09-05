"""Run the fixed-seed blind gate for the unified Nene v18 WD14 LoRA.

The gate compares v18 directly with v16, because v16 is the current facial
identity benchmark.  It covers minimal-trigger faces, canonical full-body
clothes, safe-prompt leakage, and an explicit ``nene_r18`` body/identity test.

Before running, copy the finished v18 artifact into the WebUI LoRA directory
as ``ayachi_nene_v18_wd14_eval.safetensors``.
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
SPEC = importlib.util.spec_from_file_location("nene_v18_base_audit", SOURCE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {SOURCE_PATH}")
SOURCE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = SOURCE
SPEC.loader.exec_module(SOURCE)

OUTPUT_ROOT = Path(
    r"E:\code\2\lora\AI\Reviews\ModelEvaluations\nene_v18_wd14_gate_2026-07-30"
)
OUTPUT_TAG = os.environ.get("NENE_V18_GATE_TAG", "final")
if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", OUTPUT_TAG):
    raise RuntimeError("NENE_V18_GATE_TAG must use lowercase letters, numbers, _ or -")

EVAL_LORA_PATH = Path(
    r"E:\code\2\lora\AI\Data\Models\Lora\ayachi_nene_v18_wd14_eval.safetensors"
)

SOURCE.OUTPUT = OUTPUT_ROOT / OUTPUT_TAG
SOURCE.CANDIDATES = [
    SOURCE.Candidate("v16-0.70", "ayachi_nene_v16_eval", 0.70),
    SOURCE.Candidate("v16-0.80", "ayachi_nene_v16_eval", 0.80),
    SOURCE.Candidate("v18-0.65", "ayachi_nene_v18_wd14_eval", 0.65),
    SOURCE.Candidate("v18-0.75", "ayachi_nene_v18_wd14_eval", 0.75),
]

quality = SOURCE.QUALITY
identity = (
    "adult woman, 1girl, solo, ayachi_nene, white_hair, very_long_hair, "
    "low_twintails, purple_eyes, ahoge, hair_ribbon"
)
refs = SOURCE.REFERENCES
SOURCE.TESTS = [
    SOURCE.Test(
        "face-minimal-trigger",
        f"{quality}, adult woman, 1girl, solo, ayachi_nene, head_and_shoulders, "
        "centered_face, frontal_view, looking_at_viewer, calm_gentle_expression, "
        "closed_mouth, simple_background, soft_even_lighting",
        refs / "nene_stand_02.png",
        "face",
        "nsfw, nude, nipples, explicit, sexual",
    ),
    SOURCE.Test(
        "face-three-quarter",
        f"{quality}, {identity}, close-up_portrait, three-quarter_view, "
        "looking_at_viewer, shy_gentle_smile, light_blush, simple_background, "
        "soft_even_lighting",
        refs / "nene_stand_03.png",
        "face",
        "nsfw, nude, nipples, explicit, sexual",
    ),
    SOURCE.Test(
        "school-canonical-full-body",
        f"{quality}, {identity}, nene_school_uniform, full_body, standing, "
        "school_uniform, navy_blazer, gold_trim, gold_buttons, white_shirt, "
        "yellow_bow, plaid_skirt, pleated_skirt, black_thighhighs, mary_janes, "
        "fully_clothed, looking_at_viewer, simple_background, soft_even_lighting",
        refs / "nene_stand_02.png",
        "full",
        "nsfw, nude, nipples, explicit, sexual",
    ),
    SOURCE.Test(
        "witch-canonical-full-body",
        f"{quality}, {identity}, nene_witch_canonical, full_body, standing, "
        "witch_hat, black_cape, pink_ribbon, pink_bow, striped_bow, "
        "criss-cross_halter, crop_top, strap_between_breasts, black_skirt, "
        "asymmetrical_legwear, striped_thighhighs, single_thighhigh, "
        "single_sock, white_socks, frilled_socks, black_footwear, boots, "
        "looking_at_viewer, simple_background",
        refs / "nene_stand_01.png",
        "full",
        "two_striped_stockings, symmetric_legwear, nsfw, nude, nipples, explicit, sexual",
    ),
    SOURCE.Test(
        "ordinary-safe-no-leakage",
        f"{quality}, {identity}, fully_clothed, casual_summer_dress, cafe_interior, "
        "gentle_smile, sitting_at_table, both_hands_visible, warm_afternoon_light",
        refs / "nene_stand_02.png",
        "face",
        "nsfw, nude, topless, nipples, explicit, sexual, underwear_only",
    ),
    SOURCE.Test(
        "r18-solo-body-identity",
        f"{quality}, {identity}, nene_r18, nude, full_body, standing, solo, "
        "looking_at_viewer, natural_body_proportions, accurate_anatomy, "
        "soft_even_lighting, simple_bedroom_background",
        refs / "nene_stand_02.png",
        "full",
        "clothes, dress, school_uniform, witch_hat, multiple_girls, 1boy, censored",
    ),
]


def blind_mapping(test_name: str, seed: int) -> dict[str, str]:
    versions = [candidate.code_name for candidate in SOURCE.CANDIDATES]
    random.Random(f"nene-v18-wd14-gate-{test_name}-{seed}-2026-07-30").shuffle(
        versions
    )
    return dict(zip(("A", "B", "C", "D"), versions, strict=True))


def describe_evaluated_lora() -> dict[str, str]:
    if not EVAL_LORA_PATH.is_file():
        raise RuntimeError(
            "missing evaluated LoRA artifact: "
            f"{EVAL_LORA_PATH}; copy the finished v18 artifact before running"
        )
    digest = hashlib.sha256()
    with EVAL_LORA_PATH.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return {
        "path": str(EVAL_LORA_PATH),
        "sha256": digest.hexdigest(),
        "bytes": str(EVAL_LORA_PATH.stat().st_size),
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
                "this output tag belongs to another checkpoint; choose a new "
                "NENE_V18_GATE_TAG"
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
        "schema": "ai-cg-studio.nene-v18-wd14-manual-gate.v1",
        "purpose": "fixed-seed blinded v16/v18 identity, clothing, safe and R18 comparison",
        "checkpoint_gate": SOURCE.EXPECTED_CHECKPOINT,
        "gate_tag": OUTPUT_TAG,
        "evaluated_lora_artifact": artifact,
        "priority": {
            "face_and_facial_proportions": 0.45,
            "canonical_school_uniform": 0.15,
            "canonical_witch_full_body": 0.20,
            "ordinary_safe_no_leakage": 0.10,
            "r18_identity_and_body_shape": 0.10,
        },
        "hard_gates": {
            "critical_identity_error": 0,
            "v18_face_not_worse_than_v16": True,
            "ordinary_prompt_r18_leakage": 0,
            "witch_asymmetrical_legwear_presence_rate": 0.67,
            "r18_requires_explicit_nene_r18": True,
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
