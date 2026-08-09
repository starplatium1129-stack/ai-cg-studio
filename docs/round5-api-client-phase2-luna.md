# Round 5 API Client Phase 2

## Scope

Migrated ordinary JSON calls for chat provider/status, voice status/prepare/translation, Live2D status, and SD status into injectable API modules. No server route, stream, storage, ASR, or `/sdapi/**` behavior was changed.

## Modules

- `src/api/chatApi.ts`: chat status, host config GET/POST/DELETE, provider test.
- `src/api/voiceApi.ts`: TTS status, voice prepare, translation.
- `src/api/mediaStatusApi.ts`: Live2D and SD status.

All modules default to a shared instance and expose factories for Node tests. They pass caller abort signals, apply endpoint-specific timeouts, and reject invalid response shapes. Host config uses a configured/unconfigured discriminated shape: an unconfigured GET may omit `model`/`baseUrl`, a configured save response must contain both non-empty strings, and every shape rejects an `apiKey` response field.

## Caller Behavior

- `useChatProvider`: host refresh remains silent on failure; save distinguishes timeout, network, cancel, and HTTP failure without exposing credentials; clear still clears local UI state after failure.
- `ChatApiSettings`: provider test displays `ApiClientError` message, including server `error` and `detail`.
- `VoiceStudio`: status/prepare/translation use the client; prepare remains best-effort; `/api/tts` audio remains raw fetch.
- `useVoice`: status, prepare, and translation use the client; same-key prepare promise merging and stale-key guard remain; translation failure still falls back to Chinese; streaming TTS remains unchanged.
- `useLive2D`: status failures still enter the existing static fallback path.
- `useSDGenerate`: aggregate status failures still fall through to raw `/sdapi` probes.

## Verification

Scoped commands:

- `node --test scripts/tests/test-api-client.js`
- `node scripts/tests/test-chat.js`
- `node scripts/tests/test-live2d-backend.js`
- `node scripts/tests/test-sd-runtime.js`
- `npm run typecheck:app`
- `node scripts/tests/test-prompt-builder-modules.js`
- `node scripts/tests/test-quality-gates.js`
- `npm run test:repo-hygiene`

## Browser Acceptance

- `npx playwright test tests/e2e/flows.spec.ts --grep "flow 1 ·|flow 2 ·|flow 2b ·|flow 3 ·"`: **4 passed**.
  - Covered SD status aggregation/fallback and generation, Voice status/translation/prepare plus raw TTS WAV blob, and streaming chat status/path.
- `npx playwright test tests/e2e/studio.spec.ts --grep "Live2D uses the browser backend by default|Live2D falls back"`: **2 passed**.
  - Covered Live2D status, browser backend default, and native bridge fallback.

The two Playwright commands were finally run serially because they share mock-stack port `3910`.

## Validation Follow-up

- `node scripts/tests/test-prompt-builder-modules.js`: **1 passed**.
- `node --test scripts/tests/test-api-client.js`: **25 passed**.
- `node scripts/tests/test-quality-gates.js`: **2 passed**.
- `npm run typecheck:app`: passed.
- `npm run test:repo-hygiene`: repository scan **1 passed**, contract scan **13 passed**.

The legacy VoiceStudio ownership sentinel now treats `src/api/voiceApi.ts` as the owner of migrated JSON endpoints while retaining `/api/tts` as the component's binary generation path.
