#!/usr/bin/env python3
"""Validate the hand-audited data contract for one unified Nene LoRA.

This is deliberately a *gate*, not an automatic image judge.  A reviewer must
inspect every source image and record the evidence first.  The gate then
checks that those reviews, captions and source hashes are complete before a
OneTrainer configuration can be emitted.

The policy is fixed in code rather than mutable in a manifest:

* a single LoRA learns both normal and R18 Nene samples;
* every R18 source has ``nene_r18`` plus structured, image-specific facts;
* normal sources never have ``nene_r18``;
* every identity anchor has a clear face and uses an ordered prefix containing
  only identity traits that are actually visible.  A close face crop is not
  forced to claim off-frame twintails or ribbons.  Coverage of every canonical
  identity trait is enforced across the complete anchor set instead.  A
  face-visible R18 interaction with a blocked or unclear face may carry only
  the actually visible traits, but must still begin with
  ``ayachi_nene, nene_r18`` and cannot count as an anchor; runtime preserves
  the normal trigger (keep=1) and R18 gate (keep=2), while factual tags may use
  the proven v11 shuffle policy;
* the candidate is built from at least 55 unique, manually approved source
  images across at least 22 visually distinct source groups.  A group may
  contribute at most three genuinely different expression/pose variants:
  controlled repetition preserves v11's useful face exposure without letting
  a screenshot burst dominate the character;
* 12 distinct identity-anchor groups are additionally required (at least 8
  normal and 4 R18), spanning front, left three-quarter and right
  three-quarter face views;
* an identity source must be an untouched source copy, never a crop/mirror;
* a promotable candidate needs an untouched full-body canonical-witch stand
  with the complete asymmetric-legwear specification, plus the one known
  original canonical-witch CG for composition and scene learning.  The source
  material contains only one such CG: crops or near-duplicate screenshots stay
  in its source group and must not masquerade as independent evidence.  The
  stand is an outfit-structure anchor, not a license to invent face traits
  hidden by its hat; face identity is audited independently.

``purpose: identity_probe`` can validate the identity/R18 data without the
canonical-witch production gate, but it is explicitly non-promotable.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


TRIGGER = "ayachi_nene"
R18_TRIGGER = "nene_r18"
CANONICAL_IDENTITY_TAGS = (
    "white_hair",
    "very_long_hair",
    "low_twintails",
    "purple_eyes",
    "ahoge",
    "hair_ribbon",
)
CANONICAL_WITCH_TAGS = (
    "nene_witch_canonical",
    "witch_hat",
    "black_cape",
    "pink_ribbon",
    "pink_bow",
    "striped_bow",
    "criss-cross_halter",
    "crop_top",
    "strap_between_breasts",
    "black_skirt",
    "asymmetrical_legwear",
    "striped_thighhighs",
    "single_thighhigh",
    "single_sock",
    "white_socks",
    "ankle_socks",
    "frilled_socks",
    "boots",
    "black_footwear",
)
IDENTITY_PREFIX = (TRIGGER, *CANONICAL_IDENTITY_TAGS)
R18_IDENTITY_PREFIX = (TRIGGER, R18_TRIGGER, *CANONICAL_IDENTITY_TAGS)

MIN_IDENTITY_ANCHORS = 12
MIN_SAFE_IDENTITY_ANCHORS = 8
MIN_R18_IDENTITY_ANCHORS = 4
MIN_VISIBLE_IDENTITY_TAGS_FOR_ANCHOR = 3
MIN_IDENTITY_TAG_GROUP_COVERAGE = 4
CORE_FACE_IDENTITY_TAGS = {"white_hair", "purple_eyes"}
# v11 used 55 images.  The exact epoch count is derived later from the audited
# count, but a production or probe dataset must never silently shrink below
# this evidence-backed scale.  Unlike an exact-byte duplicate, a small number
# of reviewed expression variants is useful identity reinforcement; cap it.
MIN_TOTAL_ENTRIES = 55
MIN_DISTINCT_DEDUPE_GROUPS = 22
MAX_ENTRIES_PER_DEDUPE_GROUP = 3
REQUIRED_FACE_VIEWS = {"front", "left_three_quarter", "right_three_quarter"}
ALLOWED_FACE_VIEWS = REQUIRED_FACE_VIEWS | {"profile_left", "profile_right", "detail"}
FACT_GROUPS = ("subject", "camera", "pose", "attire_state", "expression", "scene")
ALLOWED_SCOPES = {"solo", "interaction", "detail"}
ALLOWED_OUTFIT_ROLES = {"", "canonical_witch_full_body", "canonical_witch_cg"}
SHA256_RE = re.compile(r"[0-9a-f]{64}")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.errors

    def error(self, message: str) -> None:
        self.errors.append(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def caption_tokens(value: object) -> list[str]:
    if not isinstance(value, str):
        return []
    return [part.strip().lower() for part in value.split(",") if part.strip()]


def required_string(mapping: dict[str, Any], key: str, where: str, result: ValidationResult) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value.strip():
        result.error(f"{where}: missing non-empty {key!r}")
        return ""
    return value.strip()


def required_tag_list(
    mapping: dict[str, Any], key: str, where: str, result: ValidationResult, *, allow_empty: bool = False
) -> list[str]:
    value = mapping.get(key)
    if not isinstance(value, list) or (not allow_empty and not value) or not all(
        isinstance(item, str) and item.strip() for item in value
    ):
        qualifier = "a list of strings" if allow_empty else "a non-empty list of strings"
        result.error(f"{where}: {key!r} must be {qualifier}")
        return []
    tags = [item.strip().lower() for item in value]
    if len(tags) != len(set(tags)):
        result.error(f"{where}: {key!r} must not repeat tags")
    return tags


def validate_contract(manifest: dict[str, Any], result: ValidationResult) -> dict[str, Any]:
    contract = manifest.get("unified_training_contract")
    if not isinstance(contract, dict):
        result.error("manifest: missing unified_training_contract object")
        return {}
    if contract.get("model_count") != 1:
        result.error("unified_training_contract.model_count must be exactly 1")
    if contract.get("trigger") != TRIGGER:
        result.error(f"unified_training_contract.trigger must be {TRIGGER!r}")
    if contract.get("r18_trigger") != R18_TRIGGER:
        result.error(f"unified_training_contract.r18_trigger must be {R18_TRIGGER!r}")
    if contract.get("safe_tag_shuffling") is not True:
        result.error("safe_tag_shuffling must be true: preserve the v11 factual-tag shuffle policy")
    if contract.get("safe_keep_tags_count") != 1:
        result.error("safe_keep_tags_count must be 1: ayachi_nene must remain first")
    if contract.get("r18_tag_shuffling") is not True:
        result.error("r18_tag_shuffling must be true: factual R18 tags may shuffle after the gate")
    if contract.get("r18_keep_tags_count") != 2:
        result.error("r18_keep_tags_count must be 2: ayachi_nene, nene_r18 must remain first")

    purpose = contract.get("purpose")
    if purpose not in {"identity_probe", "production_candidate"}:
        result.error("unified_training_contract.purpose must be identity_probe or production_candidate")
        purpose = ""
    allow_promotion = contract.get("allow_promotion")
    if not isinstance(allow_promotion, bool):
        result.error("unified_training_contract.allow_promotion must be boolean")
        allow_promotion = False
    if purpose == "identity_probe" and allow_promotion:
        result.error("identity_probe must set allow_promotion=false")
    if purpose == "production_candidate" and not allow_promotion:
        result.error("production_candidate must set allow_promotion=true")
    return {"purpose": purpose, "allow_promotion": allow_promotion}


def validate_facts(
    entry: dict[str, Any], where: str, tokens: set[str], result: ValidationResult
) -> None:
    facts = entry.get("facts")
    if not isinstance(facts, dict):
        result.error(f"{where}: facts must be an object with {list(FACT_GROUPS)}")
        return
    missing_groups = [group for group in FACT_GROUPS if group not in facts]
    if missing_groups:
        result.error(f"{where}: facts missing groups {missing_groups}")
    reserved = {TRIGGER, R18_TRIGGER, *CANONICAL_IDENTITY_TAGS}
    for group in FACT_GROUPS:
        value = facts.get(group)
        if not isinstance(value, list) or not all(
            isinstance(item, str) and item.strip() for item in value
        ):
            result.error(f"{where}: facts.{group} must be a list of strings")
            continue
        group_tags = [item.strip().lower() for item in value]
        if len(group_tags) != len(set(group_tags)):
            result.error(f"{where}: facts.{group} repeats a tag")
        if reserved.intersection(group_tags):
            result.error(f"{where}: facts.{group} must not repeat identity or R18 gate tags")
        absent = [tag for tag in group_tags if tag not in tokens]
        if absent:
            result.error(f"{where}: facts.{group} tags absent from caption: {absent}")


def validate_entries(
    manifest_path: Path, manifest: dict[str, Any], contract: dict[str, Any], result: ValidationResult
) -> None:
    entries = manifest.get("entries")
    if not isinstance(entries, list) or not entries:
        result.error("manifest: entries must be a non-empty list")
        return

    source_hashes: dict[str, str] = {}
    export_hashes: dict[str, str] = {}
    dedupe_groups: dict[str, list[str]] = {}
    anchors: list[tuple[str, bool, str, str, tuple[str, ...]]] = []
    witch_full_body_sources: list[str] = []
    witch_cg_sources: list[str] = []
    r18_entries = 0
    safe_entries = 0
    detail_entries = 0

    for index, raw_entry in enumerate(entries, start=1):
        where = f"entries[{index}]"
        if not isinstance(raw_entry, dict):
            result.error(f"{where}: entry must be an object")
            continue
        entry: dict[str, Any] = raw_entry

        relative_file = required_string(entry, "file", where, result)
        source_file = required_string(entry, "source_file", where, result)
        source_hash = required_string(entry, "source_sha256", where, result).lower()
        export_hash = required_string(entry, "export_sha256", where, result).lower()
        caption = required_string(entry, "caption", where, result)
        category = required_string(entry, "category", where, result)
        kind = required_string(entry, "kind", where, result)
        scope = required_string(entry, "subject_scope", where, result).lower()
        if category and not category.replace("_", "").isalnum():
            result.error(f"{where}: category may only use letters, numbers and underscores")
        if kind not in {"source_copy", "derived_crop"}:
            result.error(f"{where}: kind must be source_copy or derived_crop")
        if scope not in ALLOWED_SCOPES:
            result.error(f"{where}: subject_scope must be one of {sorted(ALLOWED_SCOPES)}")
        is_r18 = entry.get("r18")
        if not isinstance(is_r18, bool):
            result.error(f"{where}: r18 must be boolean")
            is_r18 = False

        review = entry.get("review")
        if not isinstance(review, dict):
            result.error(f"{where}: missing structured review object")
            review = {}
        if review.get("approved") is not True:
            result.error(f"{where}: review.approved must be true")
        if required_string(review, "reviewer", f"{where}.review", result) == "":
            pass
        reviewed_at = required_string(review, "reviewed_at", f"{where}.review", result)
        if reviewed_at and not DATE_RE.fullmatch(reviewed_at):
            result.error(f"{where}: review.reviewed_at must use YYYY-MM-DD")
        if required_string(review, "evidence", f"{where}.review", result) == "":
            pass
        expected_content_class = "r18" if is_r18 else "safe"
        if review.get("content_class") != expected_content_class:
            result.error(f"{where}: review.content_class must be {expected_content_class!r}")

        face_visible = review.get("face_visible")
        identity_complete = review.get("identity_complete")
        full_body = review.get("full_body")
        if not isinstance(face_visible, bool):
            result.error(f"{where}: review.face_visible must be boolean")
            face_visible = False
        if not isinstance(identity_complete, bool):
            result.error(f"{where}: review.identity_complete must be boolean")
            identity_complete = False
        if not isinstance(full_body, bool):
            result.error(f"{where}: review.full_body must be boolean")
            full_body = False
        visible_identity = required_tag_list(
            review, "visible_identity_tags", f"{where}.review", result, allow_empty=True
        )
        captioned_identity = required_tag_list(
            review, "captioned_identity_tags", f"{where}.review", result, allow_empty=True
        )
        identity_caption_mode = required_string(
            review, "identity_caption_mode", f"{where}.review", result
        ).lower()
        if identity_caption_mode not in {"keep", "prune"}:
            result.error(f"{where}: review.identity_caption_mode must be keep or prune")
        visible_outfit = required_tag_list(
            review, "visible_outfit_tags", f"{where}.review", result, allow_empty=True
        )
        unknown_identity = set(visible_identity) - set(CANONICAL_IDENTITY_TAGS)
        if unknown_identity:
            result.error(f"{where}: unknown visible identity tags {sorted(unknown_identity)}")
        unknown_captioned_identity = set(captioned_identity) - set(CANONICAL_IDENTITY_TAGS)
        if unknown_captioned_identity:
            result.error(
                f"{where}: unknown captioned identity tags {sorted(unknown_captioned_identity)}"
            )
        if not set(captioned_identity).issubset(set(visible_identity)):
            result.error(f"{where}: captioned identity tags must be visibly reviewed")
        view = required_string(review, "view", f"{where}.review", result).lower()
        if view not in ALLOWED_FACE_VIEWS:
            result.error(f"{where}: review.view must be one of {sorted(ALLOWED_FACE_VIEWS)}")
        dedupe_group = required_string(review, "dedupe_group", f"{where}.review", result)
        if dedupe_group:
            group_members = dedupe_groups.setdefault(dedupe_group, [])
            group_members.append(where)
            if len(group_members) > MAX_ENTRIES_PER_DEDUPE_GROUP:
                result.error(
                    f"{where}: dedupe_group {dedupe_group!r} exceeds the "
                    f"{MAX_ENTRIES_PER_DEDUPE_GROUP}-source cap: {group_members}"
                )

        tokens = caption_tokens(caption)
        if not tokens:
            result.error(f"{where}: caption has no comma-delimited tags")
        token_set = set(tokens)
        validate_facts(entry, where, token_set, result)

        if scope == "solo":
            if "solo" not in token_set:
                result.error(f"{where}: solo source must state 'solo' in the caption")
            facts = entry.get("facts")
            if isinstance(facts, dict) and "solo" not in [str(tag).lower() for tag in facts.get("subject", [])]:
                result.error(f"{where}: solo source must record 'solo' in facts.subject")
        elif scope == "interaction":
            if "solo" in token_set:
                result.error(f"{where}: interaction source must not claim 'solo'")

        if is_r18:
            r18_entries += 1
            if R18_TRIGGER not in token_set:
                result.error(f"{where}: R18 source is missing {R18_TRIGGER!r}")
        else:
            safe_entries += 1
            if R18_TRIGGER in token_set:
                result.error(f"{where}: non-R18 source must not contain {R18_TRIGGER!r}")

        if source_hash and not SHA256_RE.fullmatch(source_hash):
            result.error(f"{where}: source_sha256 must be a lowercase SHA-256")
        if export_hash and not SHA256_RE.fullmatch(export_hash):
            result.error(f"{where}: export_sha256 must be a lowercase SHA-256")
        prior_source = source_hashes.get(source_hash)
        if source_hash and prior_source:
            result.error(f"{where}: source_sha256 duplicates {prior_source}; select one source only")
        elif source_hash:
            source_hashes[source_hash] = where

        if source_file:
            source_path = Path(source_file)
            if not source_path.is_file():
                result.error(f"{where}: source_file is missing: {source_path}")
            elif source_hash and sha256(source_path) != source_hash:
                result.error(f"{where}: source_sha256 does not match source_file")

        if relative_file:
            exported_path = (manifest_path.parent / relative_file).resolve()
            try:
                exported_path.relative_to(manifest_path.parent.resolve())
            except ValueError:
                result.error(f"{where}: file must remain inside the dataset directory")
            if not exported_path.is_file():
                result.error(f"{where}: exported image is missing: {exported_path}")
            else:
                actual_export_hash = sha256(exported_path)
                if export_hash and actual_export_hash != export_hash:
                    result.error(f"{where}: export_sha256 does not match exported image")
                prior_export = export_hashes.get(actual_export_hash)
                if prior_export:
                    result.error(f"{where}: exported image duplicates {prior_export}")
                else:
                    export_hashes[actual_export_hash] = where
                if kind == "source_copy" and source_hash and actual_export_hash != source_hash:
                    result.error(f"{where}: source_copy must preserve source bytes exactly")
                caption_path = exported_path.with_suffix(".txt")
                if not caption_path.is_file():
                    result.error(f"{where}: exported caption is missing: {caption_path}")
                elif caption_tokens(caption_path.read_text(encoding="utf-8")) != tokens:
                    result.error(f"{where}: exported caption differs from manifest.caption")

        if face_visible:
            if kind != "source_copy":
                result.error(f"{where}: face-visible identity evidence must be a source_copy, not a crop")
            if scope == "detail":
                result.error(f"{where}: face-visible source cannot use subject_scope='detail'")
            if not tokens or tokens[0] != TRIGGER:
                result.error(f"{where}: face-visible source must begin with {TRIGGER!r}")
            if is_r18 and (len(tokens) < 2 or tokens[1] != R18_TRIGGER):
                result.error(f"{where}: face-visible R18 source must begin with {TRIGGER!r}, {R18_TRIGGER!r}")
            absent_captioned = [tag for tag in captioned_identity if tag not in token_set]
            if absent_captioned:
                result.error(
                    f"{where}: captioned identity tags absent from caption: {absent_captioned}"
                )
            unexpected_identity = [
                tag
                for tag in CANONICAL_IDENTITY_TAGS
                if tag in token_set and tag not in captioned_identity
            ]
            if unexpected_identity:
                result.error(
                    f"{where}: caption contains identity tags not declared by the review: "
                    f"{unexpected_identity}"
                )
            if identity_caption_mode == "keep" and captioned_identity != visible_identity:
                result.error(f"{where}: keep mode must caption all reviewed visible identity tags")
            if identity_caption_mode == "prune" and captioned_identity:
                result.error(f"{where}: prune mode must not caption identity tags")
            if view == "detail":
                result.error(f"{where}: face-visible source cannot have review.view='detail'")
            if identity_complete:
                ordered_visible_identity = tuple(
                    tag for tag in CANONICAL_IDENTITY_TAGS if tag in visible_identity
                )
                if tuple(visible_identity) != ordered_visible_identity:
                    result.error(
                        f"{where}: anchor visible_identity_tags must follow canonical order "
                        f"{list(ordered_visible_identity)}"
                    )
                missing_core = CORE_FACE_IDENTITY_TAGS - set(visible_identity)
                if missing_core:
                    result.error(
                        f"{where}: identity anchor is missing visible core face tags "
                        f"{sorted(missing_core)}"
                    )
                if len(visible_identity) < MIN_VISIBLE_IDENTITY_TAGS_FOR_ANCHOR:
                    result.error(
                        f"{where}: identity anchor needs at least "
                        f"{MIN_VISIBLE_IDENTITY_TAGS_FOR_ANCHOR} actually visible identity tags"
                    )
                gate_prefix = (TRIGGER, R18_TRIGGER) if is_r18 else (TRIGGER,)
                controls = [
                    tag
                    for tag in tokens[len(gate_prefix) :]
                    if tag.startswith("nene_") and tag not in CANONICAL_IDENTITY_TAGS
                ]
                expected_prefix = (*gate_prefix, *controls, *ordered_visible_identity)
                if tuple(tokens[: len(expected_prefix)]) != expected_prefix:
                    result.error(
                        f"{where}: identity caption must start with {list(expected_prefix)}"
                    )
                anchors.append((where, is_r18, view, dedupe_group, ordered_visible_identity))
        else:
            detail_entries += 1
            if visible_identity:
                result.error(f"{where}: face-absent source must not list visible identity tags")
            if identity_complete:
                result.error(f"{where}: face-absent source cannot be an identity anchor")
            if scope != "detail":
                result.error(f"{where}: face-absent source must use subject_scope='detail'")
            if view != "detail":
                result.error(f"{where}: face-absent source must use review.view='detail'")
            forbidden_identity = [tag for tag in IDENTITY_PREFIX if tag in token_set]
            if forbidden_identity:
                result.error(
                    f"{where}: face-absent detail must not bind identity tags {forbidden_identity}"
                )

        outfit_role = entry.get("outfit_role", "")
        if outfit_role not in ALLOWED_OUTFIT_ROLES:
            result.error(f"{where}: unsupported outfit_role {outfit_role!r}")
        if outfit_role:
            if not face_visible or kind != "source_copy":
                result.error(f"{where}: canonical witch evidence must be a face-visible source_copy")
            if not visible_outfit:
                result.error(f"{where}: canonical witch source needs reviewed visible_outfit_tags")
            absent_outfit = [tag for tag in visible_outfit if tag not in token_set]
            if absent_outfit:
                result.error(f"{where}: reviewed visible outfit tags absent from caption: {absent_outfit}")
            for required_witch_tag in ("nene_witch_canonical",):
                if required_witch_tag not in token_set:
                    result.error(f"{where}: canonical witch source is missing {required_witch_tag!r}")
        if outfit_role == "canonical_witch_full_body":
            if not full_body:
                result.error(f"{where}: full-body witch stand needs full_body=true")
            missing_witch = [tag for tag in CANONICAL_WITCH_TAGS if tag not in token_set]
            if missing_witch:
                result.error(f"{where}: full-body witch stand is missing tags {missing_witch}")
            witch_full_body_sources.append(where)
        elif outfit_role == "canonical_witch_cg":
            witch_cg_sources.append(where)

    safe_anchor_groups = {group for _, is_r18, _, group, _ in anchors if not is_r18 and group}
    r18_anchor_groups = {group for _, is_r18, _, group, _ in anchors if is_r18 and group}
    anchor_groups = safe_anchor_groups | r18_anchor_groups
    safe_anchor_count = len(safe_anchor_groups)
    r18_anchor_count = len(r18_anchor_groups)
    anchor_views = {view for _, _, view, _, _ in anchors}
    identity_tag_group_coverage = {
        tag: len(
            {
                group
                for _, _, _, group, visible_tags in anchors
                if group and tag in visible_tags
            }
        )
        for tag in CANONICAL_IDENTITY_TAGS
    }
    if len(entries) < MIN_TOTAL_ENTRIES:
        result.error(
            f"dataset has {len(entries)} selected sources; requires at least {MIN_TOTAL_ENTRIES} "
            "unique, manually approved sources"
        )
    if len(dedupe_groups) < MIN_DISTINCT_DEDUPE_GROUPS:
        result.error(
            f"dataset has {len(dedupe_groups)} distinct source groups; requires at least "
            f"{MIN_DISTINCT_DEDUPE_GROUPS}"
        )
    if len(anchor_groups) < MIN_IDENTITY_ANCHORS:
        result.error(
            f"dataset has {len(anchor_groups)} distinct identity-anchor groups; "
            f"requires at least {MIN_IDENTITY_ANCHORS}"
        )
    if safe_anchor_count < MIN_SAFE_IDENTITY_ANCHORS:
        result.error(f"dataset has {safe_anchor_count} safe anchors; requires at least {MIN_SAFE_IDENTITY_ANCHORS}")
    if r18_anchor_count < MIN_R18_IDENTITY_ANCHORS:
        result.error(f"dataset has {r18_anchor_count} R18 anchors; requires at least {MIN_R18_IDENTITY_ANCHORS}")
    missing_views = REQUIRED_FACE_VIEWS - anchor_views
    if missing_views:
        result.error(f"identity anchors missing required face views {sorted(missing_views)}")
    undercovered_identity_tags = {
        tag: count
        for tag, count in identity_tag_group_coverage.items()
        if count < MIN_IDENTITY_TAG_GROUP_COVERAGE
    }
    if undercovered_identity_tags:
        result.error(
            "identity traits lack independent anchor-group coverage "
            f"(minimum {MIN_IDENTITY_TAG_GROUP_COVERAGE} each): {undercovered_identity_tags}"
        )
    if not r18_entries:
        result.error("unified dataset has no R18 sources")
    if not safe_entries:
        result.error("unified dataset has no non-R18 sources")

    if contract.get("purpose") == "production_candidate":
        if len(witch_full_body_sources) < 1:
            result.error("promotable dataset needs an approved canonical_witch_full_body stand")
        if len(witch_cg_sources) < 1:
            result.error("promotable dataset needs the approved canonical_witch_cg composition source")
        elif len(witch_cg_sources) > 1:
            result.error(
                "promotable dataset must designate exactly one original canonical_witch_cg; "
                "crops and near-duplicate screenshots are same-source reinforcement, not "
                "additional canonical evidence"
            )

    result.summary.update(
        {
            "entries": len(entries),
            "minimum_entries": MIN_TOTAL_ENTRIES,
            "r18_entries": r18_entries,
            "non_r18_entries": safe_entries,
            "face_absent_details": detail_entries,
            "identity_anchors": len(anchor_groups),
            "safe_identity_anchors": safe_anchor_count,
            "r18_identity_anchors": r18_anchor_count,
            "identity_views": sorted(anchor_views),
            "identity_tag_group_coverage": identity_tag_group_coverage,
            "canonical_witch_full_body_sources": len(witch_full_body_sources),
            "canonical_witch_cg_sources": len(witch_cg_sources),
            "distinct_dedupe_groups": len(dedupe_groups),
            "max_entries_per_dedupe_group": max((len(items) for items in dedupe_groups.values()), default=0),
            "distinct_source_hashes": len(source_hashes),
            "distinct_export_hashes": len(export_hashes),
        }
    )


def validate(manifest_path: Path) -> ValidationResult:
    result = ValidationResult()
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        result.error(f"cannot read manifest {manifest_path}: {exc}")
        return result
    if not isinstance(payload, dict):
        result.error("manifest root must be an object")
        return result
    contract = validate_contract(payload, result)
    validate_entries(manifest_path, payload, contract, result)
    result.summary["manifest"] = str(manifest_path)
    result.summary["status"] = "pass" if result.ok else "fail"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path, help="versioned dataset-manifest.json")
    parser.add_argument("--report", type=Path, help="optional JSON report path")
    args = parser.parse_args()
    result = validate(args.manifest.resolve())
    payload = {"ok": result.ok, "summary": result.summary, "errors": result.errors}
    rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    print(rendered)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(rendered + "\n", encoding="utf-8")
    return 0 if result.ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
