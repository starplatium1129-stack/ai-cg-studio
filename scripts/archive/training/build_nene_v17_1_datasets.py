#!/usr/bin/env python3
"""Build the corrected, core-only Nene v17.1 dataset.

v17's fixed-seed gate failed for two data-contract reasons: full school
screenshots included a second character, and the core captions never stated
that the subject must be a single girl.  This builder starts a fresh versioned
dataset from the same manually audited local sources; it never mutates v17.

The R18 add-on is deliberately absent.  It remains blocked until this core
passes the identity, school-uniform and canonical-witch gates.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from pathlib import Path


SOURCE_PATH = Path(__file__).with_name("build_nene_v17_datasets.py")
SPEC = importlib.util.spec_from_file_location("nene_v17_dataset_base", SOURCE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {SOURCE_PATH}")
BASE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BASE
SPEC.loader.exec_module(BASE)


TRIGGER = BASE.TRIGGER
IDENTITY = BASE.IDENTITY
FACE_IDENTITY = BASE.FACE_IDENTITY
WITCH_VISIBLE_IDENTITY = BASE.WITCH_VISIBLE_IDENTITY
SourceSpec = BASE.SourceSpec
CropSpec = BASE.CropSpec
DatasetWriter = BASE.DatasetWriter

VERSION = "v17.1"
SCHEMA = "ai-cg-studio.nene-dataset/v17.1"
WITCH_TRIGGER = "nene_witch_canonical"
SINGLE_SUBJECT = "1girl, solo"


def core_specs(ai_root: Path) -> tuple[list[SourceSpec], list[CropSpec]]:
    """Return only visually verified one-character core sources.

    The yellow-bow screenshot is used solely as a narrow torso crop.  Its raw
    full-frame version contains another character and must never re-enter the
    training set.
    """

    curated = ai_root / "Datasets" / "Characters" / "Ayachi_Nene" / "V12_Curated"
    faces = ai_root / "Datasets" / "Refinement" / "ayachi_nene_v14_identity" / "face_anchors"
    official = ai_root / "Assets" / "OfficialCG" / "绫地宁宁"

    face_caption = (
        f"{TRIGGER}, {SINGLE_SUBJECT}, {FACE_IDENTITY}, face_anchor, "
        "clean_identity_reference"
    )
    school_uniform = (
        f"{TRIGGER}, nene_school_uniform, {SINGLE_SUBJECT}, {IDENTITY}, "
        "navy_double_breasted_blazer, gold_piping, four_gold_buttons, "
        "white_shirt, grey_plaid_skirt, dark_thighhighs, mary_jane_shoes"
    )
    school_uniform_with_bow = f"{school_uniform}, yellow_neck_bow"
    witch_full = (
        f"{TRIGGER}, {WITCH_TRIGGER}, {SINGLE_SUBJECT}, official_witch_outfit, "
        f"{IDENTITY}, witch_hat, pink_hat_band, large_pink_hat_bow, black_cape, "
        "pink_lining, pink_crossover_top, black_skirt, asymmetric_legwear, "
        "black_white_striped_thighhigh, bare_other_leg, white_frilled_anklet, "
        "black_strappy_boots"
    )
    witch_upper = (
        f"{TRIGGER}, {WITCH_TRIGGER}, {SINGLE_SUBJECT}, official_witch_outfit, "
        f"{WITCH_VISIBLE_IDENTITY}, witch_hat, pink_hat_band, large_pink_hat_bow, "
        "black_cape, pink_lining, pink_crossover_top, black_skirt"
    )

    sources = [
        SourceSpec(
            "face_02",
            faces / "v12_cg_02_face.jpg",
            "identity_clean",
            face_caption,
            "v17.1 manual review: clean one-character face anchor; subject count is explicit",
            1.2,
        ),
        SourceSpec(
            "face_05",
            faces / "v12_cg_05_face.jpg",
            "identity_clean",
            face_caption,
            "v17.1 manual review: clean one-character face anchor; subject count is explicit",
            1.2,
        ),
        SourceSpec(
            "official_portrait_5002",
            official / "5002_AA.png",
            "identity_clean",
            face_caption,
            "v17.1 manual review: clean official classroom portrait with visible face and eyes",
            1.25,
        ),
        SourceSpec(
            "classroom_face_02",
            curated / "v12_cg_02.png",
            "identity_clean",
            face_caption,
            "v17.1 manual review: safe single-character classroom close-up for face proportion",
            1.2,
        ),
        SourceSpec(
            "classic_stand",
            curated / "v12_stand_02.png",
            "school_uniform",
            f"{school_uniform_with_bow}, full_body, outfit_anchor",
            "v17.1 manual review: single-character canonical navy/gold uniform full-body anchor",
            1.4,
        ),
        SourceSpec(
            "classic_event",
            curated / "v12_cg_09.png",
            "school_uniform",
            f"{school_uniform}, upper_body, event_scene",
            "v17.1 manual review: single-character school-uniform event close-up; no false full-body claim",
            1.0,
        ),
        SourceSpec(
            "witch_full_body",
            curated / "v12_stand_01.png",
            "witch_canonical",
            f"{witch_full}, full_body, outfit_anchor",
            "v17.1 manual review: sole complete canonical asymmetric-legwear source; not synthetically duplicated",
            1.5,
        ),
        SourceSpec(
            "witch_street_a",
            curated / "ScreenShot_2026-07-12_232656_703.png",
            "witch_canonical",
            f"{witch_upper}, upper_body, street_scene",
            "v17.1 manual review: clean single-character witch upper-outfit view; no unseen-leg tags",
            0.85,
        ),
        SourceSpec(
            "witch_street_b",
            curated / "ScreenShot_2026-07-12_232707_089.png",
            "witch_canonical",
            f"{witch_upper}, upper_body, street_scene",
            "v17.1 manual review: second clean witch upper-outfit view; no unseen-leg tags",
            0.8,
        ),
        SourceSpec(
            "holdout_green_pose",
            curated / "ScreenShot_2026-07-12_232539_911.png",
            "validation",
            f"{TRIGGER}, {SINGLE_SUBJECT}, {FACE_IDENTITY}, green_dress, fully_clothed, validation_holdout",
            "v17.1 fixed validation only: not a trained outfit concept",
            1.0,
        ),
    ]
    crops = [
        CropSpec(
            "classic_torso",
            curated / "v12_stand_02.png",
            "school_uniform",
            (90, 50, 745, 785),
            f"{school_uniform_with_bow}, upper_body, blazer_detail, outfit_anchor",
            "v17.1 manual review: closed navy blazer, gold piping and visible yellow bow",
            1.25,
        ),
        CropSpec(
            "classic_legs",
            curated / "v12_stand_02.png",
            "school_uniform",
            (135, 525, 705, 1195),
            f"{TRIGGER}, nene_school_uniform, {SINGLE_SUBJECT}, grey_plaid_skirt, dark_thighhighs, mary_jane_shoes, legwear_anchor",
            "v17.1 manual review: canonical skirt, thighhigh and shoe geometry",
            1.05,
        ),
        CropSpec(
            "yellow_bow_single_torso",
            curated / "ScreenShot_2026-07-12_232821_187.png",
            "school_uniform",
            (45, 60, 540, 710),
            f"{school_uniform_with_bow}, upper_body, yellow_neck_bow_detail",
            "v17.1 manual review: tight crop deliberately excludes the second background character",
            1.0,
        ),
        CropSpec(
            "witch_hat_torso",
            curated / "v12_stand_01.png",
            "witch_canonical",
            (85, 0, 750, 810),
            f"{witch_upper}, upper_body, witch_hat_detail, cape_detail",
            "v17.1 manual review: hat, pink band, cape and crossover-top detail",
            1.15,
        ),
        CropSpec(
            "witch_legs",
            curated / "v12_stand_01.png",
            "witch_leg_detail",
            (135, 455, 710, 1210),
            f"{TRIGGER}, {WITCH_TRIGGER}, {SINGLE_SUBJECT}, official_witch_outfit, asymmetric_legwear, black_white_striped_thighhigh, bare_other_leg, white_frilled_anklet, black_strappy_boots, legwear_anchor",
            "v17.1 manual review: exact canonical striped-thighhigh, bare-leg and frilled-anklet construction",
            1.5,
        ),
    ]
    return sources, crops


def validate_v17_1(entries: list[dict[str, object]]) -> None:
    BASE.validate_core(entries)
    missing_single_subject = [
        str(entry["file"])
        for entry in entries
        if "1girl" not in str(entry["caption"]) or "solo" not in str(entry["caption"])
    ]
    if missing_single_subject:
        raise RuntimeError(f"v17.1 core captions must state one subject: {missing_single_subject}")
    witch_entries = [entry for entry in entries if str(entry["category"]).startswith("witch_")]
    if not witch_entries or any(WITCH_TRIGGER not in str(entry["caption"]) for entry in witch_entries):
        raise RuntimeError("Every canonical-witch entry must carry nene_witch_canonical")


def build(ai_root: Path, *, force: bool) -> dict[str, object]:
    root = ai_root / "Datasets" / VERSION
    writer = DatasetWriter(root / "nene-core", force=force)
    sources, crops = core_specs(ai_root)
    for source in sources:
        writer.add_copy(source)
    for crop in crops:
        writer.add_crop(crop)
    validate_v17_1(writer.entries)
    manifest_path = writer.write_manifest(
        {
            "schema": SCHEMA,
            "dataset": "nene-core",
            "version": VERSION,
            "base_model": "waiIllustriousSDXL_v170.safetensors",
            "trigger": TRIGGER,
            "witch_trigger": WITCH_TRIGGER,
            "r18_policy": "No R18 image, R18 token or R18 add-on is permitted before core passes its fixed-seed gate.",
            "caption_contract": {
                "single_subject": SINGLE_SUBJECT,
                "school_trigger": "nene_school_uniform",
                "canonical_witch_trigger": WITCH_TRIGGER,
                "prohibited_raw_school_sources": [
                    "ScreenShot_2026-07-12_232821_187.png",
                    "ScreenShot_2026-07-12_232832_012.png",
                ],
            },
            "manual_review": {
                "review_date": "2026-07-29",
                "method": "local per-image visual inspection",
                "known_limit": "Only one distinct non-R18 source shows the full canonical witch legwear; its crop is an anchor, not a separate pose.",
            },
        }
    )
    summary = {
        "schema": "ai-cg-studio.nene-v17.1-build",
        "core": {
            "path": str(manifest_path.parent),
            "manifest": str(manifest_path),
            "counts": json.loads(manifest_path.read_text(encoding="utf-8"))["counts"],
        },
        "r18_addon": "blocked pending core fixed-seed gate",
    }
    (root / "build-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ai-root", type=Path, required=True)
    parser.add_argument("--force", action="store_true", help="Deliberately rebuild v17.1 only")
    args = parser.parse_args()
    print(json.dumps(build(args.ai_root.resolve(), force=args.force), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
