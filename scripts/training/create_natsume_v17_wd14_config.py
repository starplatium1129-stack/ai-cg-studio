#!/usr/bin/env python3
"""Emit the historical-baseline OneTrainer config for Natsume v17 WD14."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path


BASE_PATH = Path(__file__).with_name("create_nene_v17_configs.py")
SPEC = importlib.util.spec_from_file_location("natsume_v17_ot_base", BASE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {BASE_PATH}")
BASE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BASE
SPEC.loader.exec_module(BASE)

TRIGGER = "shiki_natsume"
R18_TRIGGER = "natsume_r18"
POLICY = {
    "identity_safe": (1, True),
    "identity_r18": (2, True),
    "qipao_safe": (1, True),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate(dataset: Path) -> dict:
    manifest_path = dataset / "dataset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("entries", [])
    if len(entries) < 40:
        raise RuntimeError("Natsume curated dataset unexpectedly small")
    hashes: set[str] = set()
    safe = adult = qipao_full = 0
    for entry in entries:
        category = str(entry["category"])
        if category not in POLICY:
            raise RuntimeError(f"unsupported category: {category}")
        image = dataset / str(entry["file"])
        caption_path = image.with_suffix(".txt")
        digest = sha256(image)
        if digest != entry["export_sha256"] or digest in hashes:
            raise RuntimeError(f"hash gate failed: {image}")
        hashes.add(digest)
        caption = caption_path.read_text(encoding="utf-8").strip()
        tags = [tag.strip() for tag in caption.split(",") if tag.strip()]
        if not tags or tags[0] != TRIGGER:
            raise RuntimeError(f"identity prefix gate failed: {caption_path}")
        if entry["r18"]:
            adult += 1
            if tags[:2] != [TRIGGER, R18_TRIGGER]:
                raise RuntimeError(f"R18 prefix gate failed: {caption_path}")
        else:
            safe += 1
            if R18_TRIGGER in tags:
                raise RuntimeError(f"R18 leakage in safe caption: {caption_path}")
        if "natsume_official_qipao" in tags and "full_body" in tags:
            qipao_full += 1
    if not safe or not adult or not qipao_full:
        raise RuntimeError("safe/R18/qipao evidence gate failed")
    return manifest


def configure_parts(config, modules) -> None:
    data_type = modules["DataType"]
    time_unit = modules["TimeUnit"]
    config.unet.train = True
    config.unet.learning_rate = 1e-4
    config.unet.weight_dtype = data_type.BFLOAT_16
    config.unet.gradient_checkpointing = True
    for name, rate in (("text_encoder", 3e-5), ("text_encoder_2", None)):
        encoder = getattr(config, name)
        encoder.train = True
        encoder.learning_rate = rate
        encoder.weight_dtype = data_type.BFLOAT_16
        encoder.gradient_checkpointing = True
        encoder.stop_training_after = 30
        encoder.stop_training_after_unit = time_unit.EPOCH
        if hasattr(encoder, "train_embedding"):
            encoder.train_embedding = True
    for name in ("text_encoder_3", "text_encoder_4", "decoder_text_encoder"):
        encoder = getattr(config, name, None)
        if encoder is not None:
            encoder.train = False
    config.vae.train = False
    config.vae.weight_dtype = data_type.FLOAT_32


def make_concepts(dataset: Path, manifest: dict, modules) -> list:
    concepts = []
    for category in sorted({str(entry["category"]) for entry in manifest["entries"]}):
        keep, shuffle = POLICY[category]
        concept = modules["ConceptConfig"].default_values()
        concept.name = f"natsume_v17_wd14_{category}"
        concept.path = str(dataset / category)
        concept.seed = 42
        concept.enabled = True
        concept.type = modules["ConceptType"].STANDARD
        concept.include_subdirectories = False
        concept.balancing = 1.0
        concept.loss_weight = 1.0
        concept.image.enable_crop_jitter = False
        concept.image.enable_random_flip = False
        concept.image.enable_fixed_flip = False
        concept.image.enable_random_rotate = False
        concept.image.enable_fixed_rotate = False
        concept.text.enable_tag_shuffling = shuffle
        concept.text.keep_tags_count = keep
        concept.text.tag_delimiter = ","
        concept.text.tag_dropout_enable = False
        concepts.append(concept)
    return concepts


def make_samples(config, modules) -> list:
    common_negative = "low quality, worst quality, blurry, bad anatomy, extra fingers, wrong hair color, wrong eye color, watermark"
    safe_negative = common_negative + ", nsfw, nude, topless, nipples, explicit, sexual"
    prompts = [
        ("shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, 1girl, solo, portrait, looking_at_viewer, simple_background", safe_negative),
        ("shiki_natsume, black_hair, very_long_hair, yellow_eyes, mole_under_eye, hairclip, 1girl, solo, full_body, casual_dress, standing, simple_background", safe_negative),
        ("shiki_natsume, natsume_official_qipao, black_hair, yellow_eyes, mole_under_eye, 1girl, solo, full_body, china_dress, red_dress, floral_print, double_bun, red_flower, side_slit, black_pantyhose, black_footwear, standing, simple_background", safe_negative),
        ("shiki_natsume, natsume_r18, black_hair, very_long_hair, yellow_eyes, mole_under_eye, 1girl, solo, nude, full_body, standing, looking_at_viewer, simple_background", common_negative),
    ]
    samples = []
    for index, (prompt, negative) in enumerate(prompts):
        sample = modules["SampleConfig"].default_values(config.model_type)
        sample.enabled = True
        sample.prompt = prompt
        sample.negative_prompt = negative
        sample.width = sample.height = 1024
        sample.diffusion_steps = 30
        sample.cfg_scale = 6.0
        sample.noise_scheduler = modules["NoiseScheduler"].EULER_A
        sample.seed = 1900 + index
        sample.random_seed = False
        samples.append(sample)
    return samples


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ai-root", type=Path, default=Path(r"E:\code\2\lora\AI"))
    parser.add_argument("--dataset", type=Path, default=Path(r"E:\code\2\lora\AI\Datasets\Characters\Shiki_Natsume\V17_WD14_Curated"))
    args = parser.parse_args()
    ai_root = args.ai_root.resolve()
    dataset = args.dataset.resolve()
    manifest = validate(dataset)
    modules = BASE.imports(ai_root / "OneTrainer")
    config = modules["TrainConfig"].default_values()
    config.training_method = modules["TrainingMethod"].LORA
    config.model_type = modules["ModelType"].STABLE_DIFFUSION_XL_10_BASE
    config.base_model_name = str(BASE.resolve_base_model(ai_root))
    config.lora_model_name = ""
    config.output_model_format = modules["ModelFormat"].KOHYA_LORA
    config.output_model_destination = str(ai_root / "OneTrainer" / "output" / "shiki_natsume_v17_wd14_curated.safetensors")
    config.output_dtype = modules["DataType"].FLOAT_32
    config.train_dtype = modules["DataType"].FLOAT_16
    config.fallback_train_dtype = modules["DataType"].BFLOAT_16
    config.lora_weight_dtype = modules["DataType"].FLOAT_32
    config.workspace_dir = str(ai_root / "OneTrainer" / "workspace" / "shiki_natsume_v17_wd14_curated")
    config.cache_dir = str(ai_root / "OneTrainer" / "workspace-cache" / "shiki_natsume_v17_wd14_curated")
    config.resolution = "1024"
    config.aspect_ratio_bucketing = True
    config.latent_caching = True
    config.clear_cache_before_training = True
    config.layer_filter_preset = "full"
    config.layer_filter = ""
    config.layer_filter_regex = False
    config.learning_rate = 3e-6
    config.learning_rate_scheduler = modules["LearningRateScheduler"].CONSTANT
    config.learning_rate_min_factor = 1.0
    config.learning_rate_warmup_steps = 0.0
    # OneTrainer's validation split leaves about 80% for optimizer steps.
    # 45 sources -> 36 train samples -> 9 updates/epoch at batch 4.
    updates_per_epoch = max(1, math.floor(len(manifest["entries"]) * 0.8 / 4))
    config.epochs = math.ceil(2000 / updates_per_epoch)
    config.batch_size = 4
    config.gradient_accumulation_steps = 1
    config.dataloader_threads = 2
    config.train_device = "cuda"
    config.temp_device = "cpu"
    config.tensorboard = True
    config.validation = True
    config.validate_after = 2
    config.validate_after_unit = modules["TimeUnit"].EPOCH
    config.prevent_overwrites = True
    config.loss_weight_fn = modules["LossWeight"].MIN_SNR_GAMMA
    config.loss_weight_strength = 5.0
    config.dropout_probability = 0.0
    config.clip_grad_norm = 1.0
    config.lora_rank = config.lora_alpha = 32
    config.optimizer.optimizer = modules["Optimizer"].ADAMW_8BIT
    config.optimizer.weight_decay = None
    config.optimizer.beta1 = None
    config.optimizer.beta2 = None
    config.optimizer.eps = None
    config.optimizer.block_wise = False
    config.optimizer.is_paged = False
    configure_parts(config, modules)
    config.concepts = make_concepts(dataset, manifest, modules)
    config.samples = make_samples(config, modules)
    # The final fixed-seed WebUI gate is the promotion evidence.  Four 1024px
    # previews every four epochs add close to an hour on this GPU without
    # improving that decision, so keep only sparse convergence snapshots.
    config.sample_after = 20
    config.sample_after_unit = modules["TimeUnit"].EPOCH
    config.save_every = 10
    config.save_every_unit = modules["TimeUnit"].EPOCH
    config.save_filename_prefix = "shiki_natsume_v17_wd14_curated"
    config.backup_after = 10
    config.backup_after_unit = modules["TimeUnit"].EPOCH

    target = ai_root / "OneTrainer" / "training_configs" / "shiki_natsume_v17_wd14_curated.json"
    target.write_text(json.dumps(config.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    provenance = {
        "schema": "ai-cg-studio.natsume-v17-wd14-config/v1",
        "dataset_manifest": str(dataset / "dataset-manifest.json"),
        "dataset_manifest_sha256": sha256(dataset / "dataset-manifest.json"),
        "base_model": {"path": config.base_model_name, "sha256": sha256(Path(config.base_model_name))},
        "profile": "historical_baseline_r32_full_constant",
        "target_optimizer_steps": 2000,
        "estimated_updates_per_epoch_after_validation_split": updates_per_epoch,
        "epochs": config.epochs,
        "single_lora": True,
        "r18_addon": False,
    }
    provenance_path = target.with_suffix(".provenance.json")
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"config": str(target), "provenance": str(provenance_path), "epochs": config.epochs}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
