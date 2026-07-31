#!/usr/bin/env python3
"""Build the audited v16 character datasets in the sibling AI workspace.

The v15 folders are treated as a curated source, not as a caption source:
WD14 captions are intentionally discarded and replaced with a small,
canonical vocabulary.  Interaction/adult frames stay available, but are
separated into low-weight concepts so they cannot overwrite the identity or
the signature outfits.

This script only copies files and writes manifests; it never deletes an
existing v16 dataset unless --force is explicitly supplied.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import Iterable

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
INTERACTION_MARKERS = (
    "1boy",
    "2boy",
    "boy,",
    "male",
    "faceless_male",
    "couple",
    "2girls",
    "multiple_girls",
    "another",
    "hug_from_behind",
    "looking_at_another",
)
ADULT_MARKERS = (
    "explicit",
    "nude",
    "topless",
    "nipples",
    "areola",
    "pussy",
    "penis",
    "sex",
    "masturbation",
    "vibrator",
    "sex_toy",
    "no_panties",
    "underwear",
    "panties",
    "bra,",
)
WEAK_ADULT = {
    "nene": {"ev117", "ev123", "ev125"},
    "natsume": {"ev211"},
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path, fallback: object) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fallback


def source_map(v15: Path) -> dict[str, Path]:
    manifest = read_json(v15 / "build-manifest.json", {})
    result: dict[str, Path] = {}
    if isinstance(manifest, dict):
        for entry in manifest.get("entries", []):
            if not isinstance(entry, dict):
                continue
            relative = str(entry.get("file", "")).replace("\\", "/")
            source = Path(str(entry.get("source", "")))
            if relative and source.exists():
                result[relative] = source
    return result


def caption_for(path: Path) -> str:
    try:
        return path.with_suffix(".txt").read_text(encoding="utf-8", errors="ignore").strip().lower()
    except OSError:
        return ""


def has_interaction(text: str) -> bool:
    return any(marker in text for marker in INTERACTION_MARKERS)


def has_adult_content(text: str) -> bool:
    return any(marker in text for marker in ADULT_MARKERS)


def outfit_tokens(character: str, text: str, name: str) -> list[str]:
    haystack = f"{text} {name}".lower()
    tokens: list[str] = []
    if character == "nene":
        if any(
            word in haystack
            for word in ("official_witch_outfit", "witch_costume", "witch_hat", "魔女")
        ):
            tokens.extend(["official_witch_outfit", "witch_hat", "black_cape", "pink_lining"])
        if any(word in haystack for word in ("school", "uniform", "校服", "sailor")):
            tokens.append("nene_school_uniform")
        if any(word in haystack for word in ("kimono", "和服", "qipao", "旗袍")):
            tokens.append("nene_kimono")
    else:
        if any(word in haystack for word in ("qipao", "china", "chinese", "旗袍", "red_dress", "red dress")):
            tokens.extend(
                [
                    "natsume_official_qipao",
                    "red_china_dress",
                    "mandarin_collar",
                    "gold_trim",
                    "floral_pattern",
                    "hair_bun",
                    "hair_flower",
                ]
            )
        if any(word in haystack for word in ("maid", "女仆")):
            tokens.append("natsume_maid_outfit")
        if any(word in haystack for word in ("school", "uniform", "校服")):
            tokens.append("natsume_school_uniform")
    return tokens


def canonical_caption(character: str, category: str, source: Path, original: str) -> str:
    name = source.stem.lower()
    if character == "nene":
        identity = [
            "ayachi_nene",
            "white_hair",
            "very_long_hair",
            "low_twintails",
            "purple_eyes",
            "ahoge",
            "pink_hair_ribbons",
        ]
    else:
        identity = [
            "shiki_natsume",
            "black_hair",
            "long_hair",
            "yellow_eyes",
            "mole_under_eye",
            "hairclip",
        ]

    tags = list(identity)
    tags.extend(outfit_tokens(character, original, name))
    if category.startswith("adult"):
        tags.extend(["adult", "mature_character", "explicit_context"])
    elif category == "interaction":
        tags.append("two_character_interaction")
    elif category == "official_cg":
        tags.append("official_visual_novel_cg")
    elif category == "reference":
        tags.append("official_reference")
    elif category == "identity_anchors":
        tags.append("face_anchor")
    elif category.startswith("outfit"):
        tags.append("outfit_anchor")
    # Keep captions short and deterministic.  Do not carry contradictory
    # WD14 tags such as brown_eyes or a missing mole.
    deduped = list(dict.fromkeys(tags))
    return ", ".join(deduped)


def iter_images(directory: Path) -> Iterable[Path]:
    if not directory.exists():
        return []
    return sorted(path for path in directory.rglob("*") if path.suffix.lower() in IMAGE_EXTS)


def classify_v15(character: str, source_category: str, image: Path, original: str) -> str:
    if source_category == "adult_cg" or has_adult_content(original):
        return "adult_interaction" if has_interaction(original) else "adult_solo"
    if source_category in {"official_cg", "curated", "reference"} and has_interaction(original):
        return "interaction"
    tokens = outfit_tokens(character, original, image.name)
    if character == "nene" and "official_witch_outfit" in tokens:
        return "outfit_witch"
    if character == "nene" and "nene_school_uniform" in tokens:
        return "outfit_school"
    if character == "natsume" and "natsume_official_qipao" in tokens:
        return "outfit_qipao"
    return source_category


def relative_key(category: str, image: Path) -> str:
    return f"{category}/{image.name}".replace("\\", "/")


def build_character(ai_root: Path, character: str, force: bool) -> dict:
    v15 = ai_root / "Datasets" / "v15" / character
    output = ai_root / "Datasets" / "v16" / character
    if output.exists():
        if not force:
            raise RuntimeError(f"{output} exists; pass --force only for a deliberate rebuild")
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)
    for category in (
        "official_cg",
        "curated",
        "reference",
        "identity_anchors",
        "outfit_witch" if character == "nene" else "outfit_qipao",
        "outfit_school",
        "adult_solo",
        "adult_interaction",
        "interaction",
        "validation",
    ):
        (output / category).mkdir(parents=True, exist_ok=True)

    mapping = source_map(v15)
    seen: set[str] = set()
    entries: list[dict] = []
    excluded: list[dict] = []
    counter = 0

    def add_image(
        image: Path,
        source_category: str,
        *,
        audited: str,
        explicit_category: str | None = None,
        original_caption: str = "",
    ) -> None:
        nonlocal counter
        if not image.exists():
            excluded.append({"source": str(image), "reason": "missing"})
            return
        digest = sha256(image)
        if digest in seen:
            # A canonical outfit/face anchor may intentionally repeat an
            # already-curated frame: the separate concept gives it the
            # correct outfit vocabulary and balancing weight.  Keep only one
            # such semantic copy per source category; ordinary duplicates are
            # still removed globally.
            if not explicit_category or not explicit_category.startswith("outfit"):
                excluded.append({"source": str(image), "reason": "exact_sha256_duplicate"})
                return
            if any(
                entry["sha256"] == digest and entry["category"] == explicit_category
                for entry in entries
            ):
                excluded.append(
                    {
                        "source": str(image),
                        "reason": "exact_sha256_duplicate_within_semantic_outfit",
                    }
                )
                return
        seen.add(digest)
        category = explicit_category or classify_v15(character, source_category, image, original_caption)
        counter += 1
        filename = f"{character}_v16_{counter:04d}{image.suffix.lower()}"
        destination = output / category / filename
        shutil.copy2(image, destination)
        caption = canonical_caption(character, category, image, original_caption)
        destination.with_suffix(".txt").write_text(caption + "\n", encoding="utf-8")
        entries.append(
            {
                "file": str(destination.relative_to(output)).replace("\\", "/"),
                "source": str(image),
                "source_category": source_category,
                "category": category,
                "sha256": digest,
                "caption": caption,
                "visual_audit": audited,
                "loss_weight": (
                    0.35
                    if category == "adult_interaction"
                    else 0.45
                    if category == "interaction"
                    else 0.65
                    if category == "adult_solo"
                    else 1.0
                ),
                "semantic_duplicate": digest in {
                    entry["sha256"] for entry in entries if entry["category"] != category
                },
            }
        )

    # Reuse the manually curated v15 set, but move obvious multi-character
    # frames out of the identity bucket and exclude weak R18 thumbnail/full
    # matches called out in the audit notes.
    for source_category in ("official_cg", "curated", "reference", "adult_cg"):
        folder = v15 / source_category
        for image in iter_images(folder):
            original = caption_for(image)
            event_match = re.search(r"(ev\d+)", image.name.lower())
            event = event_match.group(1) if event_match else ""
            if source_category == "adult_cg" and event in WEAK_ADULT[character]:
                excluded.append(
                    {
                        "source": str(image),
                        "reason": "weak_thumbnail_full_scene_match_manual_recheck",
                        "event": event.upper(),
                    }
                )
                continue
            manifest_key = relative_key(source_category, image)
            source = mapping.get(manifest_key, image)
            add_image(
                source if source.exists() else image,
                source_category,
                audited="v15-manual-candidate-set; current-model visual review",
                original_caption=original,
            )

    refinement_root = ai_root / "Datasets" / "Refinement"
    if character == "nene":
        face_root = refinement_root / "ayachi_nene_v14_identity" / "face_anchors"
        outfit_root = refinement_root / "ayachi_nene_v14_identity" / "outfits"
        for image in iter_images(face_root):
            add_image(
                image,
                "refinement_face",
                explicit_category="identity_anchors",
                audited="manual contact-sheet review 2026-07-28",
                original_caption=caption_for(image),
            )
        for image in iter_images(outfit_root):
            original = caption_for(image)
            category = (
                "outfit_witch"
                if "official_witch_outfit" in outfit_tokens(character, original, image.name)
                else "outfit_school"
            )
            add_image(
                image,
                "refinement_outfit",
                explicit_category=category,
                audited=(
                    "manual contact-sheet review 2026-07-28; canonical witch outfit"
                    if category == "outfit_witch"
                    else "manual contact-sheet review 2026-07-28; canonical school outfit"
                ),
                original_caption=original,
            )
    else:
        face_root = refinement_root / "shiki_natsume_v14_identity" / "face_anchors"
        for image in iter_images(face_root):
            add_image(
                image,
                "refinement_face",
                explicit_category="identity_anchors",
                audited="manual contact-sheet review 2026-07-29; mole and eye anchors",
                original_caption=caption_for(image),
            )
        qipao_root = refinement_root / "shiki_natsume_qipao_addon_v1"
        for image in iter_images(qipao_root):
            add_image(
                image,
                "refinement_qipao",
                explicit_category="outfit_qipao",
                audited="manual contact-sheet review 2026-07-28; canonical qipao",
                original_caption=caption_for(image),
            )

    # Deterministic validation split: no file is duplicated into training;
    # the manifest points to held-out training files for fixed-seed gates.
    validation_candidates = [
        entry
        for entry in entries
        if entry["category"]
        in {
            "curated",
            "official_cg",
            "reference",
            "identity_anchors",
            "outfit_witch",
            "outfit_qipao",
        }
    ]
    validation_target = min(
        len(validation_candidates),
        max(4, round(len(entries) * 0.10)),
    )
    validation: list[dict] = []
    if validation_target:
        # Reserve one signature-outfit frame and one face anchor for the
        # held-out gate whenever enough source material exists.  The rest is
        # spread deterministically over the general official set.
        signature_category = "outfit_witch" if character == "nene" else "outfit_qipao"
        for category in (signature_category, "identity_anchors"):
            matches = [entry for entry in validation_candidates if entry["category"] == category]
            if matches and len(validation) < validation_target:
                reference_matches = [
                    entry for entry in matches if entry["source_category"] == "reference"
                ]
                validation.append((reference_matches or matches)[0])
        remaining = [
            entry
            for entry in validation_candidates
            if entry not in validation
            and entry["category"] not in {signature_category, "identity_anchors"}
        ]
        slots = validation_target - len(validation)
        if slots > 0 and remaining:
            chosen_indexes = {
                min(
                    len(remaining) - 1,
                    round(index * (len(remaining) - 1) / max(1, slots - 1)),
                )
                for index in range(slots)
            }
            validation.extend(
                entry for index, entry in enumerate(remaining) if index in chosen_indexes
            )
    for entry in validation:
        original_file = output / entry["file"]
        validation_file = output / "validation" / original_file.name
        shutil.move(original_file, validation_file)
        original_caption = original_file.with_suffix(".txt")
        validation_caption = validation_file.with_suffix(".txt")
        shutil.move(original_caption, validation_caption)
        entry["original_category"] = entry["category"]
        entry["category"] = "validation"
        entry["file"] = str(validation_file.relative_to(output)).replace("\\", "/")
        entry["loss_weight"] = 1.0
    manifest = {
        "schema": "ai-cg-studio.character-dataset/v16",
        "character": character,
        "version": "v16",
        "base_model": "waiIllustriousSDXL_v170.safetensors",
        "trigger": "ayachi_nene" if character == "nene" else "shiki_natsume",
        "identity_signature": (
            ["white_hair", "very_long_hair", "low_twintails", "purple_eyes", "ahoge", "pink_hair_ribbons"]
            if character == "nene"
            else ["black_hair", "long_hair", "yellow_eyes", "mole_under_eye", "hairclip"]
        ),
        "caption_policy": {
            "source_auto_tags": "discarded",
            "canonical_prefix": True,
            "interaction_isolation": True,
            "adult_default_enabled": True,
            "adult_thumbnail_blur": True,
        },
        "counts": {
            "total": len(entries),
            "train_images": len(entries) - len(validation),
            "validation_images": len(validation),
            "categories": {
                category: sum(1 for entry in entries if entry["category"] == category)
                for category in sorted({entry["category"] for entry in entries})
            },
        },
        "entries": entries,
        "excluded": excluded,
        "validation": [
            {"file": entry["file"], "sha256": entry["sha256"], "reason": "deterministic_10_percent_holdout"}
            for entry in validation
        ],
        "manual_review": {
            "review_date": "2026-07-29",
            "reviewer": "current-model visual inspection",
            "signature_outfit_contact_sheet": (
                "AI/Reviews/ModelEvaluations/v16_dataset_audit/nene-witch-v16-01.jpg"
                if character == "nene"
                else "AI/Reviews/ModelEvaluations/v16_dataset_audit/natsume-qipao-v16-01.jpg"
            ),
            "refinement_contact_sheets": [
                "AI/Reviews/ModelEvaluations/v16_dataset_audit/nene-refinement-01.jpg",
                "AI/Reviews/ModelEvaluations/v16_dataset_audit/nene-refinement-02.jpg",
            ]
            if character == "nene"
            else [
                "AI/Reviews/ModelEvaluations/v16_dataset_audit/natsume-identity-01.jpg",
                "AI/Reviews/ModelEvaluations/v16_dataset_audit/natsume-identity-02.jpg",
                "AI/Reviews/ModelEvaluations/v16_dataset_audit/natsume-qipao-01.jpg",
            ],
        },
    }
    (output / "dataset-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ai-root", type=Path, default=Path(__file__).resolve().parents[3] / "AI")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    args.ai_root = args.ai_root.resolve()
    manifests = [build_character(args.ai_root, character, args.force) for character in ("nene", "natsume")]
    summary = {
        "schema": "ai-cg-studio.v16-dataset-build",
        "ai_root": str(args.ai_root),
        "characters": {
            manifest["character"]: {
                "total": manifest["counts"]["total"],
                "train_images": manifest["counts"]["train_images"],
                "validation_images": manifest["counts"]["validation_images"],
                "categories": manifest["counts"]["categories"],
                "excluded": len(manifest["excluded"]),
            }
            for manifest in manifests
        },
    }
    summary_path = args.ai_root / "Datasets" / "v16" / "build-summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
