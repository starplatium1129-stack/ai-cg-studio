# Round 4 Motion Closure

## Changes

- Kept mobile sakura at eight visible petals and removed mobile blur, shadow, and persistent `will-change`.
- Added `(pointer: coarse)` handling to `RouteAtmosphere`; pointer shifts reset when coarse input becomes active.
- Added compatible `matchMedia` listener cleanup for coarse pointer and reduced motion preferences.
- Reduced motion now clears RouteAtmosphere transition state and AppInteractionLayer route, loader, and impulse state.
- Kept the existing immersive route cut allowlist and 120ms loader delay unchanged.
- Disabled desktop-style interaction impulse on coarse pointer devices without changing click sound behavior.

## Verification

- PASS: `npm run typecheck:app`
- PASS: `node scripts/tests/test-page-architecture.js`
- PASS: `node scripts/tests/test-style-debt.js`
- PASS: `npx playwright test tests/e2e/a11y-device.spec.ts --project=phone --grep "樱花与动效"` (1 passed). The test asserts visible sakura count is `>0` and `<=8`, computed `filter`/`box-shadow` are `none`, coarse pointer keeps route shift at zero, and reduced motion clears route state.

## Remaining Risk

- The test uses Playwright init-time media emulation for `(pointer: coarse)` so the coarse branch is always exercised on the phone project.
