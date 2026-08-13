#!/usr/bin/env python3
"""Build a leakage-safe Anima dataset snapshot and OneTrainer config for Nene.

The source dataset remains immutable. Images are copied byte-for-byte, captions
are normalized to Anima's official tag spelling, and validation is split by
visual group so near-duplicate variants cannot cross the train/validation
boundary.

Anima caption policy (2026-08-10, researched against kohya-ss/sd-scripts
anima_train_network.py dataset guide, civitai.com/articles/31972 and
lilting.ch Anima LoRA experiments):

- `ayachi_nene` alone owns identity. Static identity tags (white hair, purple
  eyes, ...) are EXCLUDED from captions; Anima trigger-only training keeps the
  face more faithful than tag-assisted captions.
- Lighting/style tags are spelled explicitly near the front so background
  lighting separates from identity instead of being absorbed by the trigger.
- OneTrainer must run tag shuffling + per-tag dropout (keep_tags_count=4,
  RANDOM 0.1) so the trigger never locks to a fixed tag sequence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


DEFAULT_HOLDOUT_GROUPS = (
    "official_5003_night_support",
    "official_5005_clothed_lap",
    "official_5006_red_cardigan",
    "r18_ev101_library_skirt",
    "r18_ev121_bed_pov",
)

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
SAFETY_TAGS = {"safe", "sensitive", "nsfw", "explicit"}
SENSITIVE_TAGS = {
    "breast_grab",
    "breasts_out",
    "cameltoe",
    "cleavage",
    "garter_straps",
    "no_panties",
    "panties",
    "pantyshot",
    "pussy_juice_stain",
    "revealing_clothes",
    "sideboob",
    "underboob",
    "underwear",
}
EXPLICIT_TAGS = {
    "egg_vibrator",
    "female_masturbation",
    "handjob",
    "implied_sex",
    "penis",
    "pussy",
    "sex_toy",
    "vibrator",
    "vibrator_on_nipple",
}
SUBJECT_TAGS = {
    "1girl",
    "1boy",
    "1other",
    "2girls",
    "2boys",
    "multiple_girls",
    "multiple_boys",
    "solo",
    "hetero",
    "pov",
    "pov_hands",
}

# Identity belongs to the trigger word alone on Anima: static traits must NOT
# appear in captions (both spellings covered, since WD14 emits underscores).
# Only true constants live here; variant hairstyles like side_ponytail stay as
# separable variables in the caption.
IDENTITY_TAGS = {
    "white_hair", "white hair",
    "very_long_hair", "very long hair",
    "low_twintails",
    "purple_eyes", "purple eyes",
    "ahoge",
    "hair_ribbon",
}

# Lighting/style variables spelled out so they separate from identity and can
# be shuffled/dropped during training (danbooru/WD14 spelling).
LIGHTING_TAGS = {
    "soft_lighting", "warm_lighting", "cold_lighting", "dramatic_lighting",
    "dim_lighting", "natural_lighting", "moody_lighting", "candlelight",
    "lamp_light", "moonlight", "sunlight", "light_rays", "backlighting",
    "rim_light", "window_light", "neon_lighting", "streetlight",
    "morning", "noon", "evening", "night", "sunset", "dawn",
    "rain", "snow", "cloudy_sky", "starry_sky", "full_moon", "stars",
    "glowing", "firefly",
}

KEEP_TAGS_COUNT = 4
TAG_DROPOUT_PROBABILITY = 0.1


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tags(caption: str) -> list[str]:
    return [tag.strip().lower() for tag in caption.split(",") if tag.strip()]


def normalize_tag(tag: str) -> str:
    if tag == "ayachi_nene" or tag.startswith("nene_") or tag.startswith("score_"):
        return tag
    return tag.replace("_", " ")


def safety_tag(entry: dict[str, Any], original: list[str]) -> str:
    if entry.get("r18"):
        return "explicit" if EXPLICIT_TAGS.intersection(original) else "nsfw"
    return "sensitive" if SENSITIVE_TAGS.intersection(original) else "safe"


def anima_caption(entry: dict[str, Any]) -> str:
    original = tags(str(entry["caption"]))
    controls = [str(tag).lower() for tag in entry.get("tagging", {}).get("custom_control_tags", [])]
    subject = [tag for tag in original if tag in SUBJECT_TAGS]
    lighting = [tag for tag in original if tag in LIGHTING_TAGS]

    prefix = [safety_tag(entry, original)]
    # 评级词：R18 样张保留 nene_r18（exact-token 合同），但不再按 r18
    # 分区隔离训练（2026-08-13 决策：统一训练，不隔离质量先验）。
    if entry.get("r18"):
        prefix.append("nene_r18")
    prefix.append("ayachi_nene")
    prefix.extend(controls)
    prefix.extend(lighting)
    prefix.extend(subject)

    reserved = (
        SAFETY_TAGS
        | SUBJECT_TAGS
        | {"ayachi_nene", "nene_r18"}
        | set(controls)
        | set(lighting)
        | IDENTITY_TAGS
    )
    general = [tag for tag in original if tag not in reserved]

    ordered = prefix + general

    normalized: list[str] = []
    seen: set[str] = set()
    for tag in ordered:
        value = normalize_tag(tag)
        if value and value not in seen:
            normalized.append(value)
            seen.add(value)
    return ", ".join(normalized)


def output_partition(entry: dict[str, Any], holdout: set[str]) -> str:
    group = str(entry.get("dedupe_group", ""))
    if group in holdout:
        return "validation"
    return "train"


def load_manifest(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("entries"), list):
        raise RuntimeError(f"invalid source manifest: {path}")
    return payload


def validate_split(entries: list[dict[str, Any]], holdout: set[str]) -> None:
    groups: dict[str, set[str]] = defaultdict(set)
    controls_by_group: dict[str, set[str]] = defaultdict(set)
    for entry in entries:
        group = str(entry.get("dedupe_group", ""))
        groups[group].add(output_partition(entry, holdout).split("_", 1)[0])
        controls_by_group[group].update(entry.get("tagging", {}).get("custom_control_tags", []))

    leaked = sorted(group for group, splits in groups.items() if len(splits) != 1)
    if leaked:
        raise RuntimeError(f"visual groups cross train/validation: {leaked}")

    missing = sorted(holdout - set(groups))
    if missing:
        raise RuntimeError(f"unknown holdout groups: {missing}")

    train_controls: set[str] = set()
    validation_controls: set[str] = set()
    for group, controls in controls_by_group.items():
        (validation_controls if group in holdout else train_controls).update(controls)
    unsupported = sorted(validation_controls - train_controls)
    if unsupported:
        raise RuntimeError(f"validation contains controls absent from training: {unsupported}")

    train_groups = set(groups) - holdout
    if len(train_groups) < 20:
        raise RuntimeError(f"training split has only {len(train_groups)} independent visual groups")


def build_dataset(source_manifest: Path, output: Path, holdout: set[str]) -> dict[str, Any]:
    source = load_manifest(source_manifest)
    source_root = source_manifest.parent
    entries = source["entries"]
    validate_split(entries, holdout)

    if output.exists():
        shutil.rmtree(output)
    for partition in ("train", "validation"):
        (output / partition).mkdir(parents=True, exist_ok=True)

    emitted: list[dict[str, Any]] = []
    counts: Counter[str] = Counter()
    safety_counts: Counter[str] = Counter()
    group_partitions: dict[str, str] = {}
    for index, entry in enumerate(entries, start=1):
        source_image = source_root / str(entry["file"])
        if source_image.suffix.lower() not in IMAGE_SUFFIXES or not source_image.is_file():
            raise RuntimeError(f"missing source image: {source_image}")
        expected_hash = str(entry["sha256"])
        actual_hash = sha256(source_image)
        if actual_hash != expected_hash:
            raise RuntimeError(f"source hash mismatch: {source_image}")

        partition = output_partition(entry, holdout)
        filename = f"{index:03d}_{entry['id']}{source_image.suffix.lower()}"
        target_image = output / partition / filename
        target_caption = target_image.with_suffix(".txt")
        shutil.copy2(source_image, target_image)
        caption = anima_caption(entry)
        emitted_safety = caption.split(",", 1)[0]
        target_caption.write_text(caption + "\n", encoding="utf-8", newline="\n")
        if sha256(target_image) != actual_hash:
            raise RuntimeError(f"copy changed image bytes: {target_image}")

        group = str(entry.get("dedupe_group", ""))
        group_partitions[group] = partition.split("_", 1)[0]
        counts[partition] += 1
        safety_counts[emitted_safety] += 1
        emitted.append(
            {
                "id": entry["id"],
                "dedupe_group": group,
                "partition": partition,
                "full_body": bool(entry.get("full_body")),
                "source_file": str(source_image),
                "file": str(target_image.relative_to(output)).replace("\\", "/"),
                "sha256": actual_hash,
                "r18": bool(entry.get("r18", False)),
                "original_caption": entry.get("caption", ""),
                "caption": caption,
            }
        )

    manifest = {
        "schema": "ai-cg-studio.nene-anima-v20-experiment/v1",
        "base_model": "circlestone-labs/Anima Base v1.0",
        "source_manifest": str(source_manifest),
        "source_manifest_sha256": sha256(source_manifest),
        "split_policy": {
            "unit": "dedupe_group",
            "seed": 20260809,
            "holdout_groups": sorted(holdout),
            "group_partitions": dict(sorted(group_partitions.items())),
            "rule": "No visual group or near-duplicate variant may cross train and validation.",
        },
        "caption_policy": {
            "reference": "https://huggingface.co/circlestone-labs/Anima",
            "ordinary_tag_spelling": "lowercase spaces; comma followed by one space",
            "preserved_lora_tokens": ["ayachi_nene", "nene_*"],
            "identity_ownership": (
                "ayachi_nene alone owns identity; static identity tags are "
                "excluded from captions (Anima trigger-only finding)."
            ),
            "lighting_style_tags": (
                "lighting/atmosphere tags are spelled explicitly near the "
                "front so background lighting separates from identity."
            ),
            "safety": {
                "safe": "safe",
                "non_explicit_suggestive": "sensitive",
                "adult_nudity_or_exposure": "nsfw + nene_r18",
                "explicit_act_or_genital": "explicit + nene_r18",
            },
            "random_tag_shuffle": True,
            "keep_tags_count": KEEP_TAGS_COUNT,
            "tag_dropout": TAG_DROPOUT_PROBABILITY,
            "tag_dropout_mode": "RANDOM",
        },
        "summary": {
            "entries": len(emitted),
            "independent_visual_groups": len(group_partitions),
            "train_visual_groups": sum(value == "train" for value in group_partitions.values()),
            "validation_visual_groups": sum(value == "validation" for value in group_partitions.values()),
            "train_full_body_images": sum(
                bool(entry["full_body"])
                for entry in emitted
                if entry["partition"].startswith("train")
            ),
            "safety_labels": dict(sorted(safety_counts.items())),
            **dict(sorted(counts.items())),
        },
        "entries": emitted,
    }
    (output / "experiment-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return manifest


def concept_from(
    template: dict[str, Any], name: str, path: Path, concept_type: str, seed: int
) -> dict[str, Any]:
    concept = json.loads(json.dumps(template))
    concept["name"] = name
    concept["path"] = str(path)
    concept["seed"] = seed
    concept["enabled"] = True
    concept["type"] = concept_type
    concept["include_subdirectories"] = False
    concept["image_variations"] = 1
    concept["text_variations"] = 1
    concept["balancing"] = 1
    concept["loss_weight"] = 1
    image = concept["image"]
    for key in (
        "enable_crop_jitter",
        "enable_random_flip",
        "enable_fixed_flip",
        "enable_random_rotate",
        "enable_fixed_rotate",
        "enable_random_brightness",
        "enable_fixed_brightness",
        "enable_random_contrast",
        "enable_fixed_contrast",
        "enable_random_saturation",
        "enable_fixed_saturation",
        "enable_random_hue",
        "enable_fixed_hue",
    ):
        image[key] = False
    text = concept["text"]
    text["enable_tag_shuffling"] = True
    text["tag_delimiter"] = ","
    text["keep_tags_count"] = KEEP_TAGS_COUNT
    text["tag_dropout_enable"] = True
    text["tag_dropout_mode"] = "RANDOM"
    text["tag_dropout_probability"] = TAG_DROPOUT_PROBABILITY
    text["tag_dropout_special_tags_mode"] = "NONE"
    text["tag_dropout_special_tags"] = ""
    return concept


def build_config(base_config: Path, dataset: Path, destination: Path) -> dict[str, Any]:
    config = json.loads(base_config.read_text(encoding="utf-8-sig"))
    template = config["concepts"][0]
    run_name = "ayachi_nene_v20_anima_scientific_unified"
    ai_root = base_config.parents[2]
    one_trainer = base_config.parents[1]

    config["workspace_dir"] = str(one_trainer / "workspace" / run_name)
    config["cache_dir"] = str(one_trainer / "workspace-cache" / run_name)
    config["output_model_destination"] = str(one_trainer / "output" / f"{run_name}.safetensors")
    config["include_train_config"] = "ALL"
    config["validation"] = True
    config["validate_after"] = 2
    config["validate_after_unit"] = "EPOCH"
    config["base_model_name"] = str(one_trainer / "models" / "anima-base-v1.0-diffusers")
    config["output_dtype"] = "BFLOAT_16"
    config["clear_cache_before_training"] = True
    config["learning_rate_scheduler"] = "CONSTANT"
    config["learning_rate"] = 0.0001
    config["learning_rate_warmup_steps"] = 100
    config["epochs"] = 24
    config["batch_size"] = 1
    config["gradient_accumulation_steps"] = 1
    config["resolution"] = "1024"
    config["train_dtype"] = "BFLOAT_16"
    config["fallback_train_dtype"] = "BFLOAT_16"
    config["timestep_distribution"] = "LOGIT_NORMAL"
    config["loss_weight_fn"] = "CONSTANT"
    config["timestep_shift"] = 1
    config["dynamic_timestep_shifting"] = False
    config["layer_filter"] = "attn1,attn2,ff"
    config["layer_filter_preset"] = "attn-mlp"
    config["dropout_probability"] = 0
    config["lora_rank"] = 32
    config["lora_alpha"] = 32
    config["lora_weight_dtype"] = "FLOAT_32"
    config["transformer"]["train"] = True
    config["transformer"]["learning_rate"] = 0.0001
    config["text_encoder"]["train"] = False
    config["text_encoder"]["learning_rate"] = 0
    config["vae"]["train"] = False
    config["optimizer"]["optimizer"] = "ADAMW"
    config["optimizer"]["beta1"] = 0.9
    config["optimizer"]["beta2"] = 0.99
    config["optimizer"]["eps"] = 1e-8
    config["optimizer"]["weight_decay"] = 0.01
    config["optimizer"]["stochastic_rounding"] = True
    config["concepts"] = [
        concept_from(template, "nene_v20_train", dataset / "train", "STANDARD", 2026080901),
        concept_from(
            template,
            "nene_v20_validation",
            dataset / "validation",
            "VALIDATION",
            2026080902,
        ),
    ]

    positive_prefix = "masterpiece, best quality, score_7"
    negative = "worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration"
    sample_prompts = (
        f"{positive_prefix}, safe, 1girl, ayachi_nene, white hair, very long hair, low twintails, purple eyes, ahoge, hair ribbon, portrait, upper body, looking at viewer, simple background",
        f"{positive_prefix}, safe, 1girl, ayachi_nene, nene_school_uniform, white hair, very long hair, low twintails, purple eyes, full body, standing, city street",
        f"{positive_prefix}, safe, 1girl, ayachi_nene, nene_witch_canonical, white hair, purple eyes, full body, dynamic pose, moonlit forest",
        f"{positive_prefix}, safe, 1girl, ayachi_nene, nene_witch_canonical, white hair, purple eyes, full body, dynamic pose, moonlit forest",
    )
    for sample, prompt in zip(config["samples"], sample_prompts):
        sample["prompt"] = prompt
        sample["negative_prompt"] = negative
        sample["height"] = 1024
        sample["width"] = 1024
        sample["diffusion_steps"] = 30
        sample["cfg_scale"] = 3
    config["sample_after"] = 4
    config["sample_after_unit"] = "EPOCH"
    config["backup_after"] = 8
    config["backup_after_unit"] = "EPOCH"
    config["save_every"] = 4
    config["save_every_unit"] = "EPOCH"
    config["save_filename_prefix"] = run_name

    config["scientific_protocol"] = {
        "base_model": "circlestone-labs/Anima Base v1.0",
        "community_starting_point": {
            "rank": 32,
            "learning_rate": 0.0001,
            "epochs": 24,
            "train_llm_adapter": False,
            "rationale": (
                "Anima character LoRA: ~1000-1500 steps at 1e-4 (civitai "
                "31972; HF Anima #106/#119). 2e-5 was too low: only "
                "background lighting was learned, identity underfit."
            ),
        },
        "dataset_manifest": str(dataset / "experiment-manifest.json"),
        "dataset_manifest_sha256": sha256(dataset / "experiment-manifest.json"),
        "trainer": "OneTrainer Anima LoRA; text encoder and Anima text conditioner frozen by AnimaLoRASetup",
        "selection": "Choose a checkpoint from held-out validation plus the preregistered image matrix; never select final epoch by default.",
        "production_guard": "Do not overwrite L_NENE_V19_ANIMA before the new candidate passes all gates.",
        "ai_root": str(ai_root),
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
    for group, values in partitions.items():
        if len(values) != 1:
            errors.append(f"group leakage: {group} -> {sorted(values)}")

    if config.get("learning_rate") != 0.0001 or config.get("lora_rank") != 32:
        errors.append("config does not use the community rank32 / 1e-4 starting point")
    if config.get("text_encoder", {}).get("train") is not False:
        errors.append("text encoder must remain frozen")
    if config.get("output_model_destination", "").endswith("ayachi_nene_v19_anima.safetensors"):
        errors.append("config would overwrite the production v19 LoRA")

    for concept in config.get("concepts", []):
        text = concept.get("text", {})
        if text.get("enable_tag_shuffling") is not True:
            errors.append(f"concept {concept.get('name')}: tag shuffling must be enabled")
        if text.get("tag_dropout_enable") is not True:
            errors.append(f"concept {concept.get('name')}: tag dropout must be enabled")
        if text.get("keep_tags_count", 0) < KEEP_TAGS_COUNT:
            errors.append(
                f"concept {concept.get('name')}: keep_tags_count must be >= {KEEP_TAGS_COUNT}"
            )

    for entry in manifest["entries"]:
        caption_tags = {tag.strip() for tag in str(entry["caption"]).lower().split(",")}
        leaked = sorted(tag for tag in IDENTITY_TAGS if tag in caption_tags)
        if leaked:
            errors.append(f"identity tags leaked into caption of {entry['id']}: {leaked}")

    return {
        "ok": not errors,
        "dataset_manifest": str(manifest_path),
        "dataset_manifest_sha256": sha256(manifest_path),
        "config": str(config_path),
        "config_sha256": sha256(config_path),
        "summary": manifest["summary"],
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-manifest", required=True, type=Path)
    parser.add_argument("--output-dataset", required=True, type=Path)
    parser.add_argument("--base-config", required=True, type=Path)
    parser.add_argument("--output-config", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    source_manifest = args.source_manifest.resolve()
    output_dataset = args.output_dataset.resolve()
    base_config = args.base_config.resolve()
    output_config = args.output_config.resolve()

    if not args.check:
        build_dataset(source_manifest, output_dataset, set(DEFAULT_HOLDOUT_GROUPS))
        build_config(base_config, output_dataset, output_config)
    report = check(output_dataset, output_config)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
