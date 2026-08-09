/**
 * Live2D 双后端抽象层测试（test-live2d-backend.js）
 *
 * 覆盖：
 * 1. overlay 布局纯函数（computeOverlayRect / clampToMonitors / normalizeToOverlay）
 * 2. 后端工厂与回退（selectLive2DBackend：native 桥缺失 → browser + fallback 标记）
 * 3. 原生后端会话契约（stub 桥：setCharacter/motion/expression/意图通道/overlay 帧/销毁）
 * 4. 原生桥形状校验（防 Rust 侧实现遗漏命令/事件）
 *
 * 运行：node --test scripts/tests/test-live2d-backend.js
 */
const assert = require('assert');
const { test } = require('node:test');

const {
  computeOverlayRect,
  clampToMonitors,
  normalizeToOverlay,
  overlayPointToScreen,
} = require('../../src/utils/live2dOverlayLayout.ts');
const {
  selectLive2DBackend,
} = require('../../src/live2d/createBackend.ts');
const {
  createNativeLive2DBackend,
} = require('../../src/live2d/nativeBackend.ts');
const {
  NATIVE_BACKEND_UNAVAILABLE,
} = require('../../src/live2d/types.ts');

// ---------- overlay 布局纯函数 ----------

test('computeOverlayRect：DPR=1 时屏幕坐标 = 窗口原点 + CSS 矩形', () => {
  const rect = computeOverlayRect({
    stageRect: { left: 120, top: 60, width: 300, height: 480 },
    dpr: 1,
    windowBounds: { x: 100, y: 50, width: 1280, height: 800 },
  });
  assert.deepEqual(rect, { x: 220, y: 110, width: 300, height: 480 });
});

test('computeOverlayRect：DPR=1.25 / 2 时按设备像素放大', () => {
  const at125 = computeOverlayRect({
    stageRect: { left: 120, top: 60, width: 300, height: 480 },
    dpr: 1.25,
    windowBounds: { x: 100, y: 50, width: 1280, height: 800 },
  });
  assert.deepEqual(at125, { x: Math.round(100 + 120 * 1.25), y: Math.round(50 + 60 * 1.25), width: 375, height: 600 });

  const at200 = computeOverlayRect({
    stageRect: { left: 0, top: 0, width: 100, height: 100 },
    dpr: 2,
    windowBounds: { x: 0, y: 0, width: 800, height: 600 },
  });
  assert.deepEqual(at200, { x: 0, y: 0, width: 200, height: 200 });
});

test('computeOverlayRect：无 windowBounds 时按 0,0 起点', () => {
  const rect = computeOverlayRect({
    stageRect: { left: 10, top: 20, width: 50, height: 80 },
    dpr: 1,
  });
  assert.deepEqual(rect, { x: 10, y: 20, width: 50, height: 80 });
});

test('clampToMonitors：完全在屏幕内不动', () => {
  const rect = { x: 100, y: 100, width: 300, height: 400 };
  const out = clampToMonitors(rect, [{ x: 0, y: 0, width: 1920, height: 1080 }]);
  assert.deepEqual(out, rect);
});

test('clampToMonitors：超出屏幕右边/下边时收进屏幕', () => {
  const out = clampToMonitors(
    { x: 1800, y: 900, width: 400, height: 300 },
    [{ x: 0, y: 0, width: 1920, height: 1080 }],
  );
  assert.deepEqual(out, { x: 1800, y: 900, width: 120, height: 180 });
});

test('clampToMonitors：双屏时落入任一屏幕即不动', () => {
  const rect = { x: 2000, y: 300, width: 200, height: 300 };
  const out = clampToMonitors(rect, [
    { x: 0, y: 0, width: 1920, height: 1080 },
    { x: 1920, y: 0, width: 1920, height: 1080 },
  ]);
  assert.deepEqual(out, rect);
});

test('clampToMonitors：窗口跨屏时收进主屏', () => {
  const out = clampToMonitors(
    { x: 1900, y: 0, width: 400, height: 300 },
    [{ x: 0, y: 0, width: 1920, height: 1080 }],
  );
  assert.deepEqual(out, { x: 1900, y: 0, width: 20, height: 300 });
});

test('normalizeToOverlay / overlayPointToScreen 互为逆变换', () => {
  const stageRect = { left: 50, top: 30, width: 200, height: 400 };
  const normalized = normalizeToOverlay(150, 230, stageRect);
  assert.deepEqual(normalized, { x: 0.5, y: 0.5 });
  const rect = { x: 100, y: 80, width: 400, height: 800 };
  const screen = overlayPointToScreen(normalized, rect);
  assert.deepEqual(screen, { x: 300, y: 480 });
});

test('normalizeToOverlay：零尺寸舞台返回原点', () => {
  assert.deepEqual(normalizeToOverlay(10, 10, { left: 0, top: 0, width: 0, height: 0 }), { x: 0, y: 0 });
});

// ---------- 后端工厂与回退 ----------

test('selectLive2DBackend：默认/浏览器请求返回 browser，无 fallback', () => {
  const selection = selectLive2DBackend('browser');
  assert.equal(selection.effectiveKind, 'browser');
  assert.equal(selection.backend.kind, 'browser');
  assert.equal(selection.fallbackReason, null);
});

test('selectLive2DBackend：native 无桥 → 回退 browser 并带原因', () => {
  const selection = selectLive2DBackend('native', () => undefined);
  assert.equal(selection.effectiveKind, 'browser');
  assert.equal(selection.backend.kind, 'browser');
  assert.match(selection.fallbackReason, /回退/);
});

test('selectLive2DBackend：native 有桥 → 原生后端', () => {
  const bridge = createStubBridge();
  const selection = selectLive2DBackend('native', () => bridge);
  assert.equal(selection.effectiveKind, 'native');
  assert.equal(selection.backend.kind, 'native');
  assert.equal(selection.fallbackReason, null);
});

test('原生后端 capability：参数/眨眼/口型/情绪由 Rust 执行，命中与入场原生接管', () => {
  const backend = createNativeLive2DBackend(() => createStubBridge());
  assert.equal(backend.capability.parameterOverride, false);
  assert.equal(backend.capability.blinkOverride, false);
  assert.equal(backend.capability.lipSyncChannel, 'bridge');
  assert.equal(backend.capability.emotionChannel, 'bridge');
  assert.equal(backend.capability.hitTestNative, true);
  assert.equal(backend.capability.entranceNative, true);
});

// ---------- 原生后端会话（stub 桥） ----------

test('原生后端：桥缺失时 connect reject NATIVE_BACKEND_UNAVAILABLE', async () => {
  const backend = createNativeLive2DBackend(() => undefined);
  await assert.rejects(
    backend.connect({ selector: '#host', modelUrl: '/moc.json', canvasWidth: 420, canvasHeight: 610, character: 'nene' }),
    (error) => error instanceof Error && error.message === NATIVE_BACKEND_UNAVAILABLE,
  );
});

test('原生后端：connect 调用 setCharacter，失败传播错误', async () => {
  const bridge = createStubBridge();
  const backend = createNativeLive2DBackend(() => bridge);
  bridge.setCharacter = async () => ({ ok: false, error: '模型不存在' });
  await assert.rejects(
    backend.connect({ selector: '#host', modelUrl: '/missing.moc3', canvasWidth: 420, canvasHeight: 610, character: 'nene' }),
    /模型不存在/,
  );
});

test('原生后端：会话回传模型句柄，motion/expression 委托桥', async () => {
  const bridge = createStubBridge();
  const backend = createNativeLive2DBackend(() => bridge);
  const session = await backend.connect({ selector: '#host', modelUrl: '/nene.moc3', canvasWidth: 420, canvasHeight: 610, character: 'nene' });
  assert.equal(session.kind, 'native');

  let loaded = null;
  session.onModelLoaded((handle) => { loaded = handle; });
  assert(bridge._readyListeners.length > 0, '应订阅 onReady');
  bridge._readyListeners.forEach((listener) => listener());

  assert(loaded, 'onReady 后应回传模型句柄');
  await loaded.motion('TapHead', undefined, 3);
  assert.equal(bridge.calls.playMotion[0][0], 'TapHead');
  assert.equal(bridge.calls.playMotion[0][2], 'force', 'FORCE 数值 3 应映射为 force');
  await loaded.motion('TapSkirt', 1, 1);
  assert.equal(bridge.calls.playMotion[1][1], 1);
  assert.equal(bridge.calls.playMotion[1][2], 'idle');

  await loaded.expression('school');
  assert.deepEqual(bridge.calls.setExpression[0], ['school']);
});

test('原生后端：意图通道（口型/情绪/凝视）与 overlay 帧', async () => {
  const bridge = createStubBridge();
  const backend = createNativeLive2DBackend(() => bridge);
  const session = await backend.connect({ selector: '#host', modelUrl: '/natsume.moc3', canvasWidth: 420, canvasHeight: 610, character: 'natsume' });

  session.sendMouthLevel(0.42);
  assert.deepEqual(bridge.calls.setMouthLevel[0], [0.42]);
  session.sendMouthLevel(1.5);
  assert.deepEqual(bridge.calls.setMouthLevel[1], [1], '口型电平应钳制到 0..1');

  session.sendEmotion('happy', 0.8);
  assert.deepEqual(bridge.calls.setEmotion[0], ['happy', 0.8]);

  session.sendGaze(-0.5, 0.25);
  assert.deepEqual(bridge.calls.setGaze[0], [-0.5, 0.25]);

  session.setMaxFps(30);
  assert.deepEqual(bridge.calls.setMaxFps[0], [30]);
  session.setMaxFps(200);
  assert.deepEqual(bridge.calls.setMaxFps[1], [165], '原生接电目标 165fps，不被浏览器 120 上限覆盖');
  session.setMaxFps(10);
  assert.deepEqual(bridge.calls.setMaxFps[2], [24], '下限仍为 24');

  session.updateOverlay({ x: 100, y: 80, width: 300, height: 480 }, true);
  assert.deepEqual(bridge.calls.setFrame[0][0], {
    rect: { x: 100, y: 80, width: 300, height: 480 },
    visible: true,
    opacity: 1,
    passthrough: [],
  });

  session.setPaused(true);
  assert.equal(bridge.calls.setFrame[1][0].visible, false, '暂停 → overlay 隐藏');
  assert.equal(bridge.calls.setFrame[1][0].rect.width, 300, '暂停保留上次矩形');

  session.setPaused(false);
  assert.equal(bridge.calls.setFrame[2][0].visible, true, '恢复 → overlay 显示');
});

test('原生后端：原生 HitArea 事件回传（作者分区命中）', async () => {
  const bridge = createStubBridge();
  const backend = createNativeLive2DBackend(() => bridge);
  const session = await backend.connect({ selector: '#host', modelUrl: '/nene.moc3', canvasWidth: 420, canvasHeight: 610, character: 'nene' });

  const hits = [];
  const unsubscribe = session.onNativeHitTest((areas) => hits.push(areas));
  assert(bridge._hitTestListeners.length > 0, '应订阅 onHitTest');
  bridge._hitTestListeners.forEach((listener) => listener(['Head', 'Body']));
  assert.deepEqual(hits, [['Head', 'Body']]);

  unsubscribe();
  bridge._hitTestListeners.forEach((listener) => listener(['Skirt']));
  assert.equal(hits.length, 1, '退订后不再回传');
});

test('原生后端：onMotionFailed 转发 busy 拒绝（同一互动播放中）', async () => {
  const bridge = createStubBridge();
  const backend = createNativeLive2DBackend(() => bridge);
  const session = await backend.connect({ selector: '#host', modelUrl: '/nene.moc3', canvasWidth: 420, canvasHeight: 610, character: 'nene' });

  const failures = [];
  const unsubscribe = session.onMotionFailed((info) => failures.push(info));
  bridge._motionFailedListeners.forEach((listener) => listener({ group: 'TapHead', index: 2, reason: 'motion already playing: TapHead[2]' }));
  assert.deepEqual(failures, [{ group: 'TapHead', index: 2, reason: 'motion already playing: TapHead[2]' }]);

  unsubscribe();
  bridge._motionFailedListeners.forEach((listener) => listener({ group: 'TapSkirt', index: 0, reason: 'x' }));
  assert.equal(failures.length, 1, '退订后不再回传');
});

test('原生后端：销毁时 off 全部订阅并调用 bridge.destroy', async () => {
  const bridge = createStubBridge();
  const backend = createNativeLive2DBackend(() => bridge);
  const session = await backend.connect({ selector: '#host', modelUrl: '/nene.moc3', canvasWidth: 420, canvasHeight: 610, character: 'nene' });
  assert.equal(bridge._offCalls.length, 0, '连接阶段不应有 off');
  session.destroy();
  assert.equal(bridge._offCalls.length, 3, '未注册 onModelLoaded 时应逐个 off 三个连接期订阅');
  assert.equal(bridge.calls.destroy.length, 1);
  assert.equal(bridge._readyListeners.length, 0, '销毁后事件不再派发');
});

// ---------- 桥形状校验（契约防漂移） ----------

test('Live2DNativeBridge 契约：命令与事件方法齐全', () => {
  const bridge = createStubBridge();
  const commands = ['setCharacter', 'setFrame', 'setMaxFps', 'playMotion', 'setExpression', 'setMouthLevel', 'setEmotion', 'setGaze', 'hitTest', 'destroy'];
  const events = ['onReady', 'onMotionStarted', 'onMotionFailed', 'onHitTest', 'onEntranceFinished', 'off'];
  for (const name of commands) {
    assert.equal(typeof bridge[name], 'function', `缺失命令 ${name}`);
  }
  for (const name of events) {
    assert.equal(typeof bridge[name], 'function', `缺失事件 ${name}`);
  }
  assert.equal(bridge.isNativeLive2D, true);
});

// ---------- stub 桥 ----------

function createStubBridge() {
  const calls = {
    setCharacter: [],
    setFrame: [],
    setMaxFps: [],
    playMotion: [],
    setExpression: [],
    setMouthLevel: [],
    setEmotion: [],
    setGaze: [],
    hitTest: [],
    destroy: [],
  };
  const listeners = {
    ready: [],
    motionStarted: [],
    motionFailed: [],
    hitTest: [],
    entranceFinished: [],
  };
  let nextId = 1;
  const offCalls = [];
  const bridge = {
    isNativeLive2D: true,
    calls,
    _readyListeners: listeners.ready,
    _hitTestListeners: listeners.hitTest,
    _motionFailedListeners: listeners.motionFailed,
    _offCalls: offCalls,

    async setCharacter(modelPath, options) { calls.setCharacter.push([modelPath, options]); return { ok: true }; },
    setFrame(frame) { calls.setFrame.push([frame]); },
    setMaxFps(fps) { calls.setMaxFps.push([fps]); },
    async playMotion(group, index, priority) { calls.playMotion.push([group, index, priority]); return { ok: true }; },
    async setExpression(name) { calls.setExpression.push([name]); return { ok: true }; },
    setMouthLevel(level) { calls.setMouthLevel.push([level]); },
    setEmotion(name, intensity) { calls.setEmotion.push([name, intensity]); },
    setGaze(x, y) { calls.setGaze.push([x, y]); },
    async hitTest(x, y) { calls.hitTest.push([x, y]); return { areas: [] }; },
    async destroy() { calls.destroy.push([]); },

    onReady(listener) { listeners.ready.push(listener); return nextId++; },
    onMotionStarted(listener) { listeners.motionStarted.push(listener); return nextId++; },
    onMotionFailed(listener) { listeners.motionFailed.push(listener); return nextId++; },
    onHitTest(listener) { listeners.hitTest.push(listener); return nextId++; },
    onEntranceFinished(listener) { listeners.entranceFinished.push(listener); return nextId++; },
    off(id) {
      offCalls.push(id);
      listeners.ready.splice(0, listeners.ready.length);
      listeners.motionStarted.splice(0, listeners.motionStarted.length);
      listeners.motionFailed.splice(0, listeners.motionFailed.length);
      listeners.hitTest.splice(0, listeners.hitTest.length);
      listeners.entranceFinished.splice(0, listeners.entranceFinished.length);
    },
  };
  return bridge;
}
