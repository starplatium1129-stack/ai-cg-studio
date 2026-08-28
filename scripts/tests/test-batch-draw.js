'use strict';

/**
 * scripts/tests/test-batch-draw.js — 多场景批量出图执行器回归
 *
 * 覆盖：任务清单构建（场景×张数、seed 递增）、串行执行顺序、
 * 单张失败不打断整批、取消（当前张完成后停止）、进度统计。
 */

const assert = require('assert/strict');
const { test } = require('node:test');
const { useBatchDraw } = require('../../src/composables/generation/useBatchDraw.ts');

function scenes(n) {
  const list = [];
  for (let i = 0; i < n; i++) list.push({ id: 'scene-' + i, title: '场景 ' + i, prose: 'prose ' + i });
  return list;
}

test('start 构建 场景×张数 任务清单并串行执行，seed 按候选递增', async () => {
  const calls = [];
  const batch = useBatchDraw({
    run: async (input) => {
      calls.push({ sceneId: input.scene.id, seed: input.seed, variant: input.variant });
      return { ok: true };
    },
  });

  await batch.start(scenes(2), 3, 1000);

  assert.equal(batch.progress.value.total, 6);
  assert.equal(batch.progress.value.succeeded, 6);
  assert.equal(batch.progress.value.failed, 0);
  assert.equal(batch.progress.value.done, 6);
  assert.equal(batch.running.value, false);

  // 串行顺序：先场景 0 的 3 张，再场景 1 的 3 张；seed = base + variant*1000
  assert.deepEqual(calls.map(c => c.sceneId), ['scene-0', 'scene-0', 'scene-0', 'scene-1', 'scene-1', 'scene-1']);
  assert.deepEqual(calls.map(c => c.seed), [1000, 2000, 3000, 1000, 2000, 3000]);
  assert.deepEqual(calls.map(c => c.variant), [0, 1, 2, 0, 1, 2]);
  assert.equal(batch.jobs.value.every(j => j.status === 'succeeded'), true);
});

test('单张失败不打断整批：失败计数、其余照常执行', async () => {
  const batch = useBatchDraw({
    run: async (input) => {
      if (input.seed === 2000) return { ok: false, error: '模拟失败' };
      return { ok: true };
    },
  });

  await batch.start(scenes(1), 3, 1000);

  assert.equal(batch.progress.value.total, 3);
  assert.equal(batch.progress.value.succeeded, 2);
  assert.equal(batch.progress.value.failed, 1);
  assert.equal(batch.progress.value.done, 3);
  const failed = batch.jobs.value.find(j => j.status === 'failed');
  assert.equal(failed.seed, 2000);
  assert.equal(failed.error, '模拟失败');
});

test('runner 抛异常按失败处理，不中断整批', async () => {
  const batch = useBatchDraw({
    run: async () => { throw new Error('boom'); },
  });

  await batch.start(scenes(2), 1, -1);

  assert.equal(batch.progress.value.failed, 2);
  assert.equal(batch.jobs.value.every(j => j.status === 'failed'), true);
});

test('cancel：当前张完成后停止，剩余任务标记 cancelled', async () => {
  let first = true;
  const batch = useBatchDraw({
    run: async () => {
      if (first) { first = false; batch.cancel(); }
      return { ok: true };
    },
  });

  await batch.start(scenes(3), 1, 5);

  // 第 1 张完成时请求取消 → 第 1 张 succeeded，其余 cancelled
  const statuses = batch.jobs.value.map(j => j.status);
  assert.equal(statuses[0], 'succeeded');
  assert.equal(statuses.filter(s => s === 'cancelled').length, 2);
  assert.equal(batch.running.value, false);
});

test('随机 seed（-1）逐张保持随机不锁定', async () => {
  const seeds = [];
  const batch = useBatchDraw({
    run: async (input) => { seeds.push(input.seed); return { ok: true }; },
  });

  await batch.start(scenes(2), 2, -1);

  assert.deepEqual(seeds, [-1, -1, -1, -1], '随机模式全部传 -1（由引擎侧随机）');
});

test('running 中重复 start 被拒绝', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const batch = useBatchDraw({
    run: async () => { await gate; return { ok: true }; },
  });

  const first = batch.start(scenes(1), 1, 1);
  const second = batch.start(scenes(1), 1, 1); // 应直接返回
  release();
  await first;
  await second;

  assert.equal(batch.progress.value.total, 1, '第二次 start 不应重建任务清单');
});

test('runner 回传 resultUrl 时落到任务上，reset 释放', async () => {
  const revoked = [];
  const originalRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = (url) => { revoked.push(url); };
  try {
    const batch = useBatchDraw({
      run: async (input) => ({ ok: true, resultUrl: 'blob:preview-' + input.seed }),
    });

    await batch.start(scenes(1), 2, 1000);
    assert.deepEqual(
      batch.jobs.value.map(j => j.resultUrl),
      ['blob:preview-1000', 'blob:preview-2000'],
      '成功张的预览 URL 应逐张落任务',
    );

    batch.reset();
    assert.equal(batch.jobs.value.length, 0);
    assert.deepEqual(revoked, ['blob:preview-1000', 'blob:preview-2000'], 'reset 应释放全部预览 URL');
  } finally {
    URL.revokeObjectURL = originalRevoke;
  }
});

test('retryFailed 只重跑失败/已取消张，seed 与候选序号原样保留', async () => {
  const calls = [];
  let failSeed = 2000;
  const batch = useBatchDraw({
    run: async (input) => {
      calls.push({ sceneId: input.scene.id, seed: input.seed, variant: input.variant });
      if (input.seed === failSeed) return { ok: false, error: '首次失败' };
      return { ok: true };
    },
  });

  await batch.start(scenes(1), 3, 1000);
  assert.equal(batch.progress.value.failed, 1);

  failSeed = -1; // 重跑全部成功
  await batch.retryFailed(scenes(1));

  assert.equal(batch.progress.value.total, 3, '重跑不重建清单');
  assert.equal(batch.progress.value.succeeded, 3);
  assert.equal(batch.progress.value.failed, 0);
  // 最后一次调用应是失败张的原样重放：scene-0 / seed 2000 / 候选 1
  const last = calls[calls.length - 1];
  assert.deepEqual(
    { id: last.sceneId, seed: last.seed, variant: last.variant },
    { id: 'scene-0', seed: 2000, variant: 1 },
  );
  const retriedJob = batch.jobs.value.find(j => j.seed === 2000);
  assert.equal(retriedJob.status, 'succeeded');
  assert.equal(retriedJob.error, undefined, '重跑成功后清掉旧错误');
});
