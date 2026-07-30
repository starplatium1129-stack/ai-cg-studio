#!/usr/bin/env python3
"""Build the final Nene v18 dataset from WD14 output plus per-image review.

The source selection is reused unchanged.  Captions are rebuilt from:

1. the project's existing SmilingWolf WD14 output;
2. a per-image keep/remove/add review;
3. a small, documented set of custom control tokens.

No free-form prose tags from the earlier draft are carried forward.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import date
from pathlib import Path
from typing import Any, Iterable


TRIGGER = "ayachi_nene"
R18_TRIGGER = "nene_r18"
IDENTITY_TAGS = (
    "white_hair",
    "very_long_hair",
    "low_twintails",
    "purple_eyes",
    "ahoge",
    "hair_ribbon",
)
IDENTITY_FILTER_TAGS = {*IDENTITY_TAGS, "long_hair"}
CUSTOM_CONTROLS = {
    "nene_school_uniform",
    "nene_sailor_uniform",
    "nene_red_cardigan_uniform",
    "nene_blue_pajamas",
    "nene_green_sleepwear",
    "nene_witch_canonical",
    "nene_bat_dress",
    "nene_black_dress",
}
SIZE_TAGS = {
    "flat_chest",
    "small_breasts",
    "medium_breasts",
    "large_breasts",
    "huge_breasts",
    "gigantic_breasts",
}
SECONDARY_IDENTITY_TAGS = {
    "grey_hair",
    "black_hair",
    "brown_hair",
    "blue_eyes",
    "yellow_eyes",
    "short_hair",
    "ponytail",
}
RECLASSIFIED_SAFE = {
    "official_5001_ab",
    "official_5001_ba",
    "r18_alternate_witch_a",
    "r18_alternate_witch_b",
}
FINAL_ID_RENAMES = {
    "r18_alternate_witch_a": "safe_canonical_witch_street_a",
    "r18_alternate_witch_b": "safe_canonical_witch_street_b",
}
FINAL_GROUP_OVERRIDES = {
    "r18_alternate_witch_a": "safe_canonical_witch_street",
    "r18_alternate_witch_b": "safe_canonical_witch_street",
}
SCOPE_OVERRIDES = {
    "official_5002_base": "interaction",
    "official_5002_ab": "interaction",
    "official_5002_ad": "interaction",
    "r18_ev119_variant": "solo",
}

OUTFIT_GROUPS = {
    "nene_school_uniform": {
        "official_5001_base",
        "official_5001_ab",
        "official_5001_ba",
        "official_5003_base_a",
        "official_5003_base_b",
        "official_5003_ab",
        "official_5005_base",
        "official_5005_ab",
        "official_5005_be",
        "official_5007_base_a",
        "official_5007_base_b",
        "official_5007_ab",
        "school_uniform_full_body",
        "r18_ev101",
        "r18_ev101_variant",
        "r18_ev115",
        "r18_ev115_variant",
        "r18_bed_contact_a",
        "r18_bed_contact_b",
    },
    "nene_sailor_uniform": {
        "official_5002_base",
        "official_5002_ab",
        "official_5002_ad",
    },
    "nene_red_cardigan_uniform": {
        "official_5006_base_a",
        "official_5006_base_b",
        "official_5006_ca",
        "casual_full_body",
        "r18_ev121",
        "r18_ev121_variant",
        "r18_ev117",
    },
    "nene_blue_pajamas": {
        "official_5004_base",
        "official_5004_ab",
        "official_5004_ac",
    },
    "nene_green_sleepwear": {
        "r18_ev119",
        "r18_ev119_variant",
        "r18_ev114",
        "r18_ev114_variant_a",
        "r18_ev114_variant_b",
        "safe_green_sleepwear_a",
        "safe_green_sleepwear_b",
        "safe_green_sleepwear_c",
    },
    "nene_witch_canonical": {
        "canonical_witch_cg",
        "canonical_witch_full_body",
        "r18_ev118",
        "r18_ev118_variant",
        "r18_ev118_close_variant",
        "r18_alternate_witch_a",
        "r18_alternate_witch_b",
    },
    "nene_bat_dress": {
        "bat_dress_full_body",
        "safe_black_bat_a",
        "safe_black_bat_b",
    },
    "nene_black_dress": {
        "r18_ev123",
        "r18_ev123_variant_a",
        "r18_ev123_variant_b",
    },
}

CORE_NATIVE_ADDITIONS = {
    "canonical_witch_cg": {
        "black_cape",
        "pink_ribbon",
        "pink_bow",
        "striped_bow",
        "criss-cross_halter",
        "crop_top",
        "strap_between_breasts",
    },
    "canonical_witch_full_body": {
        "black_cape",
        "black_skirt",
        "pink_ribbon",
        "pink_bow",
        "striped_bow",
        "criss-cross_halter",
        "crop_top",
        "strap_between_breasts",
        "underboob",
        "midriff",
        "asymmetrical_legwear",
        "striped_thighhighs",
        "single_thighhigh",
        "single_sock",
        "white_socks",
        "ankle_socks",
        "frilled_socks",
        "boots",
        "black_footwear",
        "detached_sleeves",
        "thigh_strap",
    },
    "school_uniform_full_body": {
        "blue_jacket",
        "gold_trim",
        "double-breasted",
        "yellow_bowtie",
        "grey_skirt",
        "plaid_skirt",
        "pleated_skirt",
        "black_thighhighs",
        "mary_janes",
        "black_footwear",
        "pink_ribbon",
    },
    "bat_dress_full_body": {
        "black_dress",
        "bat_hair_ornament",
        "asymmetrical_clothes",
        "garter_straps",
        "black_thighhighs",
        "mary_janes",
    },
    "safe_black_bat_a": {
        "black_dress",
        "bat_hair_ornament",
        "asymmetrical_clothes",
    },
    "safe_black_bat_b": {
        "black_dress",
        "bat_hair_ornament",
        "asymmetrical_clothes",
    },
    "r18_ev118": {
        "criss-cross_halter",
        "crop_top",
        "strap_between_breasts",
        "black_skirt",
        "detached_sleeves",
    },
    "r18_ev118_variant": {
        "criss-cross_halter",
        "crop_top",
        "strap_between_breasts",
        "black_skirt",
        "detached_sleeves",
    },
    "r18_ev118_close_variant": {
        "criss-cross_halter",
        "crop_top",
        "strap_between_breasts",
        "black_cape",
        "detached_sleeves",
    },
    "r18_alternate_witch_a": {
        "black_cape",
        "black_skirt",
        "pink_ribbon",
        "pink_bow",
        "striped_bow",
        "criss-cross_halter",
        "crop_top",
        "strap_between_breasts",
        "underboob",
        "midriff",
        "detached_sleeves",
    },
    "r18_alternate_witch_b": {
        "black_cape",
        "black_skirt",
        "pink_ribbon",
        "pink_bow",
        "striped_bow",
        "criss-cross_halter",
        "crop_top",
        "strap_between_breasts",
        "underboob",
        "midriff",
        "detached_sleeves",
    },
}

CORE_NATIVE_REMOVALS = {
    "canonical_witch_full_body": {
        "striped",
        "thighhighs",
        "uneven_legwear",
        "skirt",
    },
}

FACT_VOCABULARY = {
    "subject": {
        "1girl",
        "1boy",
        "2girls",
        "solo",
        "solo_focus",
        "hetero",
        "faceless_male",
        "pov",
    },
    "camera": {
        "close-up",
        "upper_body",
        "full_body",
        "cowboy_shot",
        "dutch_angle",
        "from_above",
        "from_below",
        "pov",
    },
    "pose": {
        "standing",
        "sitting",
        "lying",
        "on_back",
        "on_side",
        "on_stomach",
        "all_fours",
        "hug",
        "hug_from_behind",
        "holding_hands",
        "lap_pillow",
        "breast_grab",
        "grabbing_from_behind",
        "skirt_lift",
        "female_masturbation",
        "handjob",
        "spread_legs",
        "holding_gun",
    },
    "attire_state": {
        "school_uniform",
        "pajamas",
        "sleepwear",
        "underwear",
        "nude",
        "topless",
        "bottomless",
        "no_panties",
        "revealing_clothes",
        "bra_lift",
        "open_shirt",
        "shirt_lift",
    },
    "expression": {
        "blush",
        "smile",
        "open_mouth",
        "closed_mouth",
        "closed_eyes",
        "half-closed_eyes",
        "tears",
        "frown",
        "sweatdrop",
        "looking_at_viewer",
        "looking_away",
    },
    "scene": {
        "indoors",
        "outdoors",
        "library",
        "classroom",
        "bed",
        "on_bed",
        "bookshelf",
        "wooden_floor",
        "day",
        "night",
        "sky",
        "simple_background",
    },
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def unique(tags: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for raw in tags:
        tag = raw.strip().lower()
        if tag and tag not in seen:
            seen.add(tag)
            result.append(tag)
    return result


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"JSON root must be an object: {path}")
    return value


def load_review_entries(paths: list[Path]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for path in paths:
        report = load_json(path)
        entries = report.get("entries")
        if not isinstance(entries, list):
            raise RuntimeError(f"missing entries list: {path}")
        for entry in entries:
            if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
                raise RuntimeError(f"invalid review entry: {path}")
            entry_id = str(entry["id"])
            if entry_id in result:
                raise RuntimeError(f"duplicate review entry {entry_id!r}")
            for key in ("keep", "remove", "add"):
                value = entry.get(key)
                if not isinstance(value, list) or not all(isinstance(tag, str) for tag in value):
                    raise RuntimeError(f"{entry_id}: {key} must be a string list")
            result[entry_id] = entry
    return result


def native_tag_vocabulary(selected_tags: Path) -> set[str]:
    lines = selected_tags.read_text(encoding="utf-8").splitlines()
    result: set[str] = set()
    for line in lines[1:]:
        columns = line.split(",")
        if len(columns) >= 3 and columns[2] == "0":
            result.add(columns[1].replace(" ", "_"))
    return result


def identity_is_kept(filename: str, identity_anchor: bool) -> bool:
    if identity_anchor:
        return True
    digest = hashlib.sha256(filename.encode("utf-8")).digest()
    return (digest[0] / 255.0) < 0.5


def native_identity(review: dict[str, Any]) -> list[str]:
    original = review.get("visible_identity_tags", [])
    if not isinstance(original, list):
        return []
    mapped: list[str] = []
    for tag in original:
        if tag == "pink_hair_ribbons":
            mapped.extend(("hair_ribbon", "pink_ribbon"))
        else:
            mapped.append(str(tag))
    return [tag for tag in IDENTITY_TAGS if tag in mapped]


def controls_for(entry_id: str) -> list[str]:
    return [
        control
        for control, members in OUTFIT_GROUPS.items()
        if entry_id in members
    ]


def prune_redundancy(tags: list[str]) -> list[str]:
    values = [tag for tag in unique(tags) if tag not in SIZE_TAGS]
    current = set(values)
    redundant: set[str] = set()
    if "very_long_hair" in current:
        redundant.add("long_hair")
    if "twin_braids" in current:
        redundant.update({"braid", "twintails"})
    if "witch_hat" in current:
        redundant.add("hat")
    if "holding_gun" in current:
        redundant.update({"weapon", "gun", "holding_weapon", "holding", "handgun"})
    if "yellow_bowtie" in current:
        redundant.update({"bow", "bowtie", "yellow_bow"})
    if "hair_ribbon" in current or "pink_ribbon" in current:
        redundant.add("ribbon")
    if "pink_bow" in current:
        redundant.add("bow")
    if "plaid_skirt" in current:
        redundant.update({"skirt", "plaid"})
    if "black_skirt" in current:
        redundant.add("skirt")
    if "black_thighhighs" in current:
        redundant.add("thighhighs")
    if "striped_thighhighs" in current:
        redundant.update({"thighhighs", "striped"})
    if "black_cape" in current:
        redundant.add("cape")
    if "blue_jacket" in current:
        redundant.update({"jacket", "black_jacket"})
    if "black_dress" in current:
        redundant.add("dress")
    if "bat_hair_ornament" in current:
        redundant.add("hair_ornament")
    if "mary_janes" in current:
        redundant.add("shoes")
    if "female_masturbation" in current:
        redundant.add("masturbation")
    if "mosaic_censoring" in current:
        redundant.add("censored")
    if {"pink_panties", "blue_panties", "white_panties"} & current:
        redundant.add("underwear")
    if {"blue_bra", "purple_bra", "pink_bra"} & current:
        redundant.add("bra")
    return [tag for tag in values if tag not in redundant]


def derive_facts(final_native: list[str]) -> dict[str, list[str]]:
    return {
        group: [tag for tag in final_native if tag in vocabulary]
        for group, vocabulary in FACT_VOCABULARY.items()
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--selection-manifest",
        type=Path,
        default=Path(
            r"E:\code\2\lora\AI\Datasets\Characters\Ayachi_Nene"
            r"\V18_Unified\dataset-manifest.json"
        ),
    )
    parser.add_argument(
        "--raw-wd14",
        type=Path,
        default=Path(r"E:\code\2\lora\AI\Reviews\nene_v18_wd14_raw_2026-07-29.json"),
    )
    parser.add_argument(
        "--review",
        type=Path,
        action="append",
        default=[],
    )
    parser.add_argument(
        "--selected-tags",
        type=Path,
        default=Path(r"E:\code\2\lora\Models\wd14_tagger\selected_tags.csv"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(
            r"E:\code\2\lora\AI\Datasets\Characters\Ayachi_Nene"
            r"\V18_WD14_Curated"
        ),
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    review_paths = args.review or [
        Path(r"E:\code\2\lora\AI\Reviews\nene_v18_wd14_curation_safe.json"),
        Path(r"E:\code\2\lora\AI\Reviews\nene_v18_wd14_curation_r18_a.json"),
        Path(r"E:\code\2\lora\AI\Reviews\nene_v18_wd14_curation_r18_b.json"),
    ]
    selection_manifest = args.selection_manifest.resolve()
    raw_wd14_path = args.raw_wd14.resolve()
    selected_tags = args.selected_tags.resolve()
    output = args.output.resolve()
    expected_parent = Path(
        r"E:\code\2\lora\AI\Datasets\Characters\Ayachi_Nene"
    ).resolve()
    if output.parent != expected_parent or output.name != "V18_WD14_Curated":
        raise RuntimeError(f"refusing unexpected output destination: {output}")

    selection = load_json(selection_manifest)
    selection_entries = selection.get("entries")
    if not isinstance(selection_entries, list) or len(selection_entries) != 55:
        raise RuntimeError("selection manifest must contain exactly 55 entries")
    raw_report = load_json(raw_wd14_path)
    raw_entries = {
        str(entry["id"]): entry
        for entry in raw_report.get("entries", [])
        if isinstance(entry, dict) and "id" in entry
    }
    reviews = load_review_entries([path.resolve() for path in review_paths])
    selection_ids = {str(entry["id"]) for entry in selection_entries}
    if set(raw_entries) != selection_ids:
        raise RuntimeError("WD14 raw report does not exactly match the 55 selected IDs")
    if set(reviews) != selection_ids:
        missing = sorted(selection_ids - set(reviews))
        extra = sorted(set(reviews) - selection_ids)
        raise RuntimeError(f"manual review coverage mismatch; missing={missing}, extra={extra}")

    vocabulary = native_tag_vocabulary(selected_tags)
    invalid_core_additions = sorted(
        {
            tag
            for additions in CORE_NATIVE_ADDITIONS.values()
            for tag in additions
            if tag not in vocabulary
        }
    )
    if invalid_core_additions:
        raise RuntimeError(
            f"core outfit audit used non-WD14 native tags: {invalid_core_additions}"
        )
    vocabulary_mistakes: dict[str, list[str]] = {}
    for entry_id, review in reviews.items():
        invalid = sorted(
            {
                tag
                for tag in (*review["keep"], *review["add"])
                if tag not in vocabulary
            }
        )
        if invalid:
            vocabulary_mistakes[entry_id] = invalid
    if vocabulary_mistakes:
        raise RuntimeError(f"manual review used non-WD14 native tags: {vocabulary_mistakes}")

    if output.exists():
        if not args.force:
            raise FileExistsError(f"{output} exists; pass --force to rebuild")
        shutil.rmtree(output)
    output.mkdir(parents=True)

    final_entries: list[dict[str, Any]] = []
    audit_entries: list[dict[str, Any]] = []
    for index, original in enumerate(selection_entries, start=1):
        entry_id = str(original["id"])
        manual = reviews[entry_id]
        raw = raw_entries[entry_id]
        source = Path(str(original["source_file"])).resolve()
        if not source.is_file():
            raise FileNotFoundError(f"{entry_id}: missing source {source}")
        source_digest = sha256(source)
        if source_digest != str(original["source_sha256"]):
            raise RuntimeError(f"{entry_id}: selected source hash changed")
        if source_digest != str(raw["export_sha256"]):
            raise RuntimeError(f"{entry_id}: WD14 report does not match selected source")

        is_r18 = bool(original["r18"]) and entry_id not in RECLASSIFIED_SAFE
        final_id = FINAL_ID_RENAMES.get(entry_id, entry_id)
        outfit_role = str(original.get("outfit_role", ""))
        if outfit_role == "canonical_witch_full_body":
            category = "witch_full_body"
        elif outfit_role == "canonical_witch_cg":
            category = "witch_cg"
        else:
            category = "identity_r18" if is_r18 else "identity_safe"
        category_dir = output / category
        category_dir.mkdir(parents=True, exist_ok=True)
        destination = category_dir / f"{index:03d}_{final_id}{source.suffix.lower()}"
        shutil.copy2(source, destination)

        raw_tags = [str(tag) for tag in raw["wd14_tags"]]
        requested_keep = unique(str(tag) for tag in manual["keep"])
        reviewed_keep = [tag for tag in requested_keep if tag in raw_tags]
        manual_add = unique(
            [
                *(str(tag) for tag in manual["add"]),
                *(tag for tag in requested_keep if tag not in raw_tags),
            ]
        )
        policy_add = sorted(CORE_NATIVE_ADDITIONS.get(entry_id, set()))
        controls = controls_for(entry_id)
        if "nene_green_sleepwear" in controls:
            policy_add = unique([*policy_add, "sleepwear"])
        reviewed_add = unique([*manual_add, *policy_add])
        reviewed_native = prune_redundancy([*reviewed_keep, *reviewed_add])
        reviewed_native = [
            tag
            for tag in reviewed_native
            if tag not in SECONDARY_IDENTITY_TAGS
            and tag not in CORE_NATIVE_REMOVALS.get(entry_id, set())
        ]
        if "nene_green_sleepwear" in controls:
            reviewed_native = [tag for tag in reviewed_native if tag != "pajamas"]
        reviewed_native = [tag for tag in reviewed_native if tag not in IDENTITY_FILTER_TAGS]

        review = dict(original["review"])
        visible_identity = native_identity(review)
        keep_identity = identity_is_kept(
            destination.name,
            bool(review.get("identity_complete")) or bool(outfit_role),
        )
        captioned_identity = visible_identity if keep_identity else []
        caption_tokens = [TRIGGER]
        if is_r18:
            caption_tokens.append(R18_TRIGGER)
        caption_tokens.extend(controls)
        caption_tokens.extend(captioned_identity)
        caption_tokens.extend(reviewed_native)
        caption_tokens = unique(caption_tokens)
        caption = ", ".join(caption_tokens)
        destination.with_suffix(".txt").write_text(caption + "\n", encoding="utf-8")

        raw_removed = [tag for tag in raw_tags if tag not in reviewed_keep]
        policy_removed = [
            tag
            for tag in unique([*reviewed_keep, *reviewed_add])
            if tag not in reviewed_native and tag not in IDENTITY_TAGS
        ]
        final_native = [
            tag
            for tag in caption_tokens
            if tag not in {TRIGGER, R18_TRIGGER, *CUSTOM_CONTROLS, *IDENTITY_FILTER_TAGS}
        ]
        review.update(
            {
                "reviewer": "Codex GPT-5 current-model image audit after project WD14",
                "reviewed_at": date.today().isoformat(),
                "content_class": "r18" if is_r18 else "safe",
                "visible_identity_tags": visible_identity,
                "captioned_identity_tags": captioned_identity,
                "identity_caption_mode": "keep" if keep_identity else "prune",
                "visible_outfit_tags": controls,
                "dedupe_group": FINAL_GROUP_OVERRIDES.get(
                    entry_id,
                    str(review.get("dedupe_group", "")),
                ),
                "full_body": bool(review.get("full_body")) and entry_id not in {
                    "safe_green_sleepwear_a",
                    "safe_green_sleepwear_b",
                    "safe_green_sleepwear_c",
                    "r18_alternate_witch_a",
                    "r18_alternate_witch_b",
                },
                "tag_review_note": str(manual.get("note", "")),
            }
        )
        if entry_id in RECLASSIFIED_SAFE:
            review["classification_correction"] = (
                "Manually reclassified as non-R18 after direct image review; "
                "the previous generated copy was deleted by the user because "
                "its category was wrong."
            )

        relative = destination.relative_to(output).as_posix()
        final_entry = {
            **original,
            "id": final_id,
            "selection_id": entry_id,
            "file": relative,
            "export_sha256": sha256(destination),
            "caption": caption,
            "category": category,
            "subject_scope": SCOPE_OVERRIDES.get(
                entry_id,
                str(original["subject_scope"]),
            ),
            "r18": is_r18,
            "facts": derive_facts(final_native),
            "review": review,
            "tagging": {
                "raw_wd14_tags": raw_tags,
                "manual_keep": reviewed_keep,
                "manual_removed": raw_removed,
                "manual_added": manual_add,
                "policy_added": policy_add,
                "policy_removed": policy_removed,
                "custom_control_tags": controls,
                "final_native_tags": final_native,
            },
        }
        final_entries.append(final_entry)
        audit_entries.append(
            {
                "id": final_id,
                "selection_id": entry_id,
                "file": relative,
                "r18": is_r18,
                "raw_count": len(raw_tags),
                "final_native_count": len(final_native),
                "removed": raw_removed,
                "added": reviewed_add,
                "controls": controls,
                "note": str(manual.get("note", "")),
            }
        )

    safe_count = sum(not bool(entry["r18"]) for entry in final_entries)
    r18_count = len(final_entries) - safe_count
    final_manifest = {
        **selection,
        "schema": "ai-cg-studio.nene-unified-dataset/v18-wd14-curated",
        "version": "v18-wd14-curated",
        "selection_manifest": str(selection_manifest),
        "selection_manifest_sha256": sha256(selection_manifest),
        "tagging_policy": {
            "automatic_source": "project Utilities/v15/tag_dataset_v15.py Wd14Tagger",
            "raw_report": str(raw_wd14_path),
            "raw_report_sha256": sha256(raw_wd14_path),
            "threshold": raw_report["tagger"]["threshold"],
            "manual_review_files": [
                {"file": str(path.resolve()), "sha256": sha256(path.resolve())}
                for path in review_paths
            ],
            "native_vocabulary": str(selected_tags),
            "native_vocabulary_sha256": sha256(selected_tags),
            "custom_control_tags": sorted(CUSTOM_CONTROLS),
            "identity_mode": "project WD14 hybrid 0.5; all identity anchors force keep",
            "body_size_policy": (
                "Perspective-dependent breast-size classifier tags are removed. "
                "The character/R18 trigger owns the official body distribution."
            ),
            "manual_review_required": True,
        },
        "selection_policy": {
            **selection.get("selection_policy", {}),
            "method": "project WD14 first, then current-model per-image keep/remove/add review",
        },
        "entries": final_entries,
    }
    manifest_path = output / "dataset-manifest.json"
    manifest_path.write_text(
        json.dumps(final_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    audit_path = output / "WD14_TAG_AUDIT.json"
    audit_path.write_text(
        json.dumps(
            {
                "schema": "ai-cg-studio.nene-v18-wd14-manual-audit/v1",
                "summary": {
                    "entries": len(audit_entries),
                    "safe": safe_count,
                    "r18": r18_count,
                    "raw_tags": sum(int(entry["raw_count"]) for entry in audit_entries),
                    "final_native_tags": sum(
                        int(entry["final_native_count"]) for entry in audit_entries
                    ),
                },
                "entries": audit_entries,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "dataset": str(output),
                "manifest": str(manifest_path),
                "audit": str(audit_path),
                "entries": len(final_entries),
                "safe": safe_count,
                "r18": r18_count,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
