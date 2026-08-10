#!/usr/bin/env python3
"""Prepare the Natsume Anima v19 scientific dataset and OneTrainer config.

The source manifest is intentionally treated as immutable.  This run has no
random image split: groups are derived from official-event/source stems and
confirmed with byte hashes and perceptual hashes before the fixed holdout is
applied.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageOps


DEFAULT_HOLDOUT_GROUPS = (
    "official_5013",
    "stand_v12_02",
    "official_5014",
    "cg_v12_04",
    "official_5018",
)
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
SAFETY_TAGS = {"safe", "sensitive", "nsfw", "explicit"}
SUBJECT_TAGS = {
    "1girl", "1boy", "1other", "2girls", "2boys", "multiple_girls",
    "multiple_boys", "solo", "hetero", "pov", "pov_hands", "solo_focus",
}
SENSITIVE_TAGS = {
    "breasts", "breasts_out", "cleavage", "underwear", "panties", "bra",
    "lingerie", "nipples", "nude", "completely_nude", "topless", "sideboob",
    "thighhighs", "garter_belt", "garter_straps", "clothes_lift", "skirt_lift",
    "open_clothes", "open_shirt", "bare_shoulders", "sexually_suggestive",
}
EXPLICIT_TAGS = {
    "penis", "pussy", "sex", "imminent_penetration", "girl_on_top", "doggystyle",
    "vibrator", "sex_toy", "handjob", "female_masturbation", "breast_grab",
    "ass_grab", "torso_grab", "implied_sex",
}
IDENTITY_TAGS = {
    "black_hair", "long_hair", "very_long_hair", "yellow_eyes", "mole_under_eye",
    "mole", "hairclip", "hair_ornament", "bangs", "straight_hair", "sidelocks",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tags(caption: str) -> list[str]:
    return [value.strip().lower() for value in caption.split(",") if value.strip()]


def normalize_tag(tag: str) -> str:
    if tag == "shiki_natsume" or tag == "natsume_r18" or tag.startswith("natsume_"):
        return tag
    return tag.replace("_", " ")


def perceptual_hash(path: Path) -> int:
    with Image.open(path) as image:
        image = ImageOps.grayscale(image).resize((8, 8), Image.Resampling.LANCZOS)
        pixels = list(image.getdata())
    average = sum(pixels) / len(pixels)
    result = 0
    for pixel in pixels:
        result = (result << 1) | int(pixel >= average)
    return result


def hamming(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def source_event_key(source: str) -> str:
    stem = Path(source).stem.lower()
    stem = re.sub(r"_face$", "", stem)
    match = re.search(r"(?:^|_)(50(?:0|1)\d)(?:_|$)", stem)
    if match:
        return f"official_{match.group(1)}"
    match = re.search(r"v12_cg[_-]?(\d+)", stem)
    if match:
        return f"cg_v12_{int(match.group(1)):02d}"
    match = re.search(r"v12_stand[_-]?(\d+)", stem)
    if match:
        return f"stand_v12_{int(match.group(1)):02d}"
    if stem.startswith("screenshot_"):
        return "curated_" + stem.removeprefix("screenshot_")
    if stem.startswith("base_screenshot_"):
        return "qipao_addon_" + stem.removeprefix("base_screenshot_")
    match = re.search(r"(?:^|_)ev\d+_entry_\d+_([0-9a-z]+)", stem)
    if match:
        return f"official_{match.group(1)}"
    return "source_" + re.sub(r"[^a-z0-9]+", "_", stem).strip("_")


def safety_tag(entry: dict[str, Any], original: list[str]) -> str:
    if not entry["r18"]:
        return "sensitive" if SENSITIVE_TAGS.intersection(original) else "safe"
    return "explicit" if EXPLICIT_TAGS.intersection(original) else "nsfw"


def anima_caption(entry: dict[str, Any]) -> str:
    original = tags(str(entry["original_caption"]))
    controls = [str(value).lower() for value in entry.get("controls", []) if str(value).startswith("natsume_")]
    prefix = [safety_tag(entry, original)]
    if entry["r18"]:
        prefix.append("natsume_r18")
    prefix.extend(value for value in original if value in SUBJECT_TAGS)
    prefix.append("shiki_natsume")
    prefix.extend(value for value in controls if value not in prefix)
    prefix.extend(value for value in original if value in IDENTITY_TAGS and value not in prefix)
    reserved = SAFETY_TAGS | SUBJECT_TAGS | {"shiki_natsume", "natsume_r18"} | set(controls) | IDENTITY_TAGS
    ordered = prefix + [value for value in original if value not in reserved]
    normalized: list[str] = []
    seen: set[str] = set()
    for value in ordered:
        normalized_value = normalize_tag(value)
        if normalized_value and normalized_value not in seen:
            normalized.append(normalized_value)
            seen.add(normalized_value)
    return ", ".join(normalized)


def load_manifest(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("entries"), list):
        raise RuntimeError(f"invalid source manifest: {path}")
    return payload


def derive_entries(source_manifest: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    source = load_manifest(source_manifest)
    if len(source["entries"]) != 45:
        raise RuntimeError(f"expected 45 source entries, got {len(source['entries'])}")
    source_root = source_manifest.parent
    hash_index: dict[str, Path] = {}
    for candidate in source_root.rglob("*"):
        if candidate.is_file() and candidate.suffix.lower() in IMAGE_SUFFIXES:
            hash_index.setdefault(sha256(candidate), candidate)
    entries: list[dict[str, Any]] = []
    for raw in source["entries"]:
        image = source_root / str(raw["file"])
        expected_hash = str(raw["export_sha256"])
        declared_source = Path(str(raw.get("source", "")))
        if not image.is_file() and declared_source.is_file() and sha256(declared_source) == expected_hash:
            image = declared_source
        if image.suffix.lower() not in IMAGE_SUFFIXES or not image.is_file():
            image = hash_index.get(expected_hash, image)
        if image.suffix.lower() not in IMAGE_SUFFIXES or not image.is_file():
            raise RuntimeError(f"missing source image and hash match: {source_root / str(raw['file'])}")
        actual_hash = sha256(image)
        if actual_hash != expected_hash:
            raise RuntimeError(f"source hash mismatch: {image}")
        source_key = source_event_key(str(raw.get("source", raw["file"])))
        entries.append({
            "id": raw["id"],
            "source_file": str(image),
            "manifest_file": str(raw["file"]),
            "source": raw.get("source", ""),
            "file": str(raw["file"]),
            "category": raw.get("category", ""),
            "r18": bool(raw["r18"]),
            "controls": list(raw.get("controls", [])),
            "original_caption": raw["caption"],
            "sha256": actual_hash,
            "perceptual_hash": f"{perceptual_hash(image):016x}",
            "visual_group": source_key,
        })

    # Exact bytes and very-close perceptual variants must share a group even
    # when a later curation pass used a different source stem.
    parent = {entry["visual_group"]: entry["visual_group"] for entry in entries}

    def find(value: str) -> str:
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def union(left: str, right: str) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for index, left in enumerate(entries):
        for right in entries[index + 1:]:
            same_bytes = left["sha256"] == right["sha256"]
            close_pixels = hamming(int(left["perceptual_hash"], 16), int(right["perceptual_hash"], 16)) <= 2
            if same_bytes or close_pixels:
                union(left["visual_group"], right["visual_group"])
    for entry in entries:
        entry["visual_group"] = find(entry["visual_group"])

    aliases: dict[str, str] = {}
    for entry in entries:
        group = entry["visual_group"]
        aliases.setdefault(group, group)
    # Keep the human-readable event key stable because it is the audit and
    # holdout contract, not an opaque random assignment.
    group_map = {group: group for group in sorted(aliases)}
    for entry in entries:
        entry["visual_group"] = group_map[entry["visual_group"]]
    return entries, {
        "source_manifest_sha256": sha256(source_manifest),
        "group_map": group_map,
    }


def validate_split(entries: list[dict[str, Any]], holdout: set[str]) -> None:
    groups = {entry["visual_group"] for entry in entries}
    unknown = sorted(holdout - groups)
    if unknown:
        raise RuntimeError(f"unknown holdout groups: {unknown}")
    train_groups = groups - holdout
    if len(train_groups) < 20:
        raise RuntimeError(f"training split has only {len(train_groups)} independent visual groups")
    controls_by_partition: dict[str, set[str]] = {"train": set(), "validation": set()}
    for entry in entries:
        partition = "validation" if entry["visual_group"] in holdout else "train"
        controls_by_partition[partition].update(entry["controls"])
    unsupported = sorted(value for value in controls_by_partition["validation"] if value not in controls_by_partition["train"])
    if unsupported:
        raise RuntimeError(f"validation controls absent from training: {unsupported}")


def partition(entry: dict[str, Any], holdout: set[str]) -> str:
    validation = entry["visual_group"] in holdout
    if validation:
        return "validation_r18" if entry["r18"] else "validation_safe"
    return "train_r18" if entry["r18"] else "train_safe"


def write_contact_sheets(entries: list[dict[str, Any]], evidence_root: Path) -> None:
    evidence_root.mkdir(parents=True, exist_ok=True)
    groups = sorted({entry["visual_group"] for entry in entries})
    font = ImageFont.load_default()
    for sheet_index in range(0, len(entries), 9):
        batch = entries[sheet_index:sheet_index + 9]
        sheet = Image.new("RGB", (1800, 1350), (22, 20, 27))
        draw = ImageDraw.Draw(sheet)
        for cell, entry in enumerate(batch):
            row, column = divmod(cell, 3)
            with Image.open(entry["source_file"]) as image:
                preview = ImageOps.contain(image.convert("RGB"), (560, 390))
            x = column * 600 + (560 - preview.width) // 2 + 20
            y = row * 450 + 20
            sheet.paste(preview, (x, y))
            label = f"{entry['id']} | {entry['visual_group']} | {'r18' if entry['r18'] else 'safe'}"
            draw.text((column * 600 + 20, row * 450 + 415), label, fill=(240, 235, 245), font=font)
        sheet.save(evidence_root / f"contact-sheet-{sheet_index // 9 + 1:02d}.jpg", quality=94)
    (evidence_root / "group-index.json").write_text(
        json.dumps({"groups": groups, "entries": entries}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def build_dataset(source_manifest: Path, output: Path, evidence_root: Path, holdout: set[str]) -> dict[str, Any]:
    entries, derivation = derive_entries(source_manifest)
    validate_split(entries, holdout)
    if output.exists():
        shutil.rmtree(output)
    for name in ("train_safe", "train_r18", "validation_safe", "validation_r18"):
        (output / name).mkdir(parents=True, exist_ok=True)

    emitted: list[dict[str, Any]] = []
    counts: Counter[str] = Counter()
    safety_counts: Counter[str] = Counter()
    for index, entry in enumerate(entries, start=1):
        target_partition = partition(entry, holdout)
        source_image = Path(entry["source_file"])
        target_image = output / target_partition / f"{index:03d}_{entry['id']}{source_image.suffix.lower()}"
        target_caption = target_image.with_suffix(".txt")
        shutil.copy2(source_image, target_image)
        caption = anima_caption(entry)
        target_caption.write_text(caption + "\n", encoding="utf-8", newline="\n")
        if sha256(target_image) != entry["sha256"]:
            raise RuntimeError(f"copy changed image bytes: {target_image}")
        emitted_entry = {
            **entry,
            "dedupe_group": entry["visual_group"],
            "partition": target_partition,
            "file": str(target_image.relative_to(output)).replace("\\", "/"),
            "caption": caption,
            "manual_visual_review": {
                "status": "reviewed",
                "evidence": "AI/Reviews/AnimaNatsumeV19Dataset/2026-08-09/contact-sheet-01..05.jpg reviewed cell-by-cell with vision.js",
                "checks": ["identity", "face", "long black hair", "golden eyes when visible", "red hair clips when visible", "under-eye mole when visible", "clothing", "limbs", "extra-person separation", "composition", "safety taxonomy"],
                "red_hair_clips": "asserted only when visible; not added as a universal caption token",
            },
        }
        emitted.append(emitted_entry)
        counts[target_partition] += 1
        safety_counts[caption.split(",", 1)[0]] += 1

    group_partitions = {group: ("validation" if group in holdout else "train") for group in sorted({entry["visual_group"] for entry in entries})}
    manifest = {
        "schema": "ai-cg-studio.natsume-anima-v19-experiment/v1",
        "base_model": "circlestone-labs/Anima Base v1.0",
        "source_manifest": str(source_manifest),
        "source_manifest_sha256": derivation["source_manifest_sha256"],
        "split_policy": {
            "unit": "derived visual group from official event/source stem, byte SHA-256 and perceptual hash",
            "seed": None,
            "holdout_groups": sorted(holdout),
            "group_partitions": group_partitions,
            "rule": "No visual group or near-duplicate variant may cross train and validation; no random image split.",
        },
        "caption_policy": {
            "reference": "https://huggingface.co/circlestone-labs/Anima",
            "ordinary_tag_spelling": "lowercase spaces; comma followed by one space",
            "preserved_lora_tokens": ["shiki_natsume", "natsume_r18", "natsume_*"],
            "safety": {"safe": "safe", "non_explicit_suggestive": "sensitive", "adult_nudity_or_exposure": "nsfw + natsume_r18", "explicit_act_or_genital": "explicit + natsume_r18"},
            "random_flip": False,
            "crop_jitter": False,
            "color_augmentation": False,
            "tag_shuffle": False,
            "tag_dropout": False,
        },
        "summary": {
            "entries": len(emitted),
            "independent_visual_groups": len(group_partitions),
            "train_visual_groups": len(group_partitions) - len(holdout),
            "validation_visual_groups": len(holdout),
            "safety_labels": dict(sorted(safety_counts.items())),
            **dict(sorted(counts.items())),
        },
        "entries": emitted,
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "experiment-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    write_contact_sheets(entries, evidence_root)
    return manifest


def concept_from(template: dict[str, Any], name: str, path: Path, concept_type: str, seed: int) -> dict[str, Any]:
    concept = json.loads(json.dumps(template))
    concept.update({"name": name, "path": str(path), "seed": seed, "enabled": True, "type": concept_type, "include_subdirectories": False, "image_variations": 1, "text_variations": 1, "balancing": 1, "loss_weight": 1})
    for key in ("enable_crop_jitter", "enable_random_flip", "enable_fixed_flip", "enable_random_rotate", "enable_fixed_rotate", "enable_random_brightness", "enable_fixed_brightness", "enable_random_contrast", "enable_fixed_contrast", "enable_random_saturation", "enable_fixed_saturation", "enable_random_hue", "enable_fixed_hue"):
        concept["image"][key] = False
    concept["text"].update({"enable_tag_shuffling": False, "tag_delimiter": ",", "keep_tags_count": 0, "tag_dropout_enable": False, "tag_dropout_probability": 0})
    return concept


def build_config(base_config: Path, dataset: Path, destination: Path) -> dict[str, Any]:
    config = json.loads(base_config.read_text(encoding="utf-8-sig"))
    template = config["concepts"][0]
    run_name = "shiki_natsume_v19_anima_scientific_a"
    one_trainer = base_config.parents[1]
    config.update({
        "workspace_dir": str(one_trainer / "workspace" / run_name),
        "cache_dir": str(one_trainer / "workspace-cache" / run_name),
        "output_model_destination": str(one_trainer / "output" / f"{run_name}.safetensors"),
        "base_model_name": str(one_trainer / "models" / "anima-base-v1.0-diffusers"),
        "validation": True, "validate_after": 1, "validate_after_unit": "EPOCH", "tensorboard_port": 6007,
        "output_dtype": "BFLOAT_16", "learning_rate_scheduler": "CONSTANT", "learning_rate": 0.00002,
        "learning_rate_warmup_steps": 0, "epochs": 16, "batch_size": 1, "gradient_accumulation_steps": 1,
        "resolution": "1024", "train_dtype": "BFLOAT_16", "fallback_train_dtype": "BFLOAT_16",
        "timestep_distribution": "LOGIT_NORMAL", "loss_weight_fn": "CONSTANT", "timestep_shift": 1,
        "dynamic_timestep_shifting": False, "layer_filter": "attn1,attn2,ff", "layer_filter_preset": "attn-mlp",
        "dropout_probability": 0, "lora_rank": 32, "lora_alpha": 32, "lora_weight_dtype": "FLOAT_32",
    })
    config["transformer"].update({"train": True, "learning_rate": 0.00002})
    config["text_encoder"].update({"train": False, "learning_rate": 0})
    config["vae"]["train"] = False
    config["optimizer"].update({"optimizer": "ADAMW", "beta1": 0.9, "beta2": 0.99, "eps": 1e-8, "weight_decay": 0.01, "stochastic_rounding": True})
    config["concepts"] = [
        concept_from(template, "natsume_v19_train_safe", dataset / "train_safe", "STANDARD", 2026080901),
        concept_from(template, "natsume_v19_train_r18", dataset / "train_r18", "STANDARD", 2026080902),
        concept_from(template, "natsume_v19_validation_safe", dataset / "validation_safe", "VALIDATION", 2026080903),
        concept_from(template, "natsume_v19_validation_r18", dataset / "validation_r18", "VALIDATION", 2026080904),
    ]
    positive = "masterpiece, best quality, score_7"
    negative = "worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration"
    prompts = [
        f"{positive}, safe, 1girl, shiki_natsume, black hair, very long hair, yellow eyes, mole under eye, portrait, upper body, looking at viewer, simple background",
        f"{positive}, safe, 1girl, shiki_natsume, natsume_cafe_uniform, black hair, very long hair, yellow eyes, full body, standing, cafe",
        f"{positive}, safe, 1girl, shiki_natsume, natsume_official_qipao, black hair, yellow eyes, full body, standing, lantern light",
        f"{positive}, explicit, natsume_r18, 1girl, shiki_natsume, black hair, yellow eyes, solo, full body, simple background",
    ]
    for sample, prompt in zip(config["samples"], prompts):
        sample.update({"prompt": prompt, "negative_prompt": negative, "height": 1024, "width": 1024, "diffusion_steps": 30, "cfg_scale": 3})
    config.update({"sample_after": 2, "sample_after_unit": "EPOCH", "backup_after": 4, "backup_after_unit": "EPOCH", "save_every": 2, "save_every_unit": "EPOCH", "save_filename_prefix": run_name})
    config["scientific_protocol"] = {
        "base_model": "circlestone-labs/Anima Base v1.0",
        "official_starting_point": {"rank": 32, "alpha": 32, "learning_rate": 0.00002, "train_llm_adapter": False},
        "dataset_manifest": str(dataset / "experiment-manifest.json"),
        "trainer": "OneTrainer Anima LoRA; Qwen text encoder and Anima conditioner frozen; transformer LoRA only",
        "selection": "Select E06/E08/E10/E12 and adjacent saved points around the validation low; stop early after two rising validations with fixed-sample regression; never select final by default.",
        "production_guard": "Do not overwrite shiki_natsume_v18_wd14 or promote before all gates pass.",
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return config


def check(dataset: Path, config_path: Path) -> dict[str, Any]:
    manifest_path = dataset / "experiment-manifest.json"
    manifest = load_manifest(manifest_path)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    errors: list[str] = []
    partitions: dict[str, set[str]] = defaultdict(set)
    for entry in manifest["entries"]:
        image = dataset / entry["file"]
        caption = image.with_suffix(".txt")
        if not image.is_file() or sha256(image) != entry["sha256"]:
            errors.append(f"invalid image: {image}")
        if not caption.is_file() or caption.read_text(encoding="utf-8").strip() != entry["caption"]:
            errors.append(f"invalid caption: {caption}")
        partitions[entry["dedupe_group"]].add(entry["partition"].split("_", 1)[0])
    errors.extend(f"group leakage: {group} -> {sorted(values)}" for group, values in partitions.items() if len(values) != 1)
    if config.get("learning_rate") != 0.00002 or config.get("lora_rank") != 32 or config.get("lora_alpha") != 32:
        errors.append("config is not rank32/alpha32/constant 2e-5")
    if config.get("text_encoder", {}).get("train") is not False:
        errors.append("text encoder must remain frozen")
    if config.get("output_model_destination", "").endswith("shiki_natsume_v18_wd14.safetensors"):
        errors.append("config would overwrite production v18")
    return {"ok": not errors, "dataset_manifest": str(manifest_path), "dataset_manifest_sha256": sha256(manifest_path), "config": str(config_path), "config_sha256": sha256(config_path), "summary": manifest["summary"], "holdout_groups": manifest["split_policy"]["holdout_groups"], "errors": errors}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-manifest", required=True, type=Path)
    parser.add_argument("--output-dataset", required=True, type=Path)
    parser.add_argument("--base-config", required=True, type=Path)
    parser.add_argument("--output-config", required=True, type=Path)
    parser.add_argument("--evidence-root", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    source_manifest = args.source_manifest.resolve()
    output_dataset = args.output_dataset.resolve()
    base_config = args.base_config.resolve()
    output_config = args.output_config.resolve()
    if not args.check:
        manifest = build_dataset(source_manifest, output_dataset, args.evidence_root.resolve(), set(DEFAULT_HOLDOUT_GROUPS))
        build_config(base_config, output_dataset, output_config)
        print(json.dumps({"built": True, "entries": manifest["summary"]}, ensure_ascii=False, indent=2))
    report = check(output_dataset, output_config)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
