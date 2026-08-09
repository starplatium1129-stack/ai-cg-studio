# Round 5 Training Lifecycle Split

## Ownership

- `src/composables/useTrainingParams.ts` owns the LoRA parameter field whitelist, drafts, storage key, config loading deduplication, validation, persistence, reset, overrides, and learning-rate formatting.
- `src/composables/useTrainingOnboarding.ts` owns the `aics_training_onboarded` preference and dismissal action.
- `src/views/TrainingView.vue` retains dataset selection, loss and ETA telemetry, polling, logs, and job start/stop lifecycle. Its parameter and onboarding code is wiring only.

## Contract Notes

- Parameter storage is injected in tests and defaults to browser `localStorage`; storage failures are silent.
- Saved drafts merge only finite numeric whitelist fields. Unknown keys and non-finite or non-number values are ignored.
- Per-job pending promises make concurrent config loads share one request and both callers await completion. Failed loads clear loading/error state and can be retried.
- Input bounds clamp with the existing Chinese toast messages. Empty input removes the field and persists; reset restores recommendations and removes the draft.

## Verification

The following commands were run for this round:

- `node --test scripts/tests/test-training-ui-ownership.js`
- `node scripts/tests/test-quality-gates.js`
- `node scripts/tests/test-page-architecture.js`
- `node scripts/tests/test-training-routes.js`
- `npm run typecheck:app`
- `git diff --check`

## Browser Acceptance

- `npx playwright test tests/e2e/a11y-device.spec.ts --grep "training workbench"`: 4/4 passed across desktop, desktop-narrow, tablet, and phone.
- A temporary Playwright script reused the training mock shape and passed on desktop. It verified parameter details default collapsed, recommended values after expansion, finite localStorage persistence, over-limit clamp and Chinese toast, reset removal, and dataset/button visibility.
- The same browser run captured `POST /api/training/jobs` and verified the body contained only the changed override: `{ epochs: 150 }`, with dataset `V18_WD14_Curated`.
- The temporary script was deleted after acceptance; no shared E2E spec was modified.
- Browser overflow check passed with `document.documentElement.scrollWidth - clientWidth <= 1`.
