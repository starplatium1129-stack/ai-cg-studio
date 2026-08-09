# Round 3 Workbench Hierarchy

Date: 2026-08-09

## Changes

- `src/views/TrainingView.vue`
  - Training parameter overrides are now inside a native `details` panel, closed by default.
  - Dataset selection, start/stop actions, status, progress, ETA, logs, voice jobs, and R18 blurred sample handling remain unchanged.
- `src/views/ControlView.vue`
  - The aggregate creation status remains the primary status tile.
  - Normal services are visually quieter; offline, incomplete, and self-healing services receive explicit attention styling.
  - Desktop rail and mobile navigation remain unchanged.
- `src/assets/css/director.css`
  - Mobile grid areas explicitly enforce story -> canvas -> decisions before generation.
  - Result state keeps the result canvas/actions ahead of queue and voice controls without hiding either feature.

## Evidence

- Screenshots: `.review-shots/round3-workbench/`
  - `training-1440x960.png`
  - `control-1440x960.png`
  - `prompt-builder-1440x960.png`
  - `training-390x844.png`
  - `control-390x844.png`
  - `prompt-builder-390x844.png`
- Browser evidence: all six captures passed viewport overflow checks (`scrollWidth - clientWidth <= 1`).
- Training evidence: primary start action visible; parameter panel closed by default.
- Control evidence: service check action and aggregate status visible.
- Prompt Builder evidence: generate action and voice studio present.

## Commands

- `npm run typecheck:app` passed.
- `npm run build` passed. Existing Vite chunk-size warning remains.
- `node --test scripts/tests/test-training-routes.js scripts/tests/test-control-failure-contract.js scripts/tests/test-prompt-builder-modules.js` passed, 4 tests.
- Temporary Playwright capture test, desktop config: 3 tests passed.
- Temporary Playwright capture test, 390x844 config reusing the running local server: 3 tests passed.
- Existing `tests/e2e/a11y-device.spec.ts --project=phone --grep "director|training|control"`: 5 tests passed.

## Remaining Risks

- Browser capture checks use the existing application/mock gateway state and do not exercise a live training start or live image generation.
- The build still reports the existing generic Vite warning for chunks over 500 kB; route bundle budget remains within its configured limits.

## SOL Second-Round Sign-Off

- Source review found no ownership or lifecycle regression. Training parameters are collapsed without hiding dataset/start/status controls; control status emphasis is CSS-only; Prompt Builder generation, queue and voice ownership remains unchanged.
- All six desktop/mobile screenshots were re-reviewed: 6/6 PASS, no clipping, hierarchy break, contrast failure or missing core action.
- No second-round code fix was required.
