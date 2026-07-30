#!/usr/bin/env python3
"""Emit one non-add-on OneTrainer config for the audited unified Nene data.

This is the only v18 config path.  It loads
``validate_nene_unified_dataset.py`` first and refuses to emit a config unless
the manifest passes its source, caption, identity, R18 and (when applicable)
canonical-witch gates.  There is no R18 add-on mode and no second LoRA output.

The default profile is the user's historically validated v11-style baseline:
Rank 32, the legacy config's effective full layer coverage, a constant
learning rate, the original text-encoder schedule, no dropout and a roughly
2,000-update budget derived from the *actual approved* dataset size.  It is
intentionally the first comparison point instead of a new unproven
optimisation recipe.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


BASE_CONFIG_PATH = Path(__file__).with_name("create_nene_v17_configs.py")
VALIDATOR_PATH = Path(__file__).with_name("validate_nene_unified_dataset.py")


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


BASE = load_module(BASE_CONFIG_PATH, "nene_v18_one_trainer_base")
VALIDATOR = load_module(VALIDATOR_PATH, "nene_v18_dataset_validator")


@dataclass(frozen=True)
class Profile:
    name: str
    rank: int
    unet_learning_rate: float
    global_learning_rate: float
    text_encoder_learning_rate: float | None
    text_encoder_2_learning_rate: float | None
    text_encoder_stop_epochs: int
    target_optimizer_steps: int
    batch_size: int
    gradient_accumulation_steps: int
    scheduler_name: str
    warmup: float
    dropout: float
    layer_filter: str
    layer_filter_preset: str
    output_dtype_name: str
    train_dtype_name: str
    fallback_train_dtype_name: str
    lora_weight_dtype_name: str
    concept_seed: int


PROFILES = {
    # This matches the user-validated v11 recipe as closely as the current
    # OneTrainer schema allows.  The current dataset is still subject to the
    # new R18/identity/witch audit gate; that is the only deliberate data
    # contract extension.
    "historical_baseline_r32_full_constant": Profile(
        name="historical_baseline_r32_full_constant",
        rank=32,
        unet_learning_rate=1e-4,
        # The old v11 config serializes TE1 at 3e-5 and leaves TE2 on the
        # legacy global 3e-6; both stop after epoch 30.  Preserve that actual
        # migrated contract instead of assuming two identical full-run TEs.
        global_learning_rate=3e-6,
        text_encoder_learning_rate=3e-5,
        text_encoder_2_learning_rate=None,
        text_encoder_stop_epochs=30,
        target_optimizer_steps=2000,
        batch_size=4,
        gradient_accumulation_steps=1,
        scheduler_name="CONSTANT",
        warmup=0.0,
        dropout=0.0,
        # Empty is full coverage in the installed OneTrainer runtime.  The
        # old UI-only preset said attn-mlp, but the serialised empty filter is
        # the field consumed by the training setup.
        layer_filter="",
        layer_filter_preset="full",
        output_dtype_name="FLOAT_32",
        train_dtype_name="FLOAT_16",
        fallback_train_dtype_name="BFLOAT_16",
        lora_weight_dtype_name="FLOAT_32",
        concept_seed=42,
    ),
}

CONCEPT_POLICY = {
    # category: (balancing, loss_weight, keep_tags_count, tag_shuffling)
    # Do not bias one small subgroup before the full 55+ source set has been
    # evaluated.  v11 used one unified, equal-weight character collection.
    # v11 shuffled facts but always held ayachi_nene in position one.  The
    # only required extension is keep=2 for R18, which protects the new
    # ayachi_nene, nene_r18 gate while allowing factual tags to vary.
    "identity_safe": (1.0, 1.0, 1, True),
    "identity_r18": (1.0, 1.0, 2, True),
    "witch_full_body": (1.0, 1.0, 1, True),
    "witch_cg": (1.0, 1.0, 1, True),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_validated_manifest(manifest_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    result = VALIDATOR.validate(manifest_path)
    if not result.ok:
        rendered = "\n".join(f"- {error}" for error in result.errors)
        raise RuntimeError(f"Unified Nene dataset gate failed; no config emitted:\n{rendered}")
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError("validated manifest root is not an object")
    return payload, result.summary


def require_profile_matches_purpose(profile: Profile, contract: dict[str, Any]) -> None:
    purpose = contract.get("purpose")
    if purpose == "identity_probe":
        if contract.get("allow_promotion") is not False:
            raise RuntimeError("identity_probe manifest must be explicitly non-promotable")
    elif purpose == "production_candidate":
        if contract.get("allow_promotion") is not True:
            raise RuntimeError("production_candidate manifest must allow promotion before config emission")
    else:
        raise RuntimeError(f"unsupported validated manifest purpose: {purpose!r}")


def build_concepts(dataset: Path, manifest: dict[str, Any], modules: dict, run_id: str, profile: Profile):
    concept_config = modules["ConceptConfig"]
    concept_type = modules["ConceptType"]
    categories = {str(entry.get("category", "")) for entry in manifest["entries"]}
    unknown = categories - set(CONCEPT_POLICY)
    if unknown:
        raise RuntimeError(f"No unified training policy for categories: {sorted(unknown)}")

    concepts = []
    for category in sorted(categories):
        path = dataset / category
        images = {
            item.resolve()
            for suffix in ("*.png", "*.jpg", "*.jpeg", "*.webp")
            for item in path.glob(suffix)
        }
        if not images:
            raise RuntimeError(f"manifest category has no images: {path}")
        manifest_images = {
            (dataset / str(entry["file"])).resolve()
            for entry in manifest["entries"]
            if entry.get("category") == category
        }
        if images != manifest_images:
            unexpected = sorted(str(item) for item in images - manifest_images)
            missing = sorted(str(item) for item in manifest_images - images)
            raise RuntimeError(
                f"manifest/category image mismatch for {category}: "
                f"unexpected={unexpected}; missing={missing}"
            )
        balancing, loss_weight, keep_tags, tag_shuffling = CONCEPT_POLICY[category]
        concept = concept_config.default_values()
        concept.name = f"nene_{run_id}_{category}"
        concept.path = str(path)
        concept.seed = profile.concept_seed
        concept.enabled = True
        concept.type = concept_type.STANDARD
        concept.include_subdirectories = False
        concept.balancing = balancing
        concept.loss_weight = loss_weight
        concept.image.enable_crop_jitter = False
        concept.image.enable_random_flip = False
        concept.image.enable_fixed_flip = False
        concept.image.enable_random_rotate = False
        concept.image.enable_fixed_rotate = False
        concept.image.enable_resolution_override = False
        # Match the proven v11 prompt order: preserve its trigger (and, only
        # for R18 sources, the R18 gate) while still shuffling factual tags.
        concept.text.enable_tag_shuffling = tag_shuffling
        concept.text.keep_tags_count = keep_tags
        concept.text.tag_delimiter = ","
        concept.text.tag_dropout_enable = False
        concepts.append(concept)
    return concepts


def configure_model_parts(config: Any, modules: dict[str, Any], profile: Profile) -> None:
    data_type = modules["DataType"]
    time_unit = modules["TimeUnit"]
    config.unet.train = True
    config.unet.learning_rate = profile.unet_learning_rate
    config.unet.weight_dtype = data_type.BFLOAT_16
    config.unet.gradient_checkpointing = True
    text_encoder_rates = {
        "text_encoder": profile.text_encoder_learning_rate,
        "text_encoder_2": profile.text_encoder_2_learning_rate,
    }
    for name in ("text_encoder", "text_encoder_2", "text_encoder_3", "text_encoder_4", "decoder_text_encoder"):
        encoder = getattr(config, name, None)
        if encoder is None:
            continue
        is_primary_text_encoder = name in text_encoder_rates
        encoder.train = is_primary_text_encoder
        encoder.learning_rate = text_encoder_rates.get(name, 0.0)
        encoder.weight_dtype = data_type.BFLOAT_16
        encoder.gradient_checkpointing = True
        encoder.stop_training_after = profile.text_encoder_stop_epochs if is_primary_text_encoder else 0
        encoder.stop_training_after_unit = time_unit.EPOCH if is_primary_text_encoder else time_unit.NEVER
        if hasattr(encoder, "train_embedding"):
            encoder.train_embedding = is_primary_text_encoder
    for name in ("vae", "decoder", "decoder_vqgan"):
        component = getattr(config, name, None)
        if component is None:
            continue
        component.train = False
        component.learning_rate = 0.0
    config.vae.weight_dtype = data_type.FLOAT_32


def calculate_epochs(manifest: dict[str, Any], profile: Profile) -> tuple[int, float, int]:
    """Derive epoch count from the validated source set and selected batch.

    OneTrainer applies concept balancing at epoch construction time.  The
    policy is deliberately one-to-one for the historical baseline, but this
    calculation stays explicit so an accidental future weighting change also
    changes the provenance rather than silently changing the update budget.
    """

    categories = {str(entry.get("category", "")) for entry in manifest["entries"]}
    effective_examples = 0.0
    for category in categories:
        count = sum(1 for entry in manifest["entries"] if entry.get("category") == category)
        balancing, _loss_weight, _keep_tags, _tag_shuffling = CONCEPT_POLICY[category]
        effective_examples += count * balancing
    updates_per_epoch = max(
        1,
        math.ceil(effective_examples / (profile.batch_size * profile.gradient_accumulation_steps)),
    )
    epochs = math.ceil(profile.target_optimizer_steps / updates_per_epoch)
    return epochs, effective_examples, updates_per_epoch


def make_samples(config: Any, modules: dict[str, Any]) -> list[Any]:
    sample_config = modules["SampleConfig"]
    noise_scheduler = modules["NoiseScheduler"]
    common_negative = (
        "low quality, worst quality, blurry, bad anatomy, extra fingers, duplicate character, "
        "wrong hair color, wrong eye color, watermark"
    )
    safe_negative = f"{common_negative}, nsfw, nude, topless, nipples, explicit, sexual"
    prompts = [
        (
            "ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, "
            "hair_ribbon, 1girl, solo, portrait, upper_body, looking_at_viewer, "
            "simple_background",
            safe_negative,
        ),
        (
            "ayachi_nene, nene_school_uniform, white_hair, very_long_hair, low_twintails, "
            "purple_eyes, ahoge, hair_ribbon, 1girl, solo, full_body, standing, "
            "blue_jacket, gold_trim, double-breasted, yellow_bowtie, grey_skirt, "
            "plaid_skirt, pleated_skirt, black_thighhighs, mary_janes, simple_background",
            safe_negative,
        ),
        (
            "ayachi_nene, nene_witch_canonical, white_hair, very_long_hair, low_twintails, "
            "purple_eyes, 1girl, solo, full_body, standing, witch_hat, black_cape, "
            "pink_bow, criss-cross_halter, black_skirt, asymmetrical_legwear, "
            "striped_thighhighs, single_sock, frilled_socks, boots, simple_background",
            safe_negative,
        ),
        (
            "ayachi_nene, nene_r18, white_hair, very_long_hair, low_twintails, purple_eyes, "
            "ahoge, hair_ribbon, 1girl, solo, nude, full_body, standing, looking_at_viewer, "
            "simple_background",
            common_negative,
        ),
    ]
    samples = []
    for index, (prompt, negative) in enumerate(prompts):
        sample = sample_config.default_values(config.model_type)
        sample.enabled = True
        sample.prompt = prompt
        sample.negative_prompt = negative
        sample.width = 1024
        sample.height = 1024
        sample.diffusion_steps = 30
        sample.cfg_scale = 6.0
        sample.noise_scheduler = noise_scheduler.EULER_A
        sample.seed = 1800 + index
        sample.random_seed = False
        samples.append(sample)
    return samples


def ensure_serialized_contract(config: Any, profile: Profile, contract: dict[str, Any]) -> None:
    if config.lora_model_name:
        raise RuntimeError("unified config may not load or continue another LoRA")
    if "addon" in str(config.output_model_destination).lower():
        raise RuntimeError("unified config output must not be an addon")
    if contract.get("purpose") == "identity_probe" and contract.get("allow_promotion"):
        raise RuntimeError("a probe must never be serialized as promotable")
    for concept in config.concepts or []:
        # The run id itself may contain underscores, so infer the policy by
        # suffix rather than trusting a manifest declaration.
        matching = next((key for key in CONCEPT_POLICY if concept.name.endswith(f"_{key}")), None)
        if matching is None:
            raise RuntimeError(f"unified config has no recognised category suffix: {concept.name}")
        _balancing, _loss_weight, keep_tags, tag_shuffling = CONCEPT_POLICY[matching]
        if concept.text.enable_tag_shuffling is not tag_shuffling:
            raise RuntimeError(f"unified config tag-shuffle policy drifted for {concept.name}")
        if concept.text.keep_tags_count != keep_tags:
            raise RuntimeError(f"unified config keep-tags policy drifted for {concept.name}")


def emit(ai_root: Path, manifest_path: Path, profile: Profile, run_id: str) -> tuple[Path, Path]:
    manifest, gate_summary = load_validated_manifest(manifest_path)
    contract = manifest["unified_training_contract"]
    require_profile_matches_purpose(profile, contract)
    dataset = manifest_path.parent
    epochs, effective_examples, updates_per_epoch = calculate_epochs(manifest, profile)
    one_trainer = ai_root / "OneTrainer"
    modules = BASE.imports(one_trainer)
    base_model = BASE.resolve_base_model(ai_root)

    train_config = modules["TrainConfig"]
    training_method = modules["TrainingMethod"]
    model_type = modules["ModelType"]
    model_format = modules["ModelFormat"]
    data_type = modules["DataType"]
    scheduler = modules["LearningRateScheduler"]
    loss_weight = modules["LossWeight"]
    optimizer = modules["Optimizer"]
    time_unit = modules["TimeUnit"]

    config = train_config.default_values()
    config.training_method = training_method.LORA
    config.model_type = model_type.STABLE_DIFFUSION_XL_10_BASE
    config.base_model_name = str(base_model)
    config.lora_model_name = ""
    config.output_model_format = model_format.KOHYA_LORA
    config.output_model_destination = str(one_trainer / "output" / f"ayachi_nene_{run_id}.safetensors")
    config.output_dtype = getattr(data_type, profile.output_dtype_name)
    config.train_dtype = getattr(data_type, profile.train_dtype_name)
    config.fallback_train_dtype = getattr(data_type, profile.fallback_train_dtype_name)
    config.lora_weight_dtype = getattr(data_type, profile.lora_weight_dtype_name)
    config.workspace_dir = str(one_trainer / "workspace" / f"ayachi_nene_{run_id}")
    config.cache_dir = str(one_trainer / "workspace-cache" / f"ayachi_nene_{run_id}")
    config.continue_last_backup = False
    config.resolution = "1024"
    config.aspect_ratio_bucketing = True
    config.latent_caching = True
    config.clear_cache_before_training = True
    config.layer_filter_preset = profile.layer_filter_preset
    config.layer_filter = profile.layer_filter
    config.layer_filter_regex = False
    config.learning_rate = profile.global_learning_rate
    config.learning_rate_scheduler = getattr(scheduler, profile.scheduler_name)
    config.learning_rate_cycles = 1.0
    config.learning_rate_min_factor = 1.0
    config.learning_rate_warmup_steps = profile.warmup
    config.epochs = epochs
    config.batch_size = profile.batch_size
    config.gradient_accumulation_steps = profile.gradient_accumulation_steps
    config.dataloader_threads = 2
    config.train_device = "cuda"
    config.temp_device = "cpu"
    config.tensorboard = True
    config.validation = True
    config.validate_after = 2
    config.validate_after_unit = time_unit.EPOCH
    config.prevent_overwrites = True
    config.loss_weight_fn = loss_weight.MIN_SNR_GAMMA
    config.loss_weight_strength = 5.0
    config.dropout_probability = profile.dropout
    config.clip_grad_norm = 1.0
    config.lora_rank = profile.rank
    config.lora_alpha = profile.rank
    config.optimizer.optimizer = optimizer.ADAMW_8BIT
    # v11 did not override the advanced AdamW8bit defaults.  Preserve the
    # runtime defaults rather than importing v16/v17's beta2=.99/block-wise
    # experiment into this historical baseline.
    config.optimizer.weight_decay = None
    config.optimizer.beta1 = None
    config.optimizer.beta2 = None
    config.optimizer.eps = None
    config.optimizer.block_wise = False
    config.optimizer.is_paged = False
    configure_model_parts(config, modules, profile)
    config.concepts = build_concepts(dataset, manifest, modules, run_id, profile)
    config.samples = make_samples(config, modules)
    config.sample_after = 4
    config.sample_after_unit = time_unit.EPOCH
    config.save_every = 10
    config.save_every_unit = time_unit.EPOCH
    config.save_skip_first = 0
    config.save_filename_prefix = f"ayachi_nene_{run_id}"
    config.backup_after = 10
    config.backup_after_unit = time_unit.EPOCH
    ensure_serialized_contract(config, profile, contract)

    destination = one_trainer / "training_configs" / f"ayachi_nene_{run_id}.json"
    # Hash before emitting either artifact: a config without the exact base
    # checkpoint provenance must never be mistaken for a comparable baseline.
    base_model_artifact = {
        "path": str(base_model),
        "sha256": sha256(base_model),
        "bytes": base_model.stat().st_size,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(config.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    provenance = {
        "schema": "ai-cg-studio.nene-unified-config/v18",
        "run_id": run_id,
        "profile": profile.__dict__,
        "derived_training_budget": {
            "target_optimizer_steps": profile.target_optimizer_steps,
            "effective_examples_per_epoch": effective_examples,
            "estimated_optimizer_updates_per_epoch": updates_per_epoch,
            "epochs": epochs,
            "estimated_total_optimizer_updates": epochs * updates_per_epoch,
        },
        "dataset_manifest": str(manifest_path),
        "dataset_manifest_sha256": sha256(manifest_path),
        "base_model": base_model_artifact,
        "dataset_gate": gate_summary,
        "purpose": contract["purpose"],
        "allow_promotion": contract["allow_promotion"],
        "single_lora": True,
        "r18_addon": False,
        "protected_identity_prefix": list(VALIDATOR.IDENTITY_PREFIX),
        "protected_r18_identity_prefix": list(VALIDATOR.R18_IDENTITY_PREFIX),
    }
    provenance_path = destination.with_name(f"{destination.stem}.provenance.json")
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return destination, provenance_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ai-root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument(
        "--profile",
        choices=sorted(PROFILES),
        default="historical_baseline_r32_full_constant",
    )
    parser.add_argument("--run-id", default="v18_historical_baseline")
    args = parser.parse_args()
    if not re_match_run_id(args.run_id):
        raise ValueError("--run-id may only contain lowercase letters, numbers and underscores")
    ai_root = args.ai_root.resolve()
    one_trainer = ai_root / "OneTrainer"
    if not one_trainer.is_dir():
        raise FileNotFoundError(f"OneTrainer directory not found: {one_trainer}")
    destination, provenance = emit(ai_root, args.manifest.resolve(), PROFILES[args.profile], args.run_id)
    print(json.dumps({"config": str(destination), "provenance": str(provenance)}, ensure_ascii=False, indent=2))
    return 0


def re_match_run_id(value: str) -> bool:
    return bool(value) and all(character.islower() or character.isdigit() or character == "_" for character in value)


if __name__ == "__main__":
    raise SystemExit(main())
