#!/usr/bin/env python3
"""Build a leakage-safe Natsume Anima v20 unified dataset and OneTrainer config.

Mirrors the Nene v20 unified protocol (2026-08-13 decision: train without
R18 quality-prior isolation) while keeping the Natsume source-manifest
derivation (official-event/source stems + byte/perceptual hashes) from the
v19 run.

Anima caption policy (researched against kohya-ss/sd-scripts
anima_train_network.py dataset guide, civitai.com/articles/31972 and
lilting.ch Anima LoRA experiments):

- `shiki_natsume` alone owns identity. Static identity tags (very long black
  hair, golden yellow eyes, mole under eye, red hairclips, ...) are EXCLUDED
  from captions; Anima trigger-only training keeps the face more faithful
  than tag-assisted captions.
- Lighting/style tags are spelled explicitly near the front so background
  lighting separates from identity instead of being absorbed by the trigger.
- R18 samples keep the `natsume_r18` rating token (exact-token contract) but
  are NOT partitioned into isolated quality silos: all samples share the
  unified high-quality rendering prior (2026-08-13 design decision).
- OneTrainer must run tag shuffling + per-tag dropout (keep_tags_count=4,
  RANDOM 0.1) so the trigger never locks to a fixed tag sequence.
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

# Identity belongs to the trigger word alone on Anima: static traits must NOT
# appear in captions (both spellings covered, since WD14 emits underscores).
# Only true constants live here; variant hairstyles like side_ponytail stay as
# separable variables in the caption.
IDENTITY_TAGS = {
    "black_hair", "black hair",
    "long_hair", "long hair",
    "very_long_hair", "very long hair",
    "yellow_eyes", "yellow eyes",
    "golden_yellow_eyes", "golden yellow eyes",
    "mole_under_eye", "mole under eye",
    "mole",
    "hairclip", "hairclip",
    "two_red_hairclips", "two red hairclips",
    "hair_ornament",
    "bangs",
    "straight_hair",
    "sidelocks",
    "no_hair_ribbon", "no hair ribbon",
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
    if entry.get("r18"):
        return "explicit" if EXPLICIT_TAGS.intersection(original) else "nsfw"
    return "sensitive" if SENSITIVE_TAGS.intersection(original) else "safe"


def anima_caption(entry: dict[str, Any]) -> str:
    original = tags(str(entry.get("original_caption", entry.get("caption", ""))))
    controls = [str(value).lower() for value in entry.get("controls", []) if str(value).startswith("natsume_")]
    subject = [tag for tag in original if tag in SUBJECT_TAGS]
    lighting = [tag for tag in original if tag in LIGHTING_TAGS]

    prefix = [safety_tag(entry, original)]
    # 评级词：R18 样张保留 natsume_r18（exact-token 合同），但不再按 r18
    # 分区隔离训练（2026-08-13 决策：统一训练，不隔离质量先验）。
    if entry.get("r18"):
        prefix.append("natsume_r18")
    prefix.append("shiki_natsume")
    prefix.extend(controls)
    prefix.extend(lighting)
    prefix.extend(subject)

    reserved = (
        SAFETY_TAGS
        | SUBJECT_TAGS
        | {"shiki_natsume", "natsume_r18"}
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


def load_manifest(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("entries"), list):
        raise RuntimeError(f"invalid source manifest: {path}")
    return payload


def derive_entries(source_manifest: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    source = load_manifest(source_manifest)
    source_root = source_manifest.parent
    hash_index: dict[str, Path] = {}
    for candidate in source_root.rglob("*"):
        if candidate.is_file() and candidate.suffix.lower() in IMAGE_SUFFIXES:
            hash_index.setdefault(sha256(candidate), candidate)
    entries: list[dict[str, Any]] = []
    for raw in source["entries"]:
        image = source_root / str(raw["file"])
        expected_hash = str(raw.get("export_sha256", raw.get("sha256", "")))
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
            "r18": bool(raw.get("r18", False)),
            "controls": list(raw.get("controls", [])),
            "original_caption": raw.get("original_caption", raw.get("caption", "")),
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


def output_partition(entry: dict[str, Any], holdout: set[str]) -> str:
    validation = entry["visual_group"] in holdout
    return "validation" if validation else "train"


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
    for name in ("train", "validation"):
        (output / name).mkdir(parents=True, exist_ok=True)

    emitted: list[dict[str, Any]] = []
    counts: Counter[str] = Counter()
    safety_counts: Counter[str] = Counter()
    group_partitions: dict[str, str] = {}
    for index, entry in enumerate(entries, start=1):
        target_partition = output_partition(entry, holdout)
        source_image = Path(entry["source_file"])
        target_image = output / target_partition / f"{index:03d}_{entry['id']}{source_image.suffix.lower()}"
        target_caption = target_image.with_suffix(".txt")
        shutil.copy2(source_image, target_image)
        caption = anima_caption(entry)
        target_caption.write_text(caption + "\n", encoding="utf-8", newline="\n")
        if sha256(target_image) != entry["sha256"]:
            raise RuntimeError(f"copy changed image bytes: {target_image}")
        group = entry["visual_group"]
        group_partitions[group] = target_partition
        emitted_entry = {
            **entry,
            "dedupe_group": group,
            "partition": target_partition,
            "file": str(target_image.relative_to(output)).replace("\\", "/"),
            "caption": caption,
        }
        emitted.append(emitted_entry)
        counts[target_partition] += 1
        safety_counts[caption.split(",", 1)[0]] += 1

    manifest = {
        "schema": "ai-cg-studio.natsume-anima-v20-unified-experiment/v1",
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
            "identity_ownership": (
                "shiki_natsume alone owns identity; static identity tags are "
                "excluded from captions (Anima trigger-only finding)."
            ),
            "lighting_style_tags": (
                "lighting/atmosphere tags are spelled explicitly near the "
                "front so background lighting separates from identity."
            ),
            "safety": {
                "safe": "safe",
                "non_explicit_suggestive": "sensitive",
                "adult_nudity_or_exposure": "nsfw + natsume_r18",
                "explicit_act_or_genital": "explicit + natsume_r18",
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
            "safety_labels": dict(sorted(safety_counts.items())),
            **dict(sorted(counts.items())),
        },
        "entries": emitted,
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "experiment-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    write_contact_sheets(entries, evidence_root)
    return manifest


def concept_from(template: dict[str, Any], name: str, path: Path, concept_type: str, seed: int) -> dict[str, Any]:
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
    run_name = "shiki_natsume_v20_anima_scientific_unified"
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
        concept_from(template, "natsume_v20_train", dataset / "train", "STANDARD", 2026081401),
        concept_from(
            template,
            "natsume_v20_validation",
            dataset / "validation",
            "VALIDATION",
            2026081402,
        ),
    ]

    positive_prefix = "masterpiece, best quality, score_7"
    negative = "worst quality, low quality, score_1, score_2, score_3, artist name, blurry, jpeg artifacts, chromatic aberration"
    sample_prompts = (
        f"{positive_prefix}, safe, 1girl, shiki_natsume, very_long_black_hair, golden_yellow_eyes, two_red_hairclips, mole_under_eye, no_hair_ribbon, portrait, upper body, looking at viewer, simple background",
        f"{positive_prefix}, safe, 1girl, shiki_natsume, natsume_cafe_uniform, very_long_black_hair, golden_yellow_eyes, full body, standing, cafe",
        f"{positive_prefix}, safe, 1girl, shiki_natsume, natsume_official_qipao, very_long_black_hair, golden_yellow_eyes, full body, standing, lantern light",
        f"{positive_prefix}, nsfw, natsume_r18, 1girl, shiki_natsume, very_long_black_hair, golden_yellow_eyes, solo, full body, simple background",
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
        "production_guard": "Do not overwrite L_NAT_V20_ANIMA (shiki_natsume_v20_anima_scientific_e12) before the new candidate passes all gates.",
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
        partitions[entry["dedupe_group"]].add(entry["partition"])
    for group, values in partitions.items():
        if len(values) != 1:
            errors.append(f"group leakage: {group} -> {sorted(values)}")

    if config.get("learning_rate") != 0.0001 or config.get("lora_rank") != 32 or config.get("lora_alpha") != 32:
        errors.append("config does not use the community rank32 / 1e-4 starting point")
    if config.get("text_encoder", {}).get("train") is not False:
        errors.append("text encoder must remain frozen")
    if config.get("output_model_destination", "").endswith("shiki_natsume_v20_anima_scientific_e12.safetensors"):
        errors.append("config would overwrite the production v20 LoRA")

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
