# Round 6 Training Telemetry and Polling Split

## Actual Changes

- Added `useTrainingTelemetry()` for per-job loss history, eight-point step-rate samples, ETA text, loss polyline generation, and telemetry reset.
- Added `useTrainingPolling()` for the existing three-second interval, in-flight tick deduplication, active-job guards, and scope/unmount cleanup.
- Reduced `TrainingView.vue` to lifecycle wiring; `trainingStore` still owns overview, jobs, status, actions, and log cursor state.
- Added pure coverage for telemetry boundaries and polling race protection.
- No UI, endpoint, storage key, polling interval, or training behavior was added.

## Verification

- `node scripts/tests/test-training-ui-ownership.js`
- `node scripts/tests/test-training-telemetry-polling.js`
- `npm run typecheck:app`
- `npm run build` (passed; bundle budget and precompression passed)
- `git diff --check` (passed)
- `npx playwright test tests/e2e/a11y-device.spec.ts --grep "training workbench"` (4/4 passed: desktop, desktop-narrow, tablet, phone)

## Residual Risks

- The existing browser test uses an in-page training mock with idle jobs, datasets, log responses, and blurred R18 sample previews; live progress/ETA transitions and real start/stop requests were not exercised, so no GPU training was started.
