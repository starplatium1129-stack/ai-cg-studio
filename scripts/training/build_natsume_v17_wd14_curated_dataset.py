#!/usr/bin/env python3
"""Build the visually curated, unified Natsume v17 WD14 dataset."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime
from pathlib import Path


TRIGGER = "shiki_natsume"
R18_TRIGGER = "natsume_r18"
IDENTITY_TAGS = ("black_hair", "long_hair", "very_long_hair", "yellow_eyes", "mole_under_eye", "hair_ornament", "hairclip")
IDENTITY_FILTER = set(IDENTITY_TAGS)
SIZE_TAGS = {"flat_chest", "small_breasts", "medium_breasts", "large_breasts", "huge_breasts", "gigantic_breasts"}
REMOVE_TAGS = {
    "brown_hair", "brown_eyes", "short_hair", "no_pussy", "no_shoes",
    "watermark", "signature", "artist_name", "text", "logo", "border",
} | SIZE_TAGS

# Current-model visual review of all 76 v16 exports.  Near-identical event
# frames were reduced to one or, where expression/body evidence differs, two.
SELECTED_NUMBERS = {
    8, 9, 12, 13, 16, 22, 25, 26, 28, 30, 33, 36, 37, 38, 39,
    40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 53, 55, 57,
    58, 59, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 76,
}
R18_NUMBERS = {9, 13, 25, 26, 28, 30, 33, 45, 46, 63, 64, 65, 66, 67, 68, 69, 70}
ANCHOR_NUMBERS = {43, 44, 45, 57, 58, 59, 70, 71, 72, 73, 74, 76}

OUTFIT_CONTROLS = {
    "natsume_official_qipao": {43, 44, 49, 59, 69, 73, 76},
    "natsume_cafe_uniform": {16, 22, 36, 48, 64},
    "natsume_pink_cafe_uniform": {39, 40, 47, 58},
    "natsume_maid_uniform": {12, 33, 41, 42, 55, 57},
    "natsume_winter_coat": {8, 50, 51},
    "natsume_sleepwear": {47, 53, 74},
}
CUSTOM_CONTROLS = set(OUTFIT_CONTROLS)

CORE_ADDITIONS = {
    43: {"chinese_clothes", "china_dress", "red_dress", "floral_print", "double_bun", "red_flower", "black_thighhighs", "side_slit"},
    44: {"chinese_clothes", "china_dress", "red_dress", "floral_print", "double_bun", "red_flower", "black_thighhighs", "side_slit"},
    49: {"chinese_clothes", "china_dress", "red_dress", "floral_print", "double_bun", "red_flower", "black_thighhighs", "garter_straps", "side_slit"},
    59: {"chinese_clothes", "china_dress", "red_dress", "floral_print", "double_bun", "red_flower", "black_pantyhose", "black_footwear", "full_body", "side_slit"},
    69: {"chinese_clothes", "china_dress", "red_dress", "floral_print", "double_bun", "red_flower", "black_thighhighs", "garter_straps", "side_slit"},
    73: {"chinese_clothes", "china_dress", "red_dress", "floral_print", "double_bun", "red_flower"},
    76: {"chinese_clothes", "china_dress", "red_dress", "floral_print", "double_bun", "red_flower", "black_thighhighs", "side_slit"},
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def number_from_file(value: str) -> int:
    return int(Path(value).stem.rsplit("_", 1)[1])


def keep_identity(number: int) -> bool:
    if number in ANCHOR_NUMBERS:
        return True
    return int(hashlib.sha256(f"natsume-v17-{number}".encode()).hexdigest()[:8], 16) % 2 == 0


def ordered_caption(number: int, tags: list[str], r18: bool) -> list[str]:
    cleaned: list[str] = []
    for tag in tags:
        tag = str(tag).strip().replace(" ", "_")
        if not tag or tag in REMOVE_TAGS or tag in {TRIGGER, R18_TRIGGER}:
            continue
        if tag in IDENTITY_FILTER and not keep_identity(number):
            continue
        if tag not in cleaned:
            cleaned.append(tag)
    for tag in sorted(CORE_ADDITIONS.get(number, set())):
        if tag not in cleaned:
            cleaned.append(tag)
    controls = [control for control, numbers in OUTFIT_CONTROLS.items() if number in numbers]
    identity = [tag for tag in IDENTITY_TAGS if tag in cleaned]
    facts = [tag for tag in cleaned if tag not in IDENTITY_FILTER and tag not in CUSTOM_CONTROLS]
    return [TRIGGER, *([R18_TRIGGER] if r18 else []), *controls, *identity, *facts]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(r"E:\code\2\lora\AI\Datasets\v16\natsume"))
    parser.add_argument("--raw-tags", type=Path, default=Path(r"E:\code\2\lora\AI\Reviews\natsume_v17_wd14_raw_2026-07-30.json"))
    parser.add_argument("--output", type=Path, default=Path(r"E:\code\2\lora\AI\Datasets\Characters\Shiki_Natsume\V17_WD14_Curated"))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    if output.exists():
        if not args.force:
            raise RuntimeError(f"output exists: {output}; pass --force to rebuild")
        shutil.rmtree(output)
    output.mkdir(parents=True)

    manifest = json.loads((source / "dataset-manifest.json").read_text(encoding="utf-8"))
    raw = json.loads(args.raw_tags.read_text(encoding="utf-8"))
    raw_by_file = {str(entry["file"]): entry for entry in raw["entries"]}
    selected = [entry for entry in manifest["entries"] if number_from_file(str(entry["file"])) in SELECTED_NUMBERS]
    if len(selected) != len(SELECTED_NUMBERS):
        raise RuntimeError(f"selected {len(selected)} entries, expected {len(SELECTED_NUMBERS)}")

    records: list[dict[str, object]] = []
    seen_hashes: set[str] = set()
    for entry in selected:
        number = number_from_file(str(entry["file"]))
        raw_entry = raw_by_file[str(entry["file"]).replace("\\", "/")]
        source_image = source / str(entry["file"])
        digest = sha256(source_image)
        if digest in seen_hashes:
            raise RuntimeError(f"exact duplicate survived selection: {entry['file']}")
        seen_hashes.add(digest)
        r18 = number in R18_NUMBERS
        qipao = number in OUTFIT_CONTROLS["natsume_official_qipao"]
        category = "identity_r18" if r18 else ("qipao_safe" if qipao else "identity_safe")
        stem = f"natsume_v17_{number:04d}"
        destination = output / category / f"{stem}{source_image.suffix.lower()}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_image, destination)
        caption_tags = ordered_caption(number, list(raw_entry["wd14_tags"]), r18)
        caption = ", ".join(caption_tags)
        destination.with_suffix(".txt").write_text(caption + "\n", encoding="utf-8")
        records.append({
            "id": stem,
            "number": number,
            "file": destination.relative_to(output).as_posix(),
            "source": str(entry.get("source", source_image)),
            "source_dataset_file": str(entry["file"]),
            "source_sha256": digest,
            "export_sha256": sha256(destination),
            "category": category,
            "r18": r18,
            "identity_anchor": number in ANCHOR_NUMBERS,
            "identity_caption_mode": "keep" if keep_identity(number) else "prune",
            "controls": [control for control, numbers in OUTFIT_CONTROLS.items() if number in numbers],
            "caption": caption,
            "visual_review": "current-model visual audit 2026-07-30; retained for unique identity, body, outfit, expression or composition evidence",
        })

    safe = sum(not bool(record["r18"]) for record in records)
    adult = len(records) - safe
    qipao_full = sum("full_body" in str(record["caption"]) and "natsume_official_qipao" in str(record["caption"]) for record in records)
    if adult == 0 or safe == 0 or qipao_full < 1:
        raise RuntimeError("dataset gates failed: unified safe/R18 and full-body qipao evidence are required")
    payload = {
        "schema": "ai-cg-studio.natsume-v17-wd14-curated/v1",
        "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "character": "shiki_natsume",
        "trigger": TRIGGER,
        "r18_trigger": R18_TRIGGER,
        "caption_policy": "project WD14 raw tags plus current-model per-image visual curation; hybrid identity; R18 size-class tags removed",
        "unified_training_contract": {"purpose": "production_candidate", "allow_promotion": True, "single_lora": True, "r18_addon": False},
        "counts": {"total": len(records), "safe": safe, "r18": adult, "qipao_full_body": qipao_full},
        "selection": {"source_total": len(manifest["entries"]), "selected": len(records), "rejected_near_duplicates": len(manifest["entries"]) - len(records)},
        "entries": records,
    }
    (output / "dataset-manifest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "VISUAL_AUDIT.json").write_text(json.dumps({
        "schema": "ai-cg-studio.natsume-v17-visual-audit/v1",
        "reviewed_source_sheets": r"E:\code\2\lora\AI\Reviews\natsume_v17_source_audit_2026-07-30",
        "reviewed_count": len(manifest["entries"]),
        "selected_numbers": sorted(SELECTED_NUMBERS),
        "rejected_policy": "remove near-identical event frames while retaining distinct face, body, outfit, pose and interaction evidence",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "counts": payload["counts"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
