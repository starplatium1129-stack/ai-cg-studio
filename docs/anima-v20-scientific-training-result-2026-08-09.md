# Anima v20 Scientific Training Result

Date: 2026-08-09

## Decision

Promote Baseline A epoch 8 / step 336 as `L_NENE_V20_ANIMA`. Do not promote epoch 12 or the final epoch. Keep the previous v19 production file intact as a rollback artifact.

## Authoritative Basis

- Base model: `circlestone-labs/Anima Base v1.0`, not the Aesthetic checkpoint.
- The Anima model card requires LoRAs to avoid training the LLM adapter and recommends rank 32 starting at LR `2e-5`.
- The author trainer contract informed AdamW betas `0.9/0.99`, weight decay `0.01`, BF16 and held-out checkpoint selection.
- OneTrainer's Anima setup freezes the Qwen text encoder and Anima text conditioner, so the native-Windows run trained transformer LoRA layers only.
- The official diffusion-pipe runtime was not installed because this machine has no WSL distribution; changing trainer and environment during the experiment would have added an uncontrolled variable.

Primary source: `https://huggingface.co/circlestone-labs/Anima`.

## Frozen Dataset

- Source: `AI/Datasets/Characters/Ayachi_Nene/V18_WD14_Curated`.
- Snapshot: `AI/Datasets/Characters/Ayachi_Nene/V20_Anima_Scientific`.
- Source files were copied byte-for-byte and checked by SHA-256; originals were not mutated.
- Total: 55 files / 25 independent `review.dedupe_group` values.
- Train: 42 files / 20 groups.
- Held-out validation: 13 files / 5 complete groups.
- Safety taxonomy: 21 safe, 12 sensitive, 9 nsfw, 13 explicit.
- Manifest SHA-256: `ad3f7b1c24f5d8614c1a6b7871d5f14e0d676f25227fd1ece969cd1e62fb06ef`.

Held-out groups:

- `official_5003_night_support`
- `official_5005_clothed_lap`
- `official_5006_red_cardigan`
- `r18_ev101_library_skirt`
- `r18_ev121_bed_pov`

All 13 validation images passed manual identity, outfit, anatomy, framing and safety-taxonomy review before training.

## Baseline A

- Config: `AI/OneTrainer/training_configs/ayachi_nene_v20_anima_scientific.json`
- Config SHA-256: `c4fc5663d5c4cbdf77268bead68c81212f0f6d548a1810fe5ce4ad5f7b34484d`
- Transformer LoRA only; rank / alpha `32 / 32`.
- Constant LR `2e-5`; AdamW betas `0.9 / 0.99`; weight decay `0.01`.
- BF16 training, FP32 LoRA weights, 1024 AR buckets, batch / accumulation `1 / 1`.
- No random flip, crop jitter, color augmentation, tag shuffle or tag dropout.
- 36 epochs / 1,512 optimizer steps; validation every 2 epochs; save and sample every 4 epochs.
- Runtime: approximately 68 minutes on an RTX 4070 Ti SUPER 16 GB.

GPU cache and one-epoch smoke runs passed before the formal run. Separate validation concept seeds exposed independent non-R18 and R18 TensorBoard curves.

## Validation Curve

| Epoch | Step | Non-R18 | R18 | Total average |
|---:|---:|---:|---:|---:|
| 0 | 0 | 0.069604866 | 0.068254180 | 0.069189273 |
| 8 | 336 | 0.067323513 | 0.065847002 | 0.066869199 |
| 10 | 420 | **0.067172386** | 0.065678172 | **0.066712625** |
| 12 | 504 | 0.067256309 | **0.065580934** | 0.066740811 |
| 16 | 672 | 0.067291364 | 0.065692499 | 0.066799410 |
| 34 | 1428 | 0.067583993 | 0.065948002 | 0.067080610 |

Epoch 10 was not a saved checkpoint. Epoch 8 was the first fixed save near the total minimum; epoch 12 was the closest save to the R18 minimum. Values after epoch 18 mostly rose, so later checkpoints were not eligible based on training loss alone.

## Checkpoint Review

OneTrainer fixed validation samples:

- Epoch 8: strongest identity and motion freedom; all 13 validation images passed, with one multi-panel tendency in a school-uniform prompt.
- Epoch 12: good overall balance but early hand/foot and panel-composition warning signs.
- Epoch 16: more stable single-image composition but visibly harder linework and stronger pose locking.
- Epoch 36: rejected because held-out loss and visual rigidity were worse than the early shortlist.

Production ComfyUI audit:

- Evidence root: `AI/Reviews/AnimaV20CheckpointAudit/2026-08-09_baseline-a_e08_e12_vs_v19`.
- Contract: six production scenes x three fixed seeds, same prompt, seed, model, size, sampler, scheduler, steps, CFG and LoRA strength.
- Baseline: production v19 epoch 20 / step 1100 at strength `0.85`.
- Candidates: v20 epoch 8 and epoch 12 at strength `0.85`.
- Generated records: 36/36 succeeded; contact sheets include all 18 v19 baseline images.

Manual row-level result:

| Candidate vs v19 | Wins | Ties | Losses | Structural failures |
|---|---:|---:|---:|---:|
| V20 epoch 8 | 15 | 0 | 3 | 0 |
| V20 epoch 12 | 12 | 0 | 6 | 2 |

Epoch 8 won all identity close-up, half-body, full-body strong-light, complex official-witch and library R18 rows. Its three losses were the dark-bedroom rows, where v19 retained softer low-light skin rendering. Epoch 12 was rejected because one complex gun pose had a hand/trigger overlap and one bedroom row split the solo character into two bodies.

Safe scenes were 12/12 free of adult leakage. R18 scenes activated correctly in 6/6 rows. Epoch 8 passed all 18 rows without multi-character leakage, feature swapping or critical anatomy failure.

## Diversity

`diversity-metrics.json` records pixel, edge and average-hash differences between the three seeds for each scene. V20 notably increased seed variation in the half-body, complex-witch and dark-bedroom scenes. The library scene remained less varied than v19, so diversity metrics were used as diagnostics rather than a standalone selection score.

## Promotion

- Promotion script: `scripts/maintenance/promote-anima-v20-checkpoint.js`.
- Selected source SHA-256: `e5c850dafe8fe8c9466e5378aa1192d3e4290b1d45cc46bb64a16fbb177c15ed`.
- Production file: `AI/ComfyUI/models/loras/ayachi_nene_v20_anima.safetensors`.
- Production ID: `L_NENE_V20_ANIMA`.
- Default strength remains `0.85`; no scene-specific hidden weight override was added.
- Previous production: `ayachi_nene_v19_anima.safetensors`, SHA-256 `eb0a29dfbe0a80ea9fd63d874fdb49ac92ff8f6d3aedb91637c9141c807e9bb9`, retained unchanged.

The application catalog, model profiles, server-side Anima allowlist, Prompt Builder copy and contract tests now use v20. V19 is no longer selectable through the application API.

## Production Smoke

- Evidence: `AI/Reviews/AnimaV20ProductionSmoke/2026-08-09`.
- Real application gateway at an isolated local port connected to real ComfyUI and the production v20 filename.
- Four fixed-seed prompt-format variants completed through `POST /api/anima/jobs` and result consumption.
- Metadata confirmed `anima-base-v1.0`, `L_NENE_V20_ANIMA`, strength `0.85`, 832x1216, 24 steps, CFG 3, `res_multistep/simple`.
- Visual review: 4/4 passed identity, official witch outfit, limbs, single-character integrity, cafe narrative and warm lighting.
- The user selected `quality-space.png` for the product scene library. Its visual outcome is encoded as `sc300` (`暖金咖啡馆的魔女休息日`) with explicit bar-stool, coffee cup, arched-window and golden-hour composition controls.

## Known Limitation

V19 still produced softer low-light skin rendering in all three `sc265` bedroom seeds. V20 remains the production choice because it had no structural failure and won the other 15 fixed comparisons. If this scene class is optimized later, change only one variable at a time and add a dedicated dark-bedroom held-out prompt; do not resume the rejected late checkpoints.
