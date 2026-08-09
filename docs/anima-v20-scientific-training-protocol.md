# Anima v20 Scientific Training Protocol

Date: 2026-08-09

## Objective

Train a new Nene character LoRA on `circlestone-labs/Anima Base v1.0` without replacing the current production v19 checkpoint until a preregistered comparison demonstrates a real improvement.

## Primary Sources

- CircleStone Labs Anima model card: LoRAs should use Base v1.0; do not train the LLM adapter; for rank 32 start at `2e-5` and adjust only after evidence.
- CircleStone Labs prompting contract: lowercase ordinary tags, spaces instead of underscores, a space after each comma, official safety tags, and the documented section order.
- `tdrussell/diffusion-pipe`: the trainer used by the model author; held-out eval, AdamW with `betas=[0.9,0.99]`, `weight_decay=0.01`, BF16, gradient clipping and checkpointed selection.
- OneTrainer Anima implementation: `AnimaLoRASetup` freezes the Qwen text encoder and Anima text conditioner and trains transformer LoRA layers only. This satisfies the model author's LLM-adapter constraint on the available native-Windows environment.

The official `diffusion-pipe` runtime is not used for this run because it requires DeepSpeed under Linux/WSL2, while this machine has no installed WSL distribution. The experiment follows its optimizer/evaluation contract using the already GPU-verified OneTrainer Anima backend instead of installing an unverified trainer during the run.

## Why v19 Is Not Reused

- v19 used rank 16, LR `1e-4`, batch 1 and 45 epochs.
- Its 55 files represented only 25 independent visual groups.
- Near-duplicate variants were not separated from a validation set.
- TensorBoard contained training loss but no validation loss.
- The final epoch overfit; production had to be rolled back to epoch 20.

## Dataset Contract

- Source images remain immutable and are copied byte-for-byte from `V18_WD14_Curated`.
- Split unit is `review.dedupe_group`, never an individual file.
- Five complete visual groups are held out. No near-duplicate member may cross the boundary.
- Validation controls must all remain represented in training.
- Non-explicit and R18 validation use distinct concept seeds because OneTrainer keys validation curves by seed; TensorBoard must expose both curves plus their total average.
- Non-explicit but sexually suggestive images use Anima's `sensitive` tag instead of being mislabeled `safe`; adult exposure uses `nsfw + nene_r18`, while explicit acts or visible genitals use `explicit + nene_r18`.
- Ordinary tags follow Anima spelling. `ayachi_nene`, `nene_r18` and `nene_*` outfit controls remain underscore tokens because they are explicit LoRA controls, not base-model tags.
- No random flip is allowed because character and outfit asymmetries are meaningful.
- The baseline uses no crop jitter, tag shuffle, tag dropout or image color augmentation, avoiding extra variables in the first controlled experiment.

Deterministic holdout groups:

- `official_5003_night_support`
- `official_5005_clothed_lap`
- `official_5006_red_cardigan`
- `r18_ev101_library_skirt`
- `r18_ev121_bed_pov`

## Baseline A

| Parameter | Value | Basis |
|---|---:|---|
| Base | Anima Base v1.0 | Official model card |
| Train target | Transformer LoRA only | Official freeze recommendation |
| Rank / alpha | 32 / 32 | Official rank starting point; unit LoRA scaling |
| LR | `2e-5` constant | Official model card |
| Optimizer | AdamW | Author trainer default |
| Betas | `0.9, 0.99` | Author trainer default |
| Weight decay | `0.01` | Author trainer default |
| Precision | BF16, FP32 LoRA weights | Anima requirement and stable adapter updates |
| Resolution | 1024 with AR buckets | Preserve official CG detail; known to fit this 16 GB GPU at batch 1 |
| Batch / accumulation | 1 / 1 | Avoid undocumented LR scaling |
| Epochs | 36 | About 1,500 optimizer steps after grouped holdout |
| Validation | Every 2 epochs | Detect memorization before final epoch |
| Save/sample | Every 4 epochs | Fixed checkpoint grid |

Baseline A is the only initially authorized training run. Follow-up runs are conditional:

The baseline output name is `ayachi_nene_v20_anima_scientific_a.safetensors`; it is an experiment candidate, not the production catalog file.

- If held-out loss is still improving at the final checkpoint and visual identity remains underfit, run the same matrix at `3e-5`.
- If held-out loss rises in two consecutive evaluations or composition/style freedom degrades, compare earlier A checkpoints first; only then consider `1e-5`.
- Do not change rank, alpha, LR, captions and augmentations simultaneously.

## Checkpoint Selection

No checkpoint wins because it is the final epoch or has the lowest training loss. A candidate must satisfy all of the following:

1. Held-out non-explicit and R18 loss do not show sustained divergence.
2. Fixed-seed production-route matrix compares base, v19 production and each shortlisted v20 checkpoint.
3. Manual image review checks identity, face/ahoge/ribbon, outfit controls, limbs, two-person feature bleeding, composition, lighting and scene narrative.
4. Safe prompts have no adult leakage; R18 activates only when requested.
5. At least three seeds per scene retain meaningful camera and pose diversity.
6. Novel backgrounds, poses and style prompts remain controllable instead of reproducing training compositions.
7. The candidate must beat v19, not merely produce acceptable images.

The current `L_NENE_V19_ANIMA` file remains untouched until promotion is explicitly approved after this matrix.

## Recorded Result

Baseline A completed on the preregistered configuration without a second hyperparameter run.

- Runtime: 36 epochs / 1,512 optimizer steps, approximately 68 minutes on an RTX 4070 Ti SUPER 16 GB.
- Dataset snapshot: 55 files / 25 visual groups; 42 train files and 13 held-out files with no `review.dedupe_group` crossing the split.
- Manifest SHA-256: `ad3f7b1c24f5d8614c1a6b7871d5f14e0d676f25227fd1ece969cd1e62fb06ef`.
- Config SHA-256: `c4fc5663d5c4cbdf77268bead68c81212f0f6d548a1810fe5ce4ad5f7b34484d`.
- Validation total average reached its minimum at epoch 10 (`0.066712625`); the non-R18 minimum was epoch 10 (`0.067172386`) and the R18 minimum was epoch 12 (`0.065580934`).
- The first saved checkpoint near the validation minimum was epoch 8 / step 336. Epoch 12 showed two production-matrix failures; later validation values mostly rose and the final checkpoint was rejected.

The production ComfyUI matrix used six scenes and three fixed seeds per scene. Epoch 8 passed all 18 rows and scored 15 wins / 0 ties / 3 losses against production v19. Epoch 12 failed a complex hand/trigger interaction and produced a duplicated character in one bedroom image.

Promotion was approved for epoch 8 only:

- Production ID: `L_NENE_V20_ANIMA`
- Production file: `ComfyUI/models/loras/ayachi_nene_v20_anima.safetensors`
- SHA-256: `e5c850dafe8fe8c9466e5378aa1192d3e4290b1d45cc46bb64a16fbb177c15ed`
- Default weight: `0.85`
- Previous v19 production file remains present with SHA-256 `eb0a29dfbe0a80ea9fd63d874fdb49ac92ff8f6d3aedb91637c9141c807e9bb9`.

Full evidence and the remaining dark-bedroom limitation are recorded in `docs/anima-v20-scientific-training-result-2026-08-09.md`.
