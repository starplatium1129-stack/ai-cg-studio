#!/usr/bin/env python3
"""Build the retired isolated Nene v17 core and R18-add-on datasets.

The v16 audit showed that adult examples were captioned with the same generic
school-uniform token as normal examples.  This builder deliberately changes
the training contract:

* ``nene-core`` contains no adult samples and is the only default candidate.
* ``nene-r18-addon`` contains adult samples that *all* carry ``nene_r18``.
  It also includes clean, fully-clothed identity anchors without that token as
  contrast examples.  At inference the add-on is loaded only for R18 mode and
  ``nene_r18`` is required in the positive prompt.

The source list was selected through the manual v17 visual audit.  In
particular, transparent reference mattes, the 5018 gun-background near
duplicates, and red-cardigan frames mislabeled as the generic school uniform are not
used as classic-outfit anchors.  The script only creates new versioned output
directories; it refuses to overwrite them unless ``--force`` is deliberate.

This historical builder is quarantined behind ``--allow-retired-v17``.  New
Nene work uses one unified v18 dataset and one LoRA, not a separate add-on.

Run with the OneTrainer virtualenv Python because it provides Pillow for the
small, auditable detail crops:

    E:\\code\\2\\lora\\AI\\OneTrainer\\venv\\Scripts\\python.exe \
      scripts\\training\\build_nene_v17_datasets.py --ai-root E:\\code\\2\\lora\\AI
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


IDENTITY = (
    "white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, "
    "pink_hair_ribbons"
)
FACE_IDENTITY = "white_hair, purple_eyes"
WITCH_VISIBLE_IDENTITY = "white_hair, very_long_hair, purple_eyes"
TRIGGER = "ayachi_nene"
R18_TRIGGER = "nene_r18"
SCHEMA = "ai-cg-studio.nene-dataset/v17"


@dataclass(frozen=True)
class SourceSpec:
    """One manually inspected source item with its explicit caption policy."""

    slug: str
    source: Path
    category: str
    caption: str
    reason: str
    loss_weight: float = 1.0


@dataclass(frozen=True)
class CropSpec:
    """A detail crop derived from an already approved source image."""

    slug: str
    source: Path
    category: str
    box: tuple[int, int, int, int]
    caption: str
    reason: str
    loss_weight: float = 1.0


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_source(path: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError(f"Audited source no longer exists: {path}")
    return path


def normalize_caption(caption: str) -> str:
    return ", ".join(part.strip() for part in caption.split(",") if part.strip())


class DatasetWriter:
    def __init__(self, output: Path, *, force: bool) -> None:
        self.output = output
        if output.exists():
            if not force:
                raise RuntimeError(
                    f"{output} already exists; pass --force only for a deliberate rebuild"
                )
            shutil.rmtree(output)
        output.mkdir(parents=True, exist_ok=False)
        self.entries: list[dict[str, object]] = []
        self._category_counts: Counter[str] = Counter()

    def _destination(self, category: str, slug: str, suffix: str) -> Path:
        self._category_counts[category] += 1
        destination = self.output / category / f"{self._category_counts[category]:02d}_{slug}{suffix}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        return destination

    def add_copy(self, spec: SourceSpec) -> None:
        source = require_source(spec.source)
        destination = self._destination(spec.category, spec.slug, source.suffix.lower())
        shutil.copy2(source, destination)
        caption = normalize_caption(spec.caption)
        destination.with_suffix(".txt").write_text(caption + "\n", encoding="utf-8")
        self.entries.append(
            {
                "file": destination.relative_to(self.output).as_posix(),
                "kind": "source_copy",
                "source": str(source),
                "source_sha256": sha256(source),
                "category": spec.category,
                "caption": caption,
                "loss_weight": spec.loss_weight,
                "manual_audit": spec.reason,
            }
        )

    def add_crop(self, spec: CropSpec) -> None:
        # Keep Pillow lazy so the retired-script quarantine can fail before a
        # historical caller tries to initialize the old crop workflow.
        from PIL import Image

        source = require_source(spec.source)
        destination = self._destination(spec.category, spec.slug, ".png")
        with Image.open(source) as image:
            width, height = image.size
            left, top, right, bottom = spec.box
            if not (0 <= left < right <= width and 0 <= top < bottom <= height):
                raise ValueError(
                    f"Crop {spec.slug} {spec.box} is outside {source} ({width}x{height})"
                )
            # Sources are RGB in the audited selection.  Convert deliberately
            # so crop output cannot retain an alpha matte from a reference.
            image.crop(spec.box).convert("RGB").save(destination, format="PNG", optimize=True)
        caption = normalize_caption(spec.caption)
        destination.with_suffix(".txt").write_text(caption + "\n", encoding="utf-8")
        self.entries.append(
            {
                "file": destination.relative_to(self.output).as_posix(),
                "kind": "derived_crop",
                "source": str(source),
                "source_sha256": sha256(source),
                "crop_box": list(spec.box),
                "category": spec.category,
                "caption": caption,
                "loss_weight": spec.loss_weight,
                "manual_audit": spec.reason,
            }
        )

    def write_manifest(self, payload: dict[str, object]) -> Path:
        payload["entries"] = self.entries
        payload["counts"] = {
            "total": len(self.entries),
            "categories": dict(sorted(Counter(str(entry["category"]) for entry in self.entries).items())),
            "derived_crops": sum(entry["kind"] == "derived_crop" for entry in self.entries),
        }
        path = self.output / "dataset-manifest.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return path


def core_specs(ai_root: Path) -> tuple[list[SourceSpec], list[CropSpec]]:
    curated = ai_root / "Datasets" / "Characters" / "Ayachi_Nene" / "V12_Curated"
    faces = ai_root / "Datasets" / "Refinement" / "ayachi_nene_v14_identity" / "face_anchors"
    official = ai_root / "Assets" / "OfficialCG" / "绫地宁宁"

    # Face crops are deliberately captioned only with features that are
    # visible in every crop.  They are face anchors, not a license to infer
    # low twintails or pink ribbons when those details are outside the frame.
    face_caption = f"{TRIGGER}, {FACE_IDENTITY}, face_anchor, clean_identity_reference"
    school_uniform = (
        f"{TRIGGER}, nene_school_uniform, {IDENTITY}, "
        "navy_double_breasted_blazer, gold_piping, white_shirt, grey_plaid_skirt, "
        "dark_thighhighs, mary_jane_shoes"
    )
    school_uniform_with_bow = f"{school_uniform}, yellow_neck_bow"
    witch_full = (
        f"{TRIGGER}, official_witch_outfit, {IDENTITY}, witch_hat, pink_hat_band, "
        "black_cape, pink_lining, pink_crossover_top, black_skirt, "
        "asymmetric_legwear, black_white_striped_thighhigh, bare_other_leg, "
        "white_frilled_anklet, black_strappy_boots"
    )
    witch_upper = (
        f"{TRIGGER}, official_witch_outfit, {WITCH_VISIBLE_IDENTITY}, witch_hat, "
        "pink_hat_band, black_cape, pink_lining, pink_crossover_top, black_skirt"
    )

    sources: list[SourceSpec] = [
        SourceSpec(
            "face_02",
            faces / "v12_cg_02_face.jpg",
            "identity_clean",
            face_caption,
            "v17 visual audit: clean single-character face anchor; no R18 token",
            1.15,
        ),
        SourceSpec(
            "face_05",
            faces / "v12_cg_05_face.jpg",
            "identity_clean",
            face_caption,
            "v17 visual audit: clean single-character face anchor; no R18 token",
            1.15,
        ),
        SourceSpec(
            "official_portrait_5002",
            official / "5002_AA.png",
            "identity_clean",
            face_caption,
            "v17 visual audit: clean official classroom portrait with unobstructed face and eyes",
            1.2,
        ),
        SourceSpec(
            "classic_stand",
            curated / "v12_stand_02.png",
            "school_uniform",
            f"{school_uniform_with_bow}, full_body, outfit_anchor",
            "v17 visual audit: canonical navy/gold uniform full-body anchor with visible yellow bow",
            1.35,
        ),
        SourceSpec(
            "classic_event",
            curated / "v12_cg_09.png",
            "school_uniform",
            f"{school_uniform}, full_body, event_scene",
            "v17 visual audit: canonical navy/gold school scene; neckline is occluded so no false bow claim",
            1.0,
        ),
        SourceSpec(
            "yellow_bow_front",
            curated / "ScreenShot_2026-07-12_232821_187.png",
            "school_uniform",
            f"{school_uniform_with_bow}, full_body, outfit_anchor",
            "v17 visual audit: official blue uniform with visible small yellow bow",
            0.85,
        ),
        SourceSpec(
            "yellow_bow_pose",
            curated / "ScreenShot_2026-07-12_232832_012.png",
            "school_uniform",
            f"{school_uniform_with_bow}, upper_body, outfit_anchor",
            "v17 visual audit: second pose for the canonical uniform's visible yellow bow",
            0.75,
        ),
        SourceSpec(
            "witch_full_body",
            curated / "v12_stand_01.png",
            "witch_canonical",
            f"{witch_full}, full_body, outfit_anchor",
            "v17 visual audit: only clean full-body source showing the complete asymmetric legwear",
            1.5,
        ),
        SourceSpec(
            "witch_street_a",
            curated / "ScreenShot_2026-07-12_232656_703.png",
            "witch_canonical",
            f"{witch_upper}, upper_body, street_scene",
            "v17 visual audit: clean witch upper-outfit detail; no unseen legwear tags",
            0.8,
        ),
        SourceSpec(
            "witch_street_b",
            curated / "ScreenShot_2026-07-12_232707_089.png",
            "witch_canonical",
            f"{witch_upper}, upper_body, street_scene",
            "v17 visual audit: second clean witch upper-outfit pose; no 5018 background duplicate or unseen legwear tags",
            0.7,
        ),
        SourceSpec(
            "red_cardigan_variant",
            curated / "v12_stand_03.png",
            "clothed_variant",
            f"{TRIGGER}, {IDENTITY}, red_cardigan_school_variant, red_cardigan, yellow_neck_bow, black_skirt, fully_clothed",
            "v17 visual audit: official red-cardigan variant kept isolated; never labelled generic school uniform",
            0.45,
        ),
        # Held-out examples are only validation concepts, never copied into a
        # standard concept.  They make loss/preview changes easier to detect.
        SourceSpec(
            "holdout_classroom",
            curated / "v12_cg_02.png",
            "validation",
            f"{TRIGGER}, {FACE_IDENTITY}, school_scene, fully_clothed, validation_holdout",
            "v17 fixed validation holdout: identity in a non-anchor classroom composition",
            1.0,
        ),
        SourceSpec(
            "holdout_green_pose",
            curated / "ScreenShot_2026-07-12_232539_911.png",
            "validation",
            f"{TRIGGER}, {FACE_IDENTITY}, green_dress, fully_clothed, validation_holdout",
            "v17 fixed validation holdout: different clean outfit pose; hairstyle is not trained as a canonical anchor",
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
            "v17 visual audit crop: closed navy blazer, gold piping, visible yellow bow and plaid-skirt transition",
            1.2,
        ),
        CropSpec(
            "classic_legs",
            curated / "v12_stand_02.png",
            "school_uniform",
            (135, 525, 705, 1195),
            f"{TRIGGER}, nene_school_uniform, grey_plaid_skirt, dark_thighhighs, mary_jane_shoes, legwear_anchor",
            "v17 visual audit crop: canonical skirt, thighhigh and shoe geometry",
            1.0,
        ),
        CropSpec(
            "yellow_bow_torso",
            curated / "ScreenShot_2026-07-12_232821_187.png",
            "school_uniform",
            (85, 70, 655, 690),
            f"{school_uniform_with_bow}, upper_body, yellow_neck_bow_detail",
            "v17 visual audit crop: explicit yellow-bow token evidence for the canonical uniform",
            0.8,
        ),
        CropSpec(
            "witch_hat_torso",
            curated / "v12_stand_01.png",
            "witch_canonical",
            (85, 0, 750, 810),
            f"{witch_upper}, upper_body, witch_hat_detail, cape_detail",
            "v17 visual audit crop: witch hat, pink band, cape and crossover-top detail",
            1.1,
        ),
        CropSpec(
            "witch_legs",
            curated / "v12_stand_01.png",
            "witch_leg_detail",
            (135, 455, 710, 1210),
            f"{TRIGGER}, official_witch_outfit, asymmetric_legwear, black_white_striped_thighhigh, bare_other_leg, white_frilled_anklet, black_strappy_boots, legwear_anchor",
            "v17 visual audit crop: exact asymmetric striped-thighhigh / bare-leg / frilled-anklet construction",
            1.35,
        ),
    ]
    return sources, crops


def r18_specs(ai_root: Path) -> list[SourceSpec]:
    curated = ai_root / "Datasets" / "Characters" / "Ayachi_Nene" / "V12_Curated"
    faces = ai_root / "Datasets" / "Refinement" / "ayachi_nene_v14_identity" / "face_anchors"
    official = ai_root / "Assets" / "OfficialCG" / "绫地宁宁"
    # Adult frames are conditional context examples, not identity anchors.
    # Keep their visible identity vocabulary conservative: the core has the
    # canonical hairstyle/outfit evidence, while this add-on owns nene_r18.
    adult_solo = f"{TRIGGER}, {R18_TRIGGER}, mature_character, adult_context, white_hair, adult_solo"
    adult_interaction = f"{TRIGGER}, {R18_TRIGGER}, mature_character, adult_context, white_hair, adult_interaction"
    clean_identity = f"{TRIGGER}, {FACE_IDENTITY}, clean_identity_anchor"
    return [
        # These R18 sources were reviewed together in nene-v12-master-01.
        # Frames visibly tied to the school or witch core outfits are excluded
        # outright.  Omission matters as much as captioning: a visual
        # correlation can leak even if the outfit token is absent.
        SourceSpec(
            "r18_solo_green",
            curated / "ScreenShot_2026-07-12_230938_392.png",
            "adult_solo",
            adult_solo,
            "v17 visual audit: adult solo identity/body source; nene_r18 is mandatory",
            1.0,
        ),
        SourceSpec(
            "r18_interaction_blue",
            curated / "ScreenShot_2026-07-12_231154_952.png",
            "adult_interaction",
            adult_interaction,
            "v17 visual audit: adult interaction source; nene_r18 is mandatory",
            0.9,
        ),
        SourceSpec(
            "r18_solo_blue",
            curated / "ScreenShot_2026-07-12_231408_046.png",
            "adult_solo",
            adult_solo,
            "v17 visual audit: adult solo source; nene_r18 is mandatory",
            1.0,
        ),
        SourceSpec(
            "r18_solo_dark",
            curated / "ScreenShot_2026-07-12_231453_739.png",
            "adult_solo",
            adult_solo,
            "v17 visual audit: adult solo source; nene_r18 is mandatory",
            1.0,
        ),
        SourceSpec(
            "r18_interaction_red",
            curated / "ScreenShot_2026-07-12_231816_560.png",
            "adult_interaction",
            adult_interaction,
            "v17 visual audit: adult interaction source; nene_r18 is mandatory",
            0.9,
        ),
        SourceSpec(
            "r18_solo_standing",
            curated / "ScreenShot_2026-07-12_232438_895.png",
            "adult_solo",
            adult_solo,
            "v17 visual audit: full-body adult solo source; nene_r18 is mandatory",
            1.15,
        ),
        # Contrast examples: same identity, no adult tag.  These give the
        # add-on a clean side of the conditional rather than asking one token
        # to encode both identity and adult context.
        SourceSpec(
            "clean_face_02",
            faces / "v12_cg_02_face.jpg",
            "clean_identity_anchor",
            clean_identity,
            "v17 R18 contrast anchor: clean, non-R18 face source",
            1.0,
        ),
        SourceSpec(
            "clean_face_05",
            faces / "v12_cg_05_face.jpg",
            "clean_identity_anchor",
            clean_identity,
            "v17 R18 contrast anchor: clean, non-R18 face source",
            1.0,
        ),
        SourceSpec(
            "clean_official_portrait_5002",
            official / "5002_AA.png",
            "clean_identity_anchor",
            clean_identity,
            "v17 R18 contrast anchor: clean official classroom portrait, no nene_r18",
            1.05,
        ),
        SourceSpec(
            "clean_classic_full",
            curated / "v12_stand_02.png",
            "clean_identity_anchor",
            f"{TRIGGER}, {IDENTITY}, nene_school_uniform, yellow_neck_bow, full_body, clean_identity_anchor",
            "v17 R18 contrast anchor: canonical full-body clothed identity, no nene_r18",
            1.05,
        ),
        SourceSpec(
            "clean_witch_full",
            curated / "v12_stand_01.png",
            "clean_identity_anchor",
            f"{TRIGGER}, {IDENTITY}, official_witch_outfit, full_body, clean_identity_anchor",
            "v17 R18 contrast anchor: canonical witch full body, no nene_r18",
            1.05,
        ),
        SourceSpec(
            "clean_school_front",
            curated / "ScreenShot_2026-07-12_232821_187.png",
            "clean_identity_anchor",
            f"{TRIGGER}, {IDENTITY}, nene_school_uniform, yellow_neck_bow, full_body, clean_identity_anchor",
            "v17 R18 contrast anchor: second clean canonical school pose, no nene_r18",
            1.0,
        ),
        SourceSpec(
            "clean_school_pose",
            curated / "ScreenShot_2026-07-12_232832_012.png",
            "clean_identity_anchor",
            f"{TRIGGER}, {IDENTITY}, nene_school_uniform, yellow_neck_bow, clean_identity_anchor",
            "v17 R18 contrast anchor: clean canonical school pose, no nene_r18",
            1.0,
        ),
    ]


def validate_core(entries: list[dict[str, object]]) -> None:
    if not entries:
        raise RuntimeError("Core dataset unexpectedly has no entries")
    adult_words = (R18_TRIGGER, "adult_context", "adult_solo", "adult_interaction")
    offenders = [
        str(entry["file"])
        for entry in entries
        if any(word in str(entry["caption"]) for word in adult_words)
    ]
    if offenders:
        raise RuntimeError(f"Core must contain no R18 vocabulary: {offenders}")


def validate_addon(entries: list[dict[str, object]]) -> None:
    adult_entries = [entry for entry in entries if str(entry["category"]).startswith("adult_")]
    clean_entries = [entry for entry in entries if entry["category"] == "clean_identity_anchor"]
    if not adult_entries or not clean_entries:
        raise RuntimeError("R18 add-on requires both adult and clean contrast concepts")
    missing = [str(entry["file"]) for entry in adult_entries if R18_TRIGGER not in str(entry["caption"])]
    leaked = [str(entry["file"]) for entry in clean_entries if R18_TRIGGER in str(entry["caption"])]
    if missing or leaked:
        raise RuntimeError(
            f"R18 token gate invariant failed; missing={missing}, leaked_to_clean={leaked}"
        )


def build(ai_root: Path, *, force: bool) -> dict[str, object]:
    root = ai_root / "Datasets" / "v17"
    core_writer = DatasetWriter(root / "nene-core", force=force)
    core_sources, core_crops = core_specs(ai_root)
    for spec in core_sources:
        core_writer.add_copy(spec)
    for spec in core_crops:
        core_writer.add_crop(spec)
    validate_core(core_writer.entries)
    core_manifest = core_writer.write_manifest(
        {
            "schema": SCHEMA,
            "dataset": "nene-core",
            "version": "v17",
            "base_model": "waiIllustriousSDXL_v170.safetensors",
            "trigger": TRIGGER,
            "r18_policy": "No R18 image or nene_r18 token is permitted in this default dataset.",
            "caption_policy": {
                "canonical_identity_token": TRIGGER,
                "school_uniform_policy": "Use nene_school_uniform for the canonical navy/gold uniform; add yellow_neck_bow only when visibly evidenced. Keep red_cardigan_school_variant separate.",
                "classic_witch_legwear_tokens": [
                    "asymmetric_legwear",
                    "black_white_striped_thighhigh",
                    "bare_other_leg",
                    "white_frilled_anklet",
                    "black_strappy_boots",
                ],
                "horizontal_flip": "forbidden; asymmetrical outfit evidence must not be mirrored",
            },
            "manual_review": {
                "review_date": "2026-07-29",
                "method": "current-model local visual inspection of original sources and v17 contact sheets",
                "excluded": [
                    "VisualPipeline/official_refs/nene_stand_01..04: transparent alpha mattes",
                    "OfficialCG/5018_* and v12_cg_11: gun/background near-duplicate family",
                    "all R18 images: isolated to nene-r18-addon",
                    "red-cardigan frames: never captioned nene_school_uniform",
                ],
            },
        }
    )

    addon_writer = DatasetWriter(root / "nene-r18-addon", force=force)
    for spec in r18_specs(ai_root):
        addon_writer.add_copy(spec)
    validate_addon(addon_writer.entries)
    addon_manifest = addon_writer.write_manifest(
        {
            "schema": SCHEMA,
            "dataset": "nene-r18-addon",
            "version": "v17",
            "base_model": "waiIllustriousSDXL_v170.safetensors",
            "trigger": TRIGGER,
            "r18_trigger": R18_TRIGGER,
            "inference_contract": {
                "normal_mode": f"Load core only; do not include {R18_TRIGGER}.",
                "r18_mode": f"Load core + add-on and include {R18_TRIGGER} in the positive prompt.",
                "default_model_candidate": "nene-core only",
            },
            "caption_policy": {
                "adult_images_must_include": R18_TRIGGER,
                "clean_contrast_images_must_not_include": R18_TRIGGER,
                "adult_images_must_not_use": [
                    "nene_school_uniform",
                    "official_witch_outfit",
                ],
                "reason": "adult context must be conditional, not absorbed by default clothing tokens",
            },
            "manual_review": {
                "review_date": "2026-07-29",
                "method": "current-model local visual inspection; adult source selection is documented but previews remain blurred",
                "adult_source_sheet": "Reviews/ModelEvaluations/v17_dataset_audit/nene-v12-master-01.jpg",
            },
        }
    )

    summary: dict[str, object] = {
        "schema": "ai-cg-studio.nene-v17-build",
        "ai_root": str(ai_root),
        "datasets": {
            "core": {
                "path": str(core_manifest.parent),
                "manifest": str(core_manifest),
                "counts": json.loads(core_manifest.read_text(encoding="utf-8"))["counts"],
            },
            "r18_addon": {
                "path": str(addon_manifest.parent),
                "manifest": str(addon_manifest),
                "counts": json.loads(addon_manifest.read_text(encoding="utf-8"))["counts"],
            },
        },
        "gate": "All adult captions contain nene_r18; no core caption contains nene_r18.",
    }
    summary_path = root / "build-summary.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--ai-root",
        type=Path,
        default=Path(__file__).resolve().parents[3] / "AI",
        help="Sibling AI workspace root (default: E:/code/2/lora/AI)",
    )
    parser.add_argument("--force", action="store_true", help="Deliberately replace existing v17 dataset directories")
    parser.add_argument(
        "--allow-retired-v17",
        action="store_true",
        help="Required only to reproduce the retired v17 split-dataset experiment.",
    )
    args = parser.parse_args()
    if not args.allow_retired_v17:
        raise RuntimeError(
            "v17's split core/add-on workflow is retired. Use the v18 unified dataset builder."
        )
    ai_root = args.ai_root.resolve()
    print(json.dumps(build(ai_root, force=args.force), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
