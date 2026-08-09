'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const paramsPath = path.join(__dirname, '..', '..', 'src', 'composables', 'useTrainingParams.ts');
const onboardingPath = path.join(__dirname, '..', '..', 'src', 'composables', 'useTrainingOnboarding.ts');
const viewPath = path.join(__dirname, '..', '..', 'src', 'views', 'TrainingView.vue');

function fakeStorage(initial = {}, throws = false) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      if (throws) throw new Error('storage unavailable');
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (throws) throw new Error('storage unavailable');
      values.set(key, value);
    },
    removeItem(key) {
      if (throws) throw new Error('storage unavailable');
      values.delete(key);
    },
  };
}

function config(recommended = {}) {
  return {
    id: 'lora-nene-v18',
    kind: 'lora',
    available: true,
    fields: { ...recommended },
    recommended: { ...recommended },
  };
}

async function loadModules() {
  const params = await import(pathToFileUrl(paramsPath));
  const onboarding = await import(pathToFileUrl(onboardingPath));
  return { params, onboarding };
}

function pathToFileUrl(file) {
  const { pathToFileURL } = require('node:url');
  return pathToFileURL(file).href;
}

test('training composables deduplicate concurrent config loads and await completion', async () => {
  const { params } = await loadModules();
  let resolveConfig;
  let calls = 0;
  const loader = () => {
    calls += 1;
    return new Promise((resolve) => { resolveConfig = resolve; });
  };
  const composable = params.useTrainingParams({
    loadJobConfig: loader,
    showToast: () => {},
    storage: fakeStorage(),
  });

  const first = composable.ensureParams('lora-nene-v18');
  const second = composable.ensureParams('lora-nene-v18');
  assert.equal(calls, 1);
  assert.equal(composable.draftFor('lora-nene-v18').loading, true);
  resolveConfig(config({ epochs: 143, batch_size: 4 }));
  await Promise.all([first, second]);
  assert.equal(composable.draftFor('lora-nene-v18').loading, false);
  assert.equal(composable.paramValue('lora-nene-v18', 'epochs'), 143);
});

test('training params report failures, clear loading, and permit retry', async () => {
  const { params } = await loadModules();
  let calls = 0;
  const composable = params.useTrainingParams({
    loadJobConfig: async () => {
      calls += 1;
      if (calls === 1) throw new Error('config network down');
      return config({ epochs: 143 });
    },
    showToast: () => {},
    storage: fakeStorage(),
  });
  await composable.ensureParams('lora-nene-v18');
  assert.equal(composable.draftFor('lora-nene-v18').loading, false);
  assert.match(composable.draftFor('lora-nene-v18').error, /config network down/);
  await composable.ensureParams('lora-nene-v18');
  assert.equal(calls, 2);
  assert.equal(composable.draftFor('lora-nene-v18').error, '');
  assert.equal(composable.paramValue('lora-nene-v18', 'epochs'), 143);
});

test('saved params accept only finite whitelist numbers and unknown keys are ignored', async () => {
  const { params } = await loadModules();
  const storage = fakeStorage({
    'aics_training_params_lora-nene-v18': JSON.stringify({
      epochs: 99,
      unknown: 123,
      batch_size: Infinity,
      lora_rank: '32',
      lora_alpha: [64],
    }),
  });
  const composable = params.useTrainingParams({
    loadJobConfig: async () => config({ epochs: 143, batch_size: 4, lora_rank: 32, lora_alpha: 32 }),
    showToast: () => {},
    storage,
  });
  await composable.ensureParams('lora-nene-v18');
  const draft = composable.draftFor('lora-nene-v18');
  assert.deepEqual(draft.values, { epochs: 99, batch_size: 4, lora_rank: 32, lora_alpha: 32 });

  composable.setParam('lora-nene-v18', 'unknown', '12');
  assert.equal(Object.hasOwn(draft.values, 'unknown'), false);
  assert.deepEqual(JSON.parse(storage.values.get('aics_training_params_lora-nene-v18')), {
    epochs: 99,
    unknown: 123,
    batch_size: null,
    lora_rank: '32',
    lora_alpha: [64],
  });
});

test('training params clamp, persist exact values, clear, and reset', async () => {
  const { params } = await loadModules();
  const storage = fakeStorage();
  const toasts = [];
  const composable = params.useTrainingParams({
    loadJobConfig: async () => config({ epochs: 143, batch_size: 4 }),
    showToast: (message) => toasts.push(message),
    storage,
  });
  await composable.ensureParams('lora-nene-v18');
  composable.setParam('lora-nene-v18', 'epochs', '0');
  assert.equal(composable.paramValue('lora-nene-v18', 'epochs'), 1);
  assert.match(toasts[0], /不能低于 1/);
  assert.deepEqual(JSON.parse(storage.values.get('aics_training_params_lora-nene-v18')), { epochs: 1, batch_size: 4 });
  composable.setParam('lora-nene-v18', 'epochs', '');
  assert.equal(composable.paramValue('lora-nene-v18', 'epochs'), 143);
  assert.deepEqual(JSON.parse(storage.values.get('aics_training_params_lora-nene-v18')), { batch_size: 4 });
  composable.setParam('lora-nene-v18', 'epochs', '200');
  composable.resetParams('lora-nene-v18');
  assert.equal(composable.paramValue('lora-nene-v18', 'epochs'), 143);
  assert.equal(storage.values.has('aics_training_params_lora-nene-v18'), false);
});

test('overrides return finite whitelist values that differ from finite recommendations', async () => {
  const { params } = await loadModules();
  const composable = params.useTrainingParams({
    loadJobConfig: async () => config({ epochs: 143, batch_size: 4, lora_rank: 32 }),
    showToast: () => {},
    storage: fakeStorage(),
  });
  await composable.ensureParams('lora-nene-v18');
  composable.setParam('lora-nene-v18', 'epochs', '144');
  composable.setParam('lora-nene-v18', 'batch_size', '4');
  const overrides = composable.overridesFor('lora-nene-v18');
  assert.deepEqual(overrides, { epochs: 144 });
  assert.equal(Object.hasOwn(overrides, 'unknown'), false);
  const draft = composable.draftFor('lora-nene-v18');
  draft.values.lora_rank = Number.NaN;
  draft.recommended.batch_size = Number.POSITIVE_INFINITY;
  assert.deepEqual(composable.overridesFor('lora-nene-v18'), { epochs: 144 });
});

test('onboarding loads and dismisses, including storage failures', async () => {
  const { onboarding } = await loadModules();
  const storage = fakeStorage({ aics_training_onboarded: '1' });
  const loaded = onboarding.useTrainingOnboarding({ storage });
  assert.equal(loaded.onboardingDismissed.value, true);
  loaded.dismissOnboarding();
  assert.equal(storage.values.get('aics_training_onboarded'), '1');

  const broken = onboarding.useTrainingOnboarding({ storage: fakeStorage({}, true) });
  assert.equal(broken.onboardingDismissed.value, false);
  assert.doesNotThrow(() => broken.dismissOnboarding());
  assert.equal(broken.onboardingDismissed.value, true);
});

test('TrainingView wires ownership without retaining parameter or onboarding implementations', () => {
  const view = fs.readFileSync(viewPath, 'utf8');
  assert.match(view, /useTrainingParams\(\{ loadJobConfig, showToast \}\)/);
  assert.match(view, /useTrainingOnboarding\(\)/);
  assert.doesNotMatch(view, /interface ParamDraft/);
  assert.doesNotMatch(view, /function paramsKey\(/);
  assert.doesNotMatch(view, /function ensureParams\(/);
  assert.doesNotMatch(view, /function dismissOnboarding\(/);
});
