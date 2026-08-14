'use strict';

/**
 * useAnimaSession 组合函数测试 —— 生成生命周期所有权（提交/轮询/取消/卸载清理）。
 * 用注入的假 client 驱动，不依赖真实网关。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  useAnimaSession,
  animaRequestPayload,
  closestSupportedSize,
} = require('../../src/composables/useAnimaSession.ts');

// node 没有 URL.createObjectURL / revokeObjectURL，成功路径需要桩
URL.createObjectURL = URL.createObjectURL || (() => 'blob:mock');
URL.revokeObjectURL = URL.revokeObjectURL || (() => {});

// 结果图片下载走全局 fetch（会话内二进制路径），用桩返回图片响应
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('/result')) {
    return new Response(new Blob([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
  }
  return originalFetch(url, init);
};

function fakeClient(routes) {
  return {
    request: async (url, init = {}) => {
      // 模拟 apiClient 的 JSON 序列化（真实客户端在发出前 stringify body）
      const prepared = init.body !== undefined ? { ...init, body: JSON.stringify(init.body) } : init;
      const key = String(url) + '|' + String(prepared.method || 'GET');
      if (!routes[key]) throw new Error('unexpected request: ' + key);
      return routes[key](prepared);
    },
  };
}

function baseOptions(overrides = {}) {
  return {
    getCharacter: () => 'nene',
    isPopular: () => false,
    getFamily: () => 'anima',
    getRequest: () => ({
      prompt: '1girl', negative: 'bad', profileId: 'wai_v17', modelId: 'anima-aesthetic-v1.1',
      loraId: 'L_NENE_V21_ANIMA', loraStrength: 0.85, width: 832, height: 1216,
      steps: 24, cfg: 3, character: 'nene_b',
    }),
    onResult: () => {},
    flash: () => {},
    preferredSize: () => '832x1216',
    ...overrides,
  };
}

function statusPayload(overrides = {}) {
  return {
    ok: true, online: true,
    models: [
      { id: 'anima-aesthetic-v1.1', family: 'anima', available: true, sizes: ['832x1216', '1024x1536'], defaults: { steps: 30, cfg: 4.5, sampler: 'res_multistep', scheduler: 'simple' } },
      { id: 'krea2-turbo-fp8', family: 'krea2', available: true, sizes: ['1024x1024'] },
    ],
    loras: [
      { id: 'L_NENE_V21_ANIMA', character: 'nene', available: true },
      { id: 'L_NAT_V21_ANIMA', character: 'natsume', available: true },
    ],
    styleLoras: [],
    ...overrides,
  };
}

test('closestSupportedSize 收敛到白名单内比例最接近的尺寸', () => {
  const model = { sizes: ['832x1216', '1024x1536', '768x1344'] };
  assert.equal(closestSupportedSize(model, '832x1216'), '832x1216');
  assert.equal(closestSupportedSize(model, '800x1200'), '1024x1536');
  assert.equal(closestSupportedSize(undefined, '832x1216'), '832x1216');
  assert.equal(closestSupportedSize({ sizes: [] }, '832x1216'), '832x1216');
});

test('animaRequestPayload 按白名单收敛：空 lora / styleLora / seed 不发送', () => {
  assert.deepEqual(
    animaRequestPayload({ prompt: 'x', negative: 'y', modelId: 'm', loraId: null, loraStrength: null, width: 832, height: 1216, steps: 24, cfg: 3, character: null }),
    { prompt: 'x', negative: 'y', modelId: 'm', width: 832, height: 1216, steps: 24, cfg: 3, character: null },
  );
  assert.deepEqual(
    animaRequestPayload({ prompt: 'x', negative: 'y', modelId: 'm', loraId: 'L', loraStrength: 0.5, styleLoraId: 'S', width: 832, height: 1216, steps: 24, cfg: 3, seed: 42, character: null }),
    { prompt: 'x', negative: 'y', modelId: 'm', loraId: 'L', loraStrength: 0.5, styleLoraId: 'S', width: 832, height: 1216, steps: 24, cfg: 3, seed: 42, character: null },
  );
});

test('refreshBackend 收敛 model/lora 白名单、尺寸与默认参数', async () => {
  const client = fakeClient({
    '/api/creative/status|GET': () => statusPayload(),
  });
  const session = useAnimaSession({ ...baseOptions({ client }) });
  await session.refreshBackend();
  const state = session.state.value;
  assert.equal(state.online, true);
  assert.deepEqual(state.models.map(m => m.id), ['anima-aesthetic-v1.1']);
  assert.deepEqual(state.loras.map(l => l.id), ['L_NENE_V21_ANIMA']);
  assert.equal(state.modelId, 'anima-aesthetic-v1.1');
  assert.equal(state.loraId, 'L_NENE_V21_ANIMA');
  assert.equal(state.steps, 30);
  assert.equal(state.cfg, 4.5);
  assert.match(state.checkMsg, /Anima 在线/);
});

test('refreshBackend 热门角色只暴露 no-LoRA 底模', async () => {
  const client = fakeClient({
    '/api/creative/status|GET': () => statusPayload({
      models: [
        { id: 'anima-aesthetic-v1.1', family: 'anima', available: true, capabilities: { noLora: true }, sizes: ['832x1216'] },
        { id: 'anima-lora-only', family: 'anima', available: true, sizes: ['832x1216'] },
      ],
    }),
  });
  const session = useAnimaSession({ ...baseOptions({ client, isPopular: () => true }) });
  await session.refreshBackend();
  assert.deepEqual(session.state.value.models.map(m => m.id), ['anima-aesthetic-v1.1']);
  assert.deepEqual(session.state.value.loras, []);
});

test('refreshBackend 切 Krea 家族时尺寸收敛到底模白名单', async () => {
  const client = fakeClient({
    '/api/creative/status|GET': () => statusPayload({ styleLoras: [{ id: 'krea-style', trigger: 't', recommendedStrength: 0.8, available: true }] }),
  });
  const session = useAnimaSession({
    ...baseOptions({ client, getFamily: () => 'krea2', preferredSize: () => '832x1216' }),
  });
  await session.refreshBackend();
  const state = session.state.value;
  assert.equal(state.family, 'krea2');
  assert.equal(state.modelId, 'krea2-turbo-fp8');
  assert.equal(`${state.width}x${state.height}`, '1024x1024');
  assert.deepEqual(state.loras, []);
  assert.equal(state.styleLoras.length, 1);
});

test('generate 离线时只提示不提交；在线时完整走 提交→轮询→结果 生命周期', async () => {
  const flashes = [];
  const results = [];
  let polled = 0;
  const client = fakeClient({
    '/api/anima/jobs|POST': () => ({ ok: true, job: { id: 'j1', status: 'queued', seed: 7, resultAvailable: false, resultUrl: null, error: null, code: null } }),
    '/api/anima/jobs/j1|GET': () => {
      polled += 1;
      if (polled < 2) return { ok: true, job: { id: 'j1', status: 'queued', seed: 7, resultAvailable: false, resultUrl: null, error: null, code: null } };
      return { ok: true, job: { id: 'j1', status: 'succeeded', seed: 7, resultAvailable: true, resultUrl: '/api/anima/jobs/j1/result', metadata: { id: 'j1', seed: 7, prompt: '1girl', negative: 'bad' }, error: null, code: null } };
    },
  });
  const offline = useAnimaSession({ ...baseOptions({ client, flash: m => flashes.push(m) }) });
  await offline.generate();
  assert.equal(flashes[0], 'Anima ComfyUI 当前未连接');
  assert.equal(offline.state.value.phase, 'idle');

  const online = useAnimaSession({
    ...baseOptions({ client, onResult: r => results.push(r) }),
  });
  online.patchState({ online: true });
  await online.generate();
  assert.equal(online.state.value.phase, 'succeeded');
  assert.equal(online.state.value.statusText, '生成完成');
  assert.equal(results.length, 1);
  assert.equal(results[0].metadata.id, 'j1');
  assert.equal(results[0].metadata.seed, 7);
  assert.equal(results[0].metadata.prompt, '1girl');
  assert.match(results[0].url, /^blob:/);
});

test('krea2 家族的任务走 /api/creative/jobs', async () => {
  const calls = [];
  const client = fakeClient({
    '/api/creative/jobs|POST': init => {
      calls.push({ url: '/api/creative/jobs', init });
      return { ok: true, job: { id: 'k1', status: 'queued', seed: 1, resultAvailable: false, resultUrl: null, error: null, code: null } };
    },
    '/api/creative/jobs/k1|GET': () => ({ ok: true, job: { id: 'k1', status: 'cancelled', seed: 1, resultAvailable: false, resultUrl: null, error: null, code: null } }),
  });
  const session = useAnimaSession({
    ...baseOptions({
      client, getFamily: () => 'krea2',
      getRequest: () => ({ prompt: 'x', negative: '', profileId: 'p', modelId: 'krea2-turbo-fp8', loraId: null, loraStrength: null, width: 1024, height: 1024, steps: 8, cfg: 1, character: null }),
    }),
  });
  session.patchState({ online: true, family: 'krea2' });
  await session.generate();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'POST');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.modelId, 'krea2-turbo-fp8');
  assert.equal('loraId' in body, false);
  assert.equal(session.state.value.phase, 'cancelled');
});

test('cancel 对 running 任务发 DELETE 并收敛到 cancelled', async () => {
  const deletes = [];
  const client = fakeClient({
    '/api/anima/jobs|POST': () => ({ ok: true, job: { id: 'j9', status: 'queued', seed: 2, resultAvailable: false, resultUrl: null, error: null, code: null } }),
    '/api/anima/jobs/j9|GET': () => ({ ok: true, job: { id: 'j9', status: 'running', seed: 2, resultAvailable: false, resultUrl: null, error: null, code: null } }),
    '/api/anima/jobs/j9|DELETE': () => {
      deletes.push(1);
      return { ok: true, job: { id: 'j9', status: 'cancelled', seed: 2, resultAvailable: false, resultUrl: null, error: null, code: null } };
    },
  });
  const session = useAnimaSession({ ...baseOptions({ client }) });
  session.patchState({ online: true });
  const generatePromise = session.generate();
  // 等一轮轮询进入 running（job 已登记）
  await new Promise(resolve => setTimeout(resolve, 1150));
  await session.cancel();
  assert.equal(deletes.length, 1);
  assert.equal(session.state.value.phase, 'cancelled');
  session.dispose();
  await generatePromise;
});

test('dispose 使在途任务失效并取消运行中的 job、停止轮询', async () => {
  const deletes = [];
  const client = fakeClient({
    '/api/anima/jobs|POST': () => ({ ok: true, job: { id: 'j5', status: 'running', seed: 3, resultAvailable: false, resultUrl: null, error: null, code: null } }),
    '/api/anima/jobs/j5|DELETE': () => {
      deletes.push(1);
      return { ok: true, job: { id: 'j5', status: 'cancelled', seed: 3, resultAvailable: false, resultUrl: null, error: null, code: null } };
    },
  });
  const session = useAnimaSession({ ...baseOptions({ client }) });
  session.patchState({ online: true });
  session.startStatusPolling(50);
  const generatePromise = session.generate();
  await new Promise(resolve => setTimeout(resolve, 50));
  session.dispose();
  assert.equal(deletes.length, 1);
  assert.equal(session.state.value.phase, 'running'); // 状态保留，但后续轮询已被 serial 失效
  await generatePromise;
});

test('syncCharacter：triad 与热门角色清空 LoRA，普通角色按白名单收敛', async () => {
  const session = useAnimaSession({ ...baseOptions({}) });
  session.patchState({ loras: [{ id: 'L_NENE_V21_ANIMA', character: 'nene', available: true }] });
  session.syncCharacter('nene');
  assert.equal(session.state.value.loraId, 'L_NENE_V21_ANIMA');
  session.syncCharacter('triad');
  assert.equal(session.state.value.loraId, '');
  session.syncCharacter('natsume');
  assert.equal(session.state.value.loraId, '');

  const popular = useAnimaSession({ ...baseOptions({ isPopular: () => true }) });
  popular.patchState({ loras: [{ id: 'L_NENE_V21_ANIMA', character: 'nene', available: true }] });
  popular.syncCharacter('nene');
  assert.equal(popular.state.value.loraId, '');
});
