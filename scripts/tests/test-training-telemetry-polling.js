'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { effectScope, ref } = require('vue');

const root = path.join(__dirname, '..', '..');

function moduleUrl(file) {
  return pathToFileURL(path.join(root, 'src', 'composables', file)).href;
}

function job(id, status = 'running', step = 0, steps = 100, loss = 1) {
  return {
    id,
    kind: id.startsWith('voice') ? 'voice' : 'lora',
    character: id.includes('natsume') ? 'natsume' : 'nene',
    label: id,
    datasetId: 'dataset',
    ready: true,
    missing: [],
    status,
    pid: 1,
    startedAt: 0,
    finishedAt: 0,
    exitCode: null,
    error: '',
    runCount: 1,
    logVersion: 1,
    progress: { stage: 'train', message: '', percent: step, step, steps, loss },
  };
}

test('training telemetry keeps an eight-sample moving step window and ETA boundaries', async () => {
  const { useTrainingTelemetry, formatTrainingEta } = await import(moduleUrl('useTrainingTelemetry.ts'));
  let now = 0;
  const telemetry = useTrainingTelemetry(() => now);
  const current = job('lora-nene-v18');

  for (let step = 1; step <= 10; step += 1) {
    now = step * 1000;
    current.progress.step = step;
    telemetry.sampleStep(current);
  }
  assert.equal(telemetry.stepSamples.value[current.id].length, 8);
  assert.equal(telemetry.stepSamples.value[current.id][0].step, 3);

  current.progress.step = 10;
  assert.equal(telemetry.etaText(current), '预计约 2 分钟');
  assert.equal(formatTrainingEta([], 1, 100), '');
  assert.equal(formatTrainingEta([{ t: 0, step: 1 }, { t: 1000, step: 2 }], 2, 61), '预计不足 1 分钟');
  assert.equal(formatTrainingEta([{ t: 0, step: 1 }, { t: 1000, step: 2 }], 2, 62), '预计约 1 分钟');

  telemetry.sampleLoss(current);
  telemetry.sampleLoss(current);
  current.progress.loss = 0.5;
  telemetry.sampleLoss(current);
  assert.equal(telemetry.lossHistory.value[current.id].length, 2);
  telemetry.resetJobTelemetry(current.id);
  assert.deepEqual(telemetry.lossHistory.value[current.id], []);
  assert.deepEqual(telemetry.stepSamples.value[current.id], []);
});

test('training polling starts once, deduplicates in-flight ticks, and stops on unmount', async () => {
  const { useTrainingPolling } = await import(moduleUrl('useTrainingPolling.ts'));
  const mounted = ref(true);
  const activeJob = ref(job('lora-nene-v18'));
  const selectedJobId = ref('lora-nene-v18');
  const timers = new Map();
  let timerId = 0;
  let resolveRefresh;
  let refreshCalls = 0;
  let progressCalls = 0;
  let logCalls = 0;
  const polling = useTrainingPolling({
    mounted,
    activeJob,
    selectedJobId,
    isActive: (value) => value.status === 'running' || value.status === 'stopping',
    refresh: () => {
      refreshCalls += 1;
      return new Promise((resolve) => { resolveRefresh = resolve; });
    },
    loadLogs: async () => { logCalls += 1; },
    onJobProgress: () => { progressCalls += 1; },
    intervalMs: 3000,
    setInterval: (handler) => {
      const id = ++timerId;
      timers.set(id, handler);
      return id;
    },
    clearInterval: (id) => { timers.delete(id); },
  });

  polling.sync();
  polling.sync();
  assert.equal(timers.size, 1);
  const tick = [...timers.values()][0];
  const firstPoll = polling.poll();
  await Promise.resolve();
  const secondPoll = polling.poll();
  assert.equal(refreshCalls, 1);
  assert.notEqual(secondPoll, undefined);

  polling.stop();
  assert.equal(timers.size, 0);
  resolveRefresh();
  await Promise.all([firstPoll, secondPoll]);
  assert.equal(progressCalls, 0);
  assert.equal(logCalls, 0);
  assert.equal(typeof tick, 'function');

  mounted.value = true;
  polling.sync();
  assert.equal(timers.size, 1);
  const nextPoll = polling.poll();
  await Promise.resolve();
  activeJob.value = job('lora-natsume-v18');
  resolveRefresh();
  await nextPoll;
  assert.equal(progressCalls, 0);
  assert.equal(logCalls, 0);
  polling.stop();
});

test('training polling disposes its interval with the component scope', async () => {
  const { useTrainingPolling } = await import(moduleUrl('useTrainingPolling.ts'));
  const mounted = ref(true);
  const activeJob = ref(job('lora-nene-v18'));
  const selectedJobId = ref('lora-nene-v18');
  const timers = new Set();
  const scope = effectScope();
  scope.run(() => {
    const polling = useTrainingPolling({
      mounted,
      activeJob,
      selectedJobId,
      isActive: (value) => value.status === 'running',
      refresh: async () => {},
      loadLogs: async () => {},
      onJobProgress: () => {},
      setInterval: (handler) => {
        const id = handler;
        timers.add(id);
        return id;
      },
      clearInterval: (id) => { timers.delete(id); },
    });
    polling.sync();
  });
  assert.equal(timers.size, 1);
  scope.stop();
  assert.equal(timers.size, 0);
});
