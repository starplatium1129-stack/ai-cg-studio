#!/usr/bin/env python3
"""Emit modern OneTrainer configs for the audited v16 datasets.

Run this with the OneTrainer virtualenv Python because it serializes the
current TrainConfig schema (including the optimizer object and validation
concept type) instead of relying on the legacy v15 aliases.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def configure(
    *,
    ai_root: Path,
    character: str,
    rank: int,
    learning_rate: float,
    suffix: str,
):
    one_trainer = ai_root / "OneTrainer"
    os.chdir(one_trainer)
    sys.path.insert(0, str(one_trainer))

    from modules.util.config.ConceptConfig import ConceptConfig
    from modules.util.config.SampleConfig import SampleConfig
    from modules.util.config.TrainConfig import TrainConfig
    from modules.util.enum.ConceptType import ConceptType
    from modules.util.enum.DataType import DataType
    from modules.util.enum.LossWeight import LossWeight
    from modules.util.enum.LearningRateScheduler import LearningRateScheduler
    from modules.util.enum.ModelFormat import ModelFormat
    from modules.util.enum.ModelType import ModelType
    from modules.util.enum.NoiseScheduler import NoiseScheduler
    from modules.util.enum.Optimizer import Optimizer
    from modules.util.enum.TimeUnit import TimeUnit
    from modules.util.enum.TrainingMethod import TrainingMethod

    dataset = ai_root / "Datasets" / "v16" / character
    slug = "ayachi_nene" if character == "nene" else "shiki_natsume"
    manifest_path = dataset / "dataset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    base_model = (
        ai_root
        / "Data"
        / "Packages"
        / "Stable Diffusion WebUI reForge"
        / "models"
        / "Stable-diffusion"
        / "waiIllustriousSDXL_v170.safetensors"
    )
    if not base_model.exists():
        # Older installs keep the same model under dimo; resolve the existing
        # copy rather than inventing a path.
        alternatives = list(ai_root.rglob("waiIllustriousSDXL_v170.safetensors"))
        if alternatives:
            base_model = alternatives[0]

    config = TrainConfig.default_values()
    config.training_method = TrainingMethod.LORA
    config.model_type = ModelType.STABLE_DIFFUSION_XL_10_BASE
    config.base_model_name = str(base_model)
    config.output_model_format = ModelFormat.KOHYA_LORA
    config.output_model_destination = str(
        one_trainer / "output" / f"{slug}_v16{suffix}.safetensors"
    )
    config.output_dtype = DataType.FLOAT_16
    config.train_dtype = DataType.BFLOAT_16
    config.fallback_train_dtype = DataType.FLOAT_16
    config.lora_weight_dtype = DataType.FLOAT_16
    config.resolution = "1024"
    config.aspect_ratio_bucketing = True
    config.latent_caching = True
    config.clear_cache_before_training = True
    config.layer_filter_preset = "attn-mlp"
    config.learning_rate = learning_rate
    config.learning_rate_scheduler = LearningRateScheduler.COSINE_WITH_RESTARTS
    config.learning_rate_cycles = 1.0
    config.learning_rate_min_factor = 0.1
    config.learning_rate_warmup_steps = 0.05  # five percent of total steps
    config.epochs = 80 if character == "nene" else 70
    config.batch_size = 1
    config.gradient_accumulation_steps = 4
    config.dataloader_threads = 2
    config.train_device = "cuda"
    config.temp_device = "cpu"
    config.tensorboard = True
    config.validation = True
    config.validate_after = 5
    config.validate_after_unit = TimeUnit.EPOCH
    config.prevent_overwrites = True
    config.loss_weight_fn = LossWeight.MIN_SNR_GAMMA
    config.loss_weight_strength = 5.0
    config.dropout_probability = 0.05
    config.clip_grad_norm = 1.0
    config.unet.train = True
    config.unet.learning_rate = learning_rate
    config.unet.weight_dtype = DataType.BFLOAT_16
    config.unet.gradient_checkpointing = True
    for encoder_name in (
        "text_encoder",
        "text_encoder_2",
        "text_encoder_3",
        "text_encoder_4",
        "decoder_text_encoder",
    ):
        encoder = getattr(config, encoder_name, None)
        if encoder is None:
            continue
        encoder.train = False
        encoder.learning_rate = 0.0
        encoder.weight_dtype = DataType.BFLOAT_16
        encoder.gradient_checkpointing = True
        if hasattr(encoder, "train_embedding"):
            encoder.train_embedding = False
    # StableDiffusionXLLoRASetup already forces the VAE to eval mode with
    # requires_grad=False, and SDXL does not use the generic decoder parts.
    # Freeze them explicitly as well so the serialized config is truthful and
    # remains safe if setup internals or the config consumer change later.
    for frozen_name in ("vae", "decoder", "decoder_vqgan"):
        frozen = getattr(config, frozen_name, None)
        if frozen is None:
            continue
        frozen.train = False
        frozen.learning_rate = 0.0
        if hasattr(frozen, "train_embedding"):
            frozen.train_embedding = False
    config.vae.weight_dtype = DataType.FLOAT_32
    config.lora_rank = rank
    config.lora_alpha = rank
    config.optimizer.optimizer = Optimizer.ADAMW_8BIT
    config.optimizer.weight_decay = 0.01
    config.optimizer.beta1 = 0.9
    config.optimizer.beta2 = 0.99
    config.optimizer.eps = 1e-8
    config.optimizer.block_wise = True
    config.optimizer.is_paged = False

    identity_keep = 7 if character == "nene" else 6
    weights = {
        "identity_anchors": (3.0, 1.25),
        "outfit_witch": (4.0, 1.0),
        "outfit_qipao": (2.5, 1.0),
        "outfit_school": (1.5, 1.0),
        "reference": (2.0, 1.15),
        "official_cg": (1.5, 1.0),
        "curated": (1.0, 1.0),
        "adult_solo": (0.75, 0.65),
        "adult_interaction": (0.35, 0.35),
        "interaction": (0.35, 0.45),
        "validation": (1.0, 1.0),
    }
    concepts = []
    categories = sorted(
        {
            str(entry["category"])
            for entry in manifest["entries"]
            if str(entry["category"]) != "validation"
        }
    )
    categories.append("validation")
    for category in categories:
        path = dataset / category
        if not path.exists() or not any(path.glob("*.png")) and not any(path.glob("*.jpg")):
            continue
        concept = ConceptConfig.default_values()
        concept.name = f"{character}_v16_{category}"
        concept.path = str(path)
        concept.seed = 20260728
        concept.enabled = True
        concept.type = ConceptType.VALIDATION if category == "validation" else ConceptType.STANDARD
        concept.include_subdirectories = False
        repeat, loss_weight = weights.get(category, (1.0, 1.0))
        concept.balancing = repeat
        concept.loss_weight = loss_weight
        concept.image.enable_crop_jitter = False
        concept.image.enable_random_flip = False
        concept.image.enable_fixed_flip = False
        concept.image.enable_random_rotate = False
        concept.image.enable_fixed_rotate = False
        concept.image.enable_resolution_override = False
        concept.text.enable_tag_shuffling = category not in {"validation", "identity_anchors"}
        concept.text.keep_tags_count = identity_keep
        concept.text.tag_delimiter = ","
        concept.text.tag_dropout_enable = False
        concepts.append(concept)
    config.concepts = concepts

    sample_prompts = (
        [
            "ayachi_nene, portrait, white_hair, low_twintails, purple_eyes, ahoge, school uniform, soft window light",
            "ayachi_nene, full body, official_witch_outfit, witch_hat, black_cape, pink_lining, striped_legwear",
            "ayachi_nene, upper body, white_hair, low_twintails, purple_eyes, casual clothes, gentle smile",
            "ayachi_nene, adult, mature_character, official_witch_outfit, dramatic cinematic lighting",
        ]
        if character == "nene"
        else [
            "shiki_natsume, portrait, black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip",
            "shiki_natsume, full body, natsume_official_qipao, red_china_dress, mandarin_collar, gold_trim, floral_pattern, hair_bun, hair_flower",
            "shiki_natsume, upper body, black_hair, yellow_eyes, hairclip, cafe uniform, warm light",
            "shiki_natsume, adult, mature_character, natsume_official_qipao, cinematic lighting",
        ]
    )
    samples = []
    for index, prompt in enumerate(sample_prompts):
        sample = SampleConfig.default_values(config.model_type)
        sample.enabled = True
        sample.prompt = prompt
        sample.negative_prompt = (
            "low quality, worst quality, blurry, bad anatomy, extra fingers, "
            "wrong hair color, wrong eye color, duplicate character, watermark"
        )
        sample.width = 1024
        sample.height = 1024
        sample.diffusion_steps = 30
        sample.cfg_scale = 6.0
        sample.noise_scheduler = NoiseScheduler.EULER_A
        sample.seed = 1600 + index
        sample.random_seed = False
        samples.append(sample)
    config.samples = samples
    config.sample_after = 10
    config.sample_after_unit = TimeUnit.EPOCH
    config.save_every = 10
    config.save_every_unit = TimeUnit.EPOCH
    config.save_skip_first = 0
    config.save_filename_prefix = f"{slug}_v16"
    config.backup_after = 99999
    config.backup_after_unit = TimeUnit.EPOCH

    destination = one_trainer / "training_configs" / f"{slug}_v16{suffix}.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(config.to_dict(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return destination, config


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ai-root", type=Path, required=True)
    args = parser.parse_args()
    args.ai_root = args.ai_root.resolve()
    outputs = []
    for character in ("nene", "natsume"):
        for rank, lr, suffix in (
            (32, 4e-5, ""),
            (64, 8e-5, "_ab_rank64_lr8e5"),
        ):
            path, config = configure(
                ai_root=args.ai_root,
                character=character,
                rank=rank,
                learning_rate=lr,
                suffix=suffix,
            )
            outputs.append(
                {
                    "file": str(path),
                    "character": character,
                    "rank": rank,
                    "learning_rate": lr,
                    "epochs": config.epochs,
                    "concepts": [concept.name for concept in config.concepts or []],
                }
            )
    print(json.dumps(outputs, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
