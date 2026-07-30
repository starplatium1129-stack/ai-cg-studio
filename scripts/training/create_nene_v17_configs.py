#!/usr/bin/env python3
"""Emit historical OneTrainer configs for the retired isolated v17 datasets.

This is intentionally not a copy of the v16 configuration.  The v16 audit
found three configuration mistakes that made a small, mixed dataset too easy
to overfit:

* R18 and default clothing shared captions;
* ``COSINE_WITH_RESTARTS`` re-raised LR late in a run;
* setting only ``layer_filter_preset`` did not constrain the serialized
  ``layer_filter``, so the run trained the whole UNet.

v17 trained independent deltas from the same SDXL base:

* ``core`` is the default, contains no R18 samples, and trains only SDXL
  attention/transformer blocks.
* ``core_te1_ab`` is a controlled 8-epoch TE1 ablation, never the default.
* ``r18_addon`` is a separate rank-8 delta.  It is not continued from core;
  runtime composition uses core always and this add-on only with ``nene_r18``.

This script remains only so failed v17/v17.1 experiments can be audited.  It
is deliberately quarantined behind ``--allow-retired-v17``.  New training must
use ``create_nene_v18_unified_config.py``, which emits one unified LoRA only
after the dataset contract passes.

Run with OneTrainer's virtualenv Python only when reproducing history:

    E:\\code\\2\\lora\\AI\\OneTrainer\\venv\\Scripts\\python.exe \
      scripts\\training\\create_nene_v17_configs.py --ai-root E:\\code\\2\\lora\\AI
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RunSpec:
    name: str
    dataset_name: str
    rank: int
    unet_learning_rate: float
    epochs: int
    enable_te1: bool = False


CORE_WEIGHTS: dict[str, tuple[float, float, bool, int]] = {
    # category: (balancing, loss weight, tag shuffle, preserved prefix count)
    "identity_clean": (1.35, 1.15, False, 1),
    "school_uniform": (1.75, 1.20, True, 2),
    "witch_canonical": (1.50, 1.20, True, 2),
    "witch_leg_detail": (1.00, 1.35, False, 2),
    "clothed_variant": (0.30, 0.40, False, 1),
    "validation": (1.00, 1.00, False, 1),
}

# v17.1 fixes the observed multiple-subject collapse and makes the rare,
# exact witch-leg anchor competitive with the three upper-body witch views.
# The first four tags are retained for school and witch concepts so
# ``ayachi_nene, <outfit trigger>, 1girl, solo`` cannot be shuffled away.
CORE_WEIGHTS_V17_1: dict[str, tuple[float, float, bool, int]] = {
    "identity_clean": (1.45, 1.25, False, 3),
    "school_uniform": (1.65, 1.30, True, 4),
    "witch_canonical": (1.10, 1.20, True, 4),
    "witch_leg_detail": (1.90, 1.50, False, 4),
    "validation": (1.00, 1.00, False, 3),
}

R18_WEIGHTS: dict[str, tuple[float, float, bool, int]] = {
    # R18 captions start ``ayachi_nene, nene_r18``.  Keep both before
    # shuffling so the condition cannot be silently diluted.
    "adult_solo": (1.40, 1.10, True, 2),
    "adult_interaction": (1.00, 0.85, True, 2),
    "clean_identity_anchor": (1.00, 1.00, False, 1),
}


def imports(one_trainer: Path):
    """Load OneTrainer types only after its root is importable."""
    os.chdir(one_trainer)
    sys.path.insert(0, str(one_trainer))
    from modules.util.config.ConceptConfig import ConceptConfig
    from modules.util.config.SampleConfig import SampleConfig
    from modules.util.config.TrainConfig import TrainConfig
    from modules.util.enum.ConceptType import ConceptType
    from modules.util.enum.DataType import DataType
    from modules.util.enum.LearningRateScheduler import LearningRateScheduler
    from modules.util.enum.LossWeight import LossWeight
    from modules.util.enum.ModelFormat import ModelFormat
    from modules.util.enum.ModelType import ModelType
    from modules.util.enum.NoiseScheduler import NoiseScheduler
    from modules.util.enum.Optimizer import Optimizer
    from modules.util.enum.TimeUnit import TimeUnit
    from modules.util.enum.TrainingMethod import TrainingMethod

    return {
        "ConceptConfig": ConceptConfig,
        "SampleConfig": SampleConfig,
        "TrainConfig": TrainConfig,
        "ConceptType": ConceptType,
        "DataType": DataType,
        "LearningRateScheduler": LearningRateScheduler,
        "LossWeight": LossWeight,
        "ModelFormat": ModelFormat,
        "ModelType": ModelType,
        "NoiseScheduler": NoiseScheduler,
        "Optimizer": Optimizer,
        "TimeUnit": TimeUnit,
        "TrainingMethod": TrainingMethod,
    }


def resolve_base_model(ai_root: Path) -> Path:
    expected = (
        ai_root
        / "Data"
        / "Packages"
        / "Stable Diffusion WebUI reForge"
        / "models"
        / "Stable-diffusion"
        / "waiIllustriousSDXL_v170.safetensors"
    )
    if expected.is_file():
        return expected
    alternatives = sorted(ai_root.rglob("waiIllustriousSDXL_v170.safetensors"))
    if alternatives:
        return alternatives[0]
    raise FileNotFoundError("Could not find waiIllustriousSDXL_v170.safetensors under the AI workspace")


def ensure_dataset_contract(dataset: Path, *, r18: bool) -> dict:
    manifest_path = dataset / "dataset-manifest.json"
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Build the v17 dataset first: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("entries")
    if not isinstance(entries, list) or not entries:
        raise ValueError(f"Dataset manifest has no entries: {manifest_path}")
    r18_token = "nene_r18"
    if r18:
        adults = [entry for entry in entries if str(entry.get("category", "")).startswith("adult_")]
        clean = [entry for entry in entries if entry.get("category") == "clean_identity_anchor"]
        if not adults or not clean:
            raise ValueError("R18 add-on needs both adult samples and clean contrast anchors")
        if any(r18_token not in str(entry.get("caption", "")) for entry in adults):
            raise ValueError("Every adult add-on caption must contain nene_r18")
        if any(r18_token in str(entry.get("caption", "")) for entry in clean):
            raise ValueError("Clean add-on contrast anchors must not contain nene_r18")
    elif any(r18_token in str(entry.get("caption", "")) for entry in entries):
        raise ValueError("Core config refuses a dataset that contains nene_r18")
    return manifest


def configure_model_parts(config, modules: dict, spec: RunSpec) -> None:
    data_type = modules["DataType"]
    time_unit = modules["TimeUnit"]

    config.unet.train = True
    config.unet.learning_rate = spec.unet_learning_rate
    config.unet.weight_dtype = data_type.BFLOAT_16
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
        encoder.weight_dtype = data_type.BFLOAT_16
        encoder.gradient_checkpointing = True
        encoder.stop_training_after = 0
        encoder.stop_training_after_unit = time_unit.NEVER
        if hasattr(encoder, "train_embedding"):
            encoder.train_embedding = False

    if spec.enable_te1:
        # This is deliberately a separately named AB run.  TE1 is allowed to
        # influence the first eight epochs only; TE2 remains frozen.
        config.text_encoder.train = True
        config.text_encoder.learning_rate = 1e-6
        config.text_encoder.stop_training_after = 8
        config.text_encoder.stop_training_after_unit = time_unit.EPOCH

    for frozen_name in ("vae", "decoder", "decoder_vqgan"):
        frozen = getattr(config, frozen_name, None)
        if frozen is None:
            continue
        frozen.train = False
        frozen.learning_rate = 0.0
        if hasattr(frozen, "train_embedding"):
            frozen.train_embedding = False
    config.vae.weight_dtype = data_type.FLOAT_32


def build_concepts(
    dataset: Path,
    manifest: dict,
    modules: dict,
    *,
    r18: bool,
    run_prefix: str,
    dataset_version: str,
):
    concept_config = modules["ConceptConfig"]
    concept_type = modules["ConceptType"]
    weights = (
        R18_WEIGHTS
        if r18
        else (CORE_WEIGHTS_V17_1 if dataset_version == "v17.1" else CORE_WEIGHTS)
    )
    present_categories = {str(entry.get("category", "")) for entry in manifest["entries"]}
    unknown = present_categories - set(weights)
    if unknown:
        raise ValueError(f"No v17 config weight policy for categories: {sorted(unknown)}")

    concepts = []
    for category in sorted(present_categories):
        path = dataset / category
        image_count = sum(1 for suffix in ("*.png", "*.jpg", "*.jpeg", "*.webp") for _ in path.glob(suffix))
        if image_count == 0:
            raise ValueError(f"Manifest category has no local images: {path}")
        balancing, loss_weight, shuffle, keep_tags = weights[category]
        concept = concept_config.default_values()
        concept.name = f"nene_{run_prefix}_{'r18_' if r18 else ''}{category}"
        concept.path = str(path)
        concept.seed = 20260729
        concept.enabled = True
        concept.type = concept_type.VALIDATION if category == "validation" else concept_type.STANDARD
        concept.include_subdirectories = False
        concept.balancing = balancing
        concept.loss_weight = loss_weight
        concept.image.enable_crop_jitter = False
        concept.image.enable_random_flip = False
        concept.image.enable_fixed_flip = False
        concept.image.enable_random_rotate = False
        concept.image.enable_fixed_rotate = False
        concept.image.enable_resolution_override = False
        concept.text.enable_tag_shuffling = shuffle
        concept.text.keep_tags_count = keep_tags
        concept.text.tag_delimiter = ","
        concept.text.tag_dropout_enable = False
        concepts.append(concept)
    return concepts


def sample_prompts(*, r18: bool, dataset_version: str) -> list[tuple[str, str]]:
    common_negative = (
        "low quality, worst quality, blurry, bad anatomy, extra fingers, duplicate character, "
        "wrong hair color, wrong eye color, watermark"
    )
    safe_negative = f"{common_negative}, nsfw, nude, topless, nipples, explicit, sexual"
    if r18:
        return [
            (
                "ayachi_nene, nene_r18, mature_character, adult_context, full body, white_hair, low_twintails, purple_eyes, detailed anatomy, studio light",
                common_negative,
            ),
            (
                "ayachi_nene, nene_r18, mature_character, adult_context, official_witch_outfit, dramatic cinematic light",
                common_negative,
            ),
            (
                "ayachi_nene, nene_school_uniform, full body, navy double breasted blazer, yellow neck bow, grey plaid skirt, fully clothed",
                safe_negative,
            ),
        ]
    witch_trigger = "nene_witch_canonical, " if dataset_version == "v17.1" else ""
    return [
        (
            "ayachi_nene, 1girl, solo, portrait, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons, fully_clothed, soft window light",
            safe_negative,
        ),
        (
            "ayachi_nene, nene_school_uniform, 1girl, solo, full body, navy double breasted blazer, gold piping, yellow neck bow, grey plaid skirt, dark thighhighs, mary jane shoes, fully clothed",
            safe_negative,
        ),
        (
            f"ayachi_nene, {witch_trigger}1girl, solo, official_witch_outfit, full body, witch hat, black cape, pink lining, pink crossover top, black skirt, asymmetric_legwear, black_white_striped_thighhigh, bare other leg, white frilled anklet, black strappy boots",
            safe_negative,
        ),
        (
            "ayachi_nene, 1girl, solo, green dress, fully clothed, gentle smile, outdoor portrait",
            safe_negative,
        ),
    ]


def emit_config(
    ai_root: Path,
    spec: RunSpec,
    modules: dict,
    *,
    dataset_version: str,
    run_prefix: str,
) -> tuple[Path, object, dict]:
    one_trainer = ai_root / "OneTrainer"
    r18 = spec.dataset_name == "nene-r18-addon"
    dataset = ai_root / "Datasets" / dataset_version / spec.dataset_name
    manifest = ensure_dataset_contract(dataset, r18=r18)
    train_config = modules["TrainConfig"]
    training_method = modules["TrainingMethod"]
    model_type = modules["ModelType"]
    model_format = modules["ModelFormat"]
    data_type = modules["DataType"]
    scheduler = modules["LearningRateScheduler"]
    loss_weight = modules["LossWeight"]
    optimizer = modules["Optimizer"]
    time_unit = modules["TimeUnit"]
    sample_config = modules["SampleConfig"]
    noise_scheduler = modules["NoiseScheduler"]

    config = train_config.default_values()
    config.training_method = training_method.LORA
    config.model_type = model_type.STABLE_DIFFUSION_XL_10_BASE
    config.base_model_name = str(resolve_base_model(ai_root))
    # An empty lora_model_name is deliberate: setting core here would produce
    # a continued/combined LoRA, not an independently composable add-on.
    config.lora_model_name = ""
    config.output_model_format = model_format.KOHYA_LORA
    config.output_model_destination = str(
        one_trainer / "output" / f"ayachi_nene_{run_prefix}_{spec.name}.safetensors"
    )
    config.output_dtype = data_type.FLOAT_16
    config.train_dtype = data_type.BFLOAT_16
    config.fallback_train_dtype = data_type.FLOAT_16
    config.lora_weight_dtype = data_type.FLOAT_16
    config.workspace_dir = str(one_trainer / "workspace" / f"ayachi_nene_{run_prefix}_{spec.name}")
    config.cache_dir = str(
        one_trainer / "workspace-cache" / f"ayachi_nene_{run_prefix}_{spec.name}"
    )
    config.continue_last_backup = False
    config.resolution = "1024"
    config.aspect_ratio_bucketing = True
    config.latent_caching = True
    config.clear_cache_before_training = True
    # The actual layer_filter drives CLI training.  ``attentions`` contains
    # SDXL transformer attention + feed-forward blocks, avoiding v16's
    # accidental full-UNet LoRA on a small data set.
    config.layer_filter_preset = "attn-mlp"
    config.layer_filter = "attentions"
    config.layer_filter_regex = False
    config.learning_rate = spec.unet_learning_rate
    config.learning_rate_scheduler = scheduler.COSINE
    config.learning_rate_cycles = 1.0
    config.learning_rate_min_factor = 0.1
    config.learning_rate_warmup_steps = 0.05
    config.epochs = spec.epochs
    config.batch_size = 1
    config.gradient_accumulation_steps = 4
    config.dataloader_threads = 2
    config.train_device = "cuda"
    config.temp_device = "cpu"
    config.tensorboard = True
    config.validation = not r18
    config.validate_after = 5
    config.validate_after_unit = time_unit.EPOCH
    config.prevent_overwrites = True
    config.loss_weight_fn = loss_weight.MIN_SNR_GAMMA
    config.loss_weight_strength = 5.0
    config.dropout_probability = 0.05
    config.clip_grad_norm = 1.0
    config.lora_rank = spec.rank
    config.lora_alpha = spec.rank
    config.optimizer.optimizer = optimizer.ADAMW_8BIT
    config.optimizer.weight_decay = 0.01
    config.optimizer.beta1 = 0.9
    config.optimizer.beta2 = 0.99
    config.optimizer.eps = 1e-8
    config.optimizer.block_wise = True
    config.optimizer.is_paged = False
    configure_model_parts(config, modules, spec)
    config.concepts = build_concepts(
        dataset,
        manifest,
        modules,
        r18=r18,
        run_prefix=run_prefix,
        dataset_version=dataset_version,
    )

    samples = []
    for index, (prompt, negative_prompt) in enumerate(
        sample_prompts(r18=r18, dataset_version=dataset_version)
    ):
        sample = sample_config.default_values(config.model_type)
        sample.enabled = True
        sample.prompt = prompt
        sample.negative_prompt = negative_prompt
        sample.width = 1024
        sample.height = 1024
        sample.diffusion_steps = 30
        sample.cfg_scale = 6.0
        sample.noise_scheduler = noise_scheduler.EULER_A
        sample.seed = (1700 if not r18 else 1750) + index
        sample.random_seed = False
        samples.append(sample)
    config.samples = samples
    config.sample_after = 5
    config.sample_after_unit = time_unit.EPOCH
    config.save_every = 5
    config.save_every_unit = time_unit.EPOCH
    config.save_skip_first = 0
    config.save_filename_prefix = f"ayachi_nene_{run_prefix}_{spec.name}"
    config.backup_after = 5
    config.backup_after_unit = time_unit.EPOCH

    destination = one_trainer / "training_configs" / f"ayachi_nene_{run_prefix}_{spec.name}.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(config.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination, config, manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ai-root", type=Path, required=True)
    parser.add_argument("--dataset-version", default="v17")
    parser.add_argument("--run-prefix", default="v17")
    parser.add_argument(
        "--allow-retired-v17",
        action="store_true",
        help="Required only to reproduce the failed historical v17/v17.1 configurations.",
    )
    parser.add_argument(
        "--core-only",
        action="store_true",
        help="Emit only the default core config; use for an unpassed corrective core.",
    )
    args = parser.parse_args()
    if not args.allow_retired_v17:
        raise RuntimeError(
            "v17's split core/add-on workflow is retired. Use "
            "create_nene_v18_unified_config.py for new training."
        )
    if not re.fullmatch(r"v[0-9][a-z0-9_]*", args.run_prefix):
        raise ValueError("--run-prefix must look like v17 or v17_1")
    if not re.fullmatch(r"v[0-9][a-z0-9._-]*", args.dataset_version):
        raise ValueError("--dataset-version must look like v17 or v17.1")
    ai_root = args.ai_root.resolve()
    one_trainer = ai_root / "OneTrainer"
    if not one_trainer.is_dir():
        raise FileNotFoundError(f"OneTrainer directory not found: {one_trainer}")
    modules = imports(one_trainer)
    specs = (
        (RunSpec("core", "nene-core", rank=16, unet_learning_rate=2e-5, epochs=60),)
        if args.core_only
        else (
            RunSpec("core", "nene-core", rank=16, unet_learning_rate=2e-5, epochs=60),
            RunSpec("core_te1_ab", "nene-core", rank=16, unet_learning_rate=2e-5, epochs=60, enable_te1=True),
            RunSpec("r18_addon", "nene-r18-addon", rank=8, unet_learning_rate=1e-5, epochs=40),
        )
    )
    results = []
    for spec in specs:
        destination, config, manifest = emit_config(
            ai_root,
            spec,
            modules,
            dataset_version=args.dataset_version,
            run_prefix=args.run_prefix,
        )
        results.append(
            {
                "file": str(destination),
                "run": spec.name,
                "dataset_version": args.dataset_version,
                "run_prefix": args.run_prefix,
                "dataset": spec.dataset_name,
                "rank": config.lora_rank,
                "alpha": config.lora_alpha,
                "unet_learning_rate": config.unet.learning_rate,
                "epochs": config.epochs,
                "scheduler": config.learning_rate_scheduler.value,
                "layer_filter": config.layer_filter,
                "te1": {
                    "train": config.text_encoder.train,
                    "learning_rate": config.text_encoder.learning_rate,
                    "stop_after": config.text_encoder.stop_training_after,
                    "unit": config.text_encoder.stop_training_after_unit.value,
                },
                "concepts": [concept.name for concept in config.concepts or []],
                "dataset_entries": len(manifest["entries"]),
            }
        )
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
