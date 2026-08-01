import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import MOCK_PORTS from './mock-ports.json';

/**
 * 六条主流程回归 —— 跑在 mock 上游之上（scripts/tests/mock-stack.js）。
 *
 * 与 studio.spec.ts 的分工：
 *   studio.spec.ts  断言「页面渲染成什么样」
 *   flows.spec.ts   断言「按下按钮之后，网关到底往上游发了什么、拿回来怎么处理」
 *
 * 之所以要真跑一个网关而不是在浏览器里 route mock：这六条流程里有五条会穿过
 * 服务端代码（SD 代理白名单、/api/chat 的 NDJSON 中继、/api/tts 的音频背压
 * 中继、/api/translate 的常驻服务探测、/api/tts-status 的声线判定）。在浏览器
 * 层拦 fetch 会把这些整段跳过 —— 那种"通过"和真机行为无关。
 */

const MOCK = {
  sd: `http://127.0.0.1:${MOCK_PORTS.sd}`,
  ollama: `http://127.0.0.1:${MOCK_PORTS.ollama}`,
  tts: `http://127.0.0.1:${MOCK_PORTS.tts}`,
  translate: `http://127.0.0.1:${MOCK_PORTS.translate}`,
};

interface MockCall {
  method: string;
  path: string;
  query: string;
  body: Record<string, unknown> | null;
}

/** 读回某个 mock 上游收到的请求 */
async function calls(request: APIRequestContext, base: string): Promise<MockCall[]> {
  const res = await request.get(`${base}/__mock/state`);
  expect(res.ok(), `${base} mock state must be readable`).toBeTruthy();
  return (await res.json()).calls as MockCall[];
}

async function callsTo(request: APIRequestContext, base: string, path: string): Promise<MockCall[]> {
  return (await calls(request, base)).filter(call => call.path === path);
}

async function resetMocks(request: APIRequestContext) {
  await Promise.all(Object.values(MOCK).map(base => request.post(`${base}/__mock/reset`)));
}

/** 注入故障（如 CUDA OOM），驱动错误恢复路径 */
async function fault(request: APIRequestContext, base: string, faults: Record<string, unknown>) {
  const res = await request.post(`${base}/__mock/fault`, { data: faults });
  expect(res.ok()).toBeTruthy();
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  const ignore = /favicon|ERR_CONNECTION_REFUSED|404|Failed to load resource.*50[23]|Content Security Policy.*fonts\.googleapis|net::ERR_|autoplay|play\(\) failed/i;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !ignore.test(message.text())) errors.push(message.text());
  });
  return errors;
}

/**
 * 出图参数（CFG / seed / 采样器）折在 <details> 里，默认收起。
 * 用点 summary 的真实路径打开，而不是 evaluate 改 open —— 后者会绕过
 * "这个折叠区到底点不点得开"这件事。
 */
async function openGenerationSettings(page: Page) {
  const panel = page.locator('details.generation-settings');
  if (await panel.evaluate(node => (node as HTMLDetailsElement).open)) return;
  await panel.locator('summary').click();
  await expect(panel.locator('.controls-grid')).toBeVisible();
}

/**
 * 设计系统的开关是 <label><input><span class="slider"> —— slider 盖在 input 上，
 * 常规 check() 会被判成 pointer 被拦截。force 让点击直接落在 input 上，
 * v-model 的 change 仍会触发。
 */
async function toggle(page: Page, target: string | Locator, on: boolean) {
  const input = typeof target === 'string' ? page.locator(target) : target;
  if (await input.isChecked() === on) return;
  // design-system 的开关把 input 做成 `opacity:0; width:0; height:0`，
  // 真正可点的是同级的 .slider/.voice-switch。所以点包裹的 <label>：
  // 那是真实用户的点击目标，也是 check() 唯一能稳定命中的路径。
  await input.locator('xpath=ancestor::label[1]').click();
  await expect(input).toBeChecked({ checked: on });
}

async function useLocalChat(page: Page) {
  const button = page.getByRole('button', { name: '本地模型', exact: true });
  if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

// 浏览器上下文按用例隔离，localStorage / IndexedDB 天然是空的 ——
// 不要在 addInitScript 里清库：那会在 restore() 触发的 reload 上再清一次。
test.beforeEach(async ({ request }) => {
  await resetMocks(request);
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. 出图
// ─────────────────────────────────────────────────────────────────────────────
test('flow 1 · 出图：选场景 → 生成 → 成片入册，参数如实送到 SD', async ({ page, request }) => {
  const errors = collectRuntimeErrors(page);
  // 让出图耗时 2.5 秒，好让 1.2 秒一次的进度轮询真的跑起来
  await fault(request, MOCK.sd, { renderMs: 2500 });
  await page.goto('/prompt-builder?scene=sc001');

  // /api/sd-status 走的是网关聚合接口，能拿到 mock 的模型列表就说明真穿过去了
  await expect(page.locator('.api-status .badge')).toHaveText(/SD 已连接/);
  await expect(page.locator('.preview-output')).toContainText('lora');

  // 固定尺寸与 seed，好让断言不依赖推荐值
  await page.locator('.sd-inline-options select').first().selectOption('896x1344');
  await openGenerationSettings(page);
  await toggle(page, '.ctrl-seed input[type="checkbox"]', true);
  await page.locator('.ctrl-seed input[type="number"]').fill('4242');

  await page.getByRole('button', { name: '生成图片' }).click();

  // 生成中的等待态：舞台切到 RENDERING，进度条出现
  await expect(page.locator('.stage-ready')).toHaveText('RENDERING');
  await expect(page.locator('.sd-progress')).toBeVisible();
  await expect(page.locator('.stage-generating-sub')).toContainText('42%');

  // 成片出现 → blob URL 来自 mock 返回的 base64 PNG
  await expect(page.locator('.result-image')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.pb')).toHaveClass(/has-result/);

  const txt2img = await callsTo(request, MOCK.sd, '/sdapi/v1/txt2img');
  expect(txt2img).toHaveLength(1);
  const payload = txt2img[0].body as Record<string, any>;
  expect(payload.width).toBe(896);
  expect(payload.height).toBe(1344);
  expect(payload.seed).toBe(4242);
  expect(payload.send_images).toBe(true);
  expect(payload.save_images).toBe(false);
  expect(String(payload.prompt)).toContain('masterpiece');
  expect(String(payload.prompt)).toContain('ayachi_nene');
  expect(String(payload.prompt)).toContain('school_uniform');
  expect(String(payload.prompt)).toContain('<lora:');
  // 负面默认开启，且必须真的带上去
  expect(String(payload.negative_prompt)).toContain('worst quality');

  // 出图期间的进度轮询也要真的打到 SD
  expect((await callsTo(request, MOCK.sd, '/sdapi/v1/progress')).length).toBeGreaterThan(0);

  // 保存快照 → IndexedDB 落盘 + 历史面板出现记录
  await page.getByRole('button', { name: '保存快照' }).click();
  await expect(page.locator('.pb-toast')).toContainText('快照已存入本地作品册');
  // 场景模式会收起高级历史面板，但记录仍应真实写入 DOM / IndexedDB。
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('.history-item').first().locator('.history-meta')).toContainText('seed 4242');

  expect(errors).toEqual([]);
});

test('flow 1a · 切换场景：中文字幕跟随第二个场景更新', async ({ page }) => {
  await page.goto('/prompt-builder?scene=sc001');
  const caption = page.locator('.voice-caption-text');
  await expect(caption).toHaveValue(/放学后的等待/);

  await page.locator('button.scene-card').filter({ hasText: '樱花树下的约定' }).click();
  await expect(page.locator('button.scene-card.active')).toContainText('樱花树下的约定');
  await expect(caption).toHaveValue(/樱花树下的约定/);
  await expect(caption).not.toHaveValue(/放学后的等待/);
});

test('flow 1b · 出图失败：CUDA OOM 分类成可执行的降负载重试', async ({ page, request }) => {
  await fault(request, MOCK.sd, { oom: true });
  await page.goto('/prompt-builder?scene=sc001');
  await expect(page.locator('.api-status .badge')).toHaveText(/SD 已连接/);

  await page.locator('.sd-inline-options select').first().selectOption('1216x1664');
  await toggle(page, page.getByRole('checkbox', { name: 'hires.fix', exact: true }), true);
  await page.getByRole('button', { name: '生成图片' }).click();

  // 分类结果必须是显存不足，而不是笼统的"生成失败"
  await expect(page.locator('.sd-recovery-title')).toHaveText('显存不足');
  const recovery = page.getByRole('button', { name: '降低负载后重试' });
  await expect(recovery).toBeVisible();

  // 让重试这次成功，断言恢复动作真的改了参数
  await fault(request, MOCK.sd, {});
  await recovery.click();
  await expect(page.locator('.result-image')).toBeVisible();

  const attempts = await callsTo(request, MOCK.sd, '/sdapi/v1/txt2img');
  expect(attempts).toHaveLength(2);
  expect(attempts[1].body?.width).toBe(832);
  expect(attempts[1].body?.height).toBe(1216);
  expect(attempts[1].body?.enable_hr).toBeUndefined();  // hires.fix 必须被关掉
});

test('flow 1c · 出图队列：串行执行、自动入册', async ({ page, request }) => {
  await page.goto('/prompt-builder?scene=sc001');
  await expect(page.locator('.api-status .badge')).toHaveText(/SD 已连接/);

  await page.getByRole('button', { name: '加入队列' }).click();
  await page.getByRole('button', { name: '加入队列' }).click();

  // 队列跑完：两张图都出，且都自动写进历史
  await expect(page.locator('.sd-queue')).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.history-item')).toHaveCount(2, { timeout: 20_000 });

  const txt2img = await callsTo(request, MOCK.sd, '/sdapi/v1/txt2img');
  expect(txt2img).toHaveLength(2);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 配音
// ─────────────────────────────────────────────────────────────────────────────
test('flow 2 · 配音：中文字幕 → 本机翻译 → GPT-SoVITS 生成 WAV', async ({ page, request }) => {
  // 整套负载下 mock 网关的 voice 状态查询会变慢，放宽等待
  const VOICE_TIMEOUT = 12_000;
  const errors = collectRuntimeErrors(page);
  await page.goto('/prompt-builder');
  await expect(page.locator('.voice-state')).toHaveText('AI 声线就绪', { timeout: VOICE_TIMEOUT });

  /**
   * 显式切到夏目。
   *
   * tts-service 的 activeGptWeights / activeSoVitsWeights 是网关进程级状态，
   * 而 mock 栈的网关跨用例长活着 —— 前面的用例已经激活过宁宁的权重，于是
   * "本次是否 set_*_weights" 会随执行顺序漂移。换声线强制重新激活，断言才稳定。
   */
  await page.locator('.voice-field select').first().selectOption('natsume');
  await expect(page.locator('.voice-state')).toHaveText('AI 声线就绪', { timeout: VOICE_TIMEOUT });

  await page.locator('.voice-caption-text').fill('今天也辛苦了，先休息一会儿吧。');
  await page.getByRole('button', { name: '翻译成日文' }).click();

  // 译文必须来自上游（mock 固定加 [JA] 前缀），不是前端兜底原文
  await expect(page.locator('.voice-script-details textarea')).toHaveValue(/^\[JA\] 今天也辛苦了/);
  await expect(page.locator('.voice-status')).toContainText('已生成日语配音稿');

  const translateCalls = await callsTo(request, MOCK.translate, '/translate');
  expect(translateCalls).toHaveLength(1);
  expect(String(translateCalls[0].body?.text)).toContain('今天也辛苦了');

  await page.getByRole('button', { name: '生成 AI 声线' }).click();
  await expect(page.locator('.voice-audio')).toBeVisible({ timeout: VOICE_TIMEOUT });
  await expect(page.locator('.voice-download')).toBeVisible();
  await expect(page.locator('.voice-status')).toContainText('AI 声线已生成');

  // 上游收到的 TTS 载荷：声线权重先切换，再送规范化后的文本
  const ttsCalls = await callsTo(request, MOCK.tts, '/tts');
  expect(ttsCalls).toHaveLength(1);
  expect(ttsCalls[0].body?.text_lang).toBe('ja');
  expect(String(ttsCalls[0].body?.ref_audio_path)).toContain('natsume');
  expect(ttsCalls[0].body?.media_type).toBe('wav');
  const weightCalls = await calls(request, MOCK.tts);
  expect(weightCalls.some(c => c.path === '/set_sovits_weights' && c.query.includes('natsume'))).toBeTruthy();
  expect(weightCalls.some(c => c.path === '/set_gpt_weights' && c.query.includes('natsume'))).toBeTruthy();

  expect(errors).toEqual([]);
});

test('flow 2b · 配音失败：GPT-SoVITS 502 带出真实原因而不是"不可用"', async ({ page, request }) => {
  const VOICE_TIMEOUT = 12_000;
  await fault(request, MOCK.tts, { ttsStatus: 500, ttsError: 'RuntimeError: reference audio missing' });
  await page.goto('/prompt-builder');
  await expect(page.locator('.voice-state')).toHaveText('AI 声线就绪', { timeout: VOICE_TIMEOUT });

  await page.locator('.voice-caption-text').fill('测试失败路径。');
  await page.locator('.voice-field select').nth(1).selectOption('zh');  // 跳过翻译
  await page.getByRole('button', { name: '生成 AI 声线' }).click();

  await expect(page.locator('.voice-status')).toContainText('GPT-SoVITS 生成失败');
  await expect(page.locator('.voice-status')).toContainText('reference audio missing');
  await expect(page.locator('.voice-audio')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 聊天
// ─────────────────────────────────────────────────────────────────────────────
test('flow 3 · 聊天：流式回复逐字到达，system prompt 由网关注入', async ({ page, request }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/chat');
  await useLocalChat(page);

  // 关掉实时配音：这条用例只测聊天流
  await toggle(page, page.getByRole('checkbox', { name: /实时配音/ }), false);
  await expect(page.locator('.model-select')).toBeEnabled();
  await expect(page.locator('.character-status')).toContainText('本地聊天模型已连接');

  await page.locator('.chat-input').fill('今天有点累');
  await page.locator('.send-btn').click();

  await expect(page.locator('.message.user .message-bubble')).toHaveText('今天有点累');
  await expect(page.locator('.message.assistant .message-bubble')).toContainText('今天也辛苦了', { timeout: 15_000 });
  await expect(page.locator('.message.assistant.streaming')).toHaveCount(0, { timeout: 15_000 });

  const chatCalls = await callsTo(request, MOCK.ollama, '/api/chat');
  expect(chatCalls).toHaveLength(1);
  const messages = chatCalls[0].body?.messages as Array<{ role: string; content: string }>;
  // 角色人格由服务端注入，前端只送 user/assistant
  expect(messages[0].role).toBe('system');
  expect(messages[0].content).toContain('绫地宁宁');
  expect(messages[messages.length - 1]).toEqual({ role: 'user', content: '今天有点累' });
  expect(chatCalls[0].body?.stream).toBe(true);

  // 刷新后记忆仍在（localStorage 持久化）
  await page.reload();
  await expect(page.locator('.message.user .message-bubble')).toHaveText('今天有点累');

  expect(errors).toEqual([]);
});

test('flow 3b · 聊天配音：开启实时配音后逐句走翻译 + TTS', async ({ page, request }) => {
  await page.goto('/chat');
  await useLocalChat(page);
  await toggle(page, page.getByRole('checkbox', { name: /实时配音/ }), true);
  await expect(page.locator('.voice-capability')).toHaveAttribute('data-state', 'ready');

  await page.locator('.chat-input').fill('陪我说说话');
  await page.locator('.send-btn').click();
  await expect(page.locator('.message.assistant .message-bubble')).toContainText('今天也辛苦了', { timeout: 15_000 });

  // mock 回复有三句 → 至少两句应各自触发一次翻译与合成
  await expect.poll(async () => (await callsTo(request, MOCK.tts, '/tts')).length,
    { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  expect((await callsTo(request, MOCK.translate, '/translate')).length).toBeGreaterThanOrEqual(2);

  const ttsCalls = await callsTo(request, MOCK.tts, '/tts');
  // 聊天配音必须走日语（翻译成功时），并且带上锁定的参考情绪
  expect(ttsCalls[0].body?.text_lang).toBe('ja');
  expect(String(ttsCalls[0].body?.text)).toContain('[JA]');
});

test('flow 3c · 聊天配音：舞台提示保留显示但不进入朗读', async ({ page, request }) => {
  await fault(request, MOCK.ollama, { reply: '（稍微有点慌乱）诶、和我一起看吗……' });
  await page.goto('/chat');
  await useLocalChat(page);
  await toggle(page, page.getByRole('checkbox', { name: /实时配音/ }), true);
  await expect(page.locator('.voice-capability')).toHaveAttribute('data-state', 'ready');

  await page.locator('.chat-input').fill('一起看恐怖片吗？');
  await page.locator('.send-btn').click();
  await expect(page.locator('.message.assistant .message-bubble')).toContainText('稍微有点慌乱', { timeout: 15_000 });
  await expect.poll(async () => (await callsTo(request, MOCK.tts, '/tts')).length,
    { timeout: 20_000 }).toBeGreaterThanOrEqual(1);

  const translationCalls = await callsTo(request, MOCK.translate, '/translate');
  const ttsCalls = await callsTo(request, MOCK.tts, '/tts');
  expect(String(translationCalls[0].body?.text)).toBe('诶、和我一起看吗……');
  expect(String(ttsCalls[0].body?.text)).not.toContain('稍微有点慌乱');
});

test('flow 3d · 聊天中断：停止后已生成的片段保留并标记', async ({ page, request }) => {
  // 拉长上游延迟，好在流中途按停止
  await fault(request, MOCK.ollama, { latency: 400 });
  await page.goto('/chat');
  await useLocalChat(page);
  await toggle(page, page.getByRole('checkbox', { name: /实时配音/ }), false);
  await expect(page.locator('.model-select')).toBeEnabled();

  await page.locator('.chat-input').fill('讲个长故事');
  await page.locator('.send-btn').click();
  await expect(page.locator('.message.assistant')).toBeVisible();
  await page.locator('.stop-btn').click();

  await expect(page.locator('.chat-error')).toContainText('已停止本次回复');
  await expect(page.locator('.message.assistant.streaming')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 备份 / 恢复
// ─────────────────────────────────────────────────────────────────────────────
test('flow 4 · 备份：导出含图片的备份 → 覆盖恢复回同一份历史', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/prompt-builder?scene=sc001');
  await expect(page.locator('.api-status .badge')).toHaveText(/SD 已连接/);

  // 先造一条真实历史（出图 + 保存快照），这样备份里才有 IndexedDB 图片
  await page.getByRole('button', { name: '生成图片' }).click();
  await expect(page.locator('.result-image')).toBeVisible();
  await page.getByRole('button', { name: '保存快照' }).click();
  await expect(page.locator('.history-item')).toHaveCount(1);

  // 导出
  await page.locator('.utility-trigger').click();
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /导出备份/ }).click(),
  ]).then(([dl]) => dl);
  expect(download.suggestedFilename()).toMatch(/^aics-backup-.*\.json$/);
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  const backupJson = JSON.parse(readFileSync(backupPath!, 'utf8'));
  expect(backupJson.app).toBe('ai-cg-studio');
  expect(backupJson.data.history).toHaveLength(1);
  expect(backupJson.images).toHaveLength(1);
  expect(String(backupJson.images[0].dataUrl)).toMatch(/^data:image\//);

  // 清空本地，再从备份恢复
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('aics_kv_store', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete('aics_pb_history');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  // 场景模式会隐藏高级历史面板；这里验证数据已清空，不把可见性误当成存储契约。
  await expect(page.locator('.history-empty')).toHaveCount(1);

  await page.locator('.utility-trigger').click();
  await page.locator('.utility-actions input[type="file"]').setInputFiles(backupPath!);

  // 恢复弹层必须报出真实条数，且是带焦点陷阱的对话框
  const card = page.locator('.pb-backup-card');
  await expect(card).toHaveAttribute('aria-modal', 'true');
  await expect(card.locator('.pb-backup-summary')).toContainText('1 条历史');
  await expect(card.locator('.pb-backup-summary')).toContainText('1 张图片');

  page.once('dialog', dialog => dialog.accept());
  await card.getByRole('button', { name: '覆盖本地' }).click();

  // restore() 会 reload；恢复后历史回来了
  await expect(page.locator('.history-item')).toHaveCount(1, { timeout: 15_000 });

  expect(errors).toEqual([]);
});

test('flow 4b · 备份：损坏文件不得污染本地数据', async ({ page }) => {
  await page.goto('/prompt-builder');
  await page.locator('.utility-trigger').click();
  await page.locator('.utility-actions input[type="file"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"ai-cg-studio","data":{}}'),
  });
  await expect(page.locator('.pb-toast')).toContainText('备份文件里没有可恢复的数据');
  await expect(page.locator('.pb-backup-card')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. 场景保存
// ─────────────────────────────────────────────────────────────────────────────
test('flow 5 · 场景保存：编辑 → 脏态 → POST 全量场景 + 标签 + 策展', async ({ page }) => {
  const errors = collectRuntimeErrors(page);

  /**
   * POST /api/maintenance/scenes 会真的写回 data/scenes/*.json 并跑三个校验脚本。
   * E2E 不该改仓库内容，所以这里拦在网络层，断言送出的载荷 —— 服务端的写盘 /
   * 回滚逻辑由 scripts/tests/test-maintenance.js 覆盖。
   */
  let saved: any = null;
  await page.route('**/api/maintenance/scenes', async route => {
    saved = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, count: saved.scenes.length, backup: '2026-07-28-content' }),
    });
  });

  await page.goto('/scene-manager');
  await expect(page.locator('table tbody tr').first()).toBeVisible();

  const saveButton = page.getByRole('button', { name: /保存到项目/ });
  await expect(saveButton).toBeDisabled();

  // 改一个已有场景的标题
  await page.locator('table tbody tr').first().getByRole('button', { name: '编辑' }).click();
  const modal = page.locator('.modal-card');
  await expect(modal).toBeVisible();
  const sceneId = await modal.locator('input').first().inputValue();
  await modal.locator('.form-group', { hasText: '标题' }).locator('input').fill('E2E 改过的标题');
  await modal.getByRole('button', { name: '保存' }).click();
  await expect(modal).toBeHidden();

  await expect(page.locator('.maintenance-state')).toHaveClass(/dirty/);
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect(page.locator('.maintenance-state')).not.toHaveClass(/dirty/);
  await expect(page.locator('.maintenance-state')).toContainText('备份编号 2026-07-28-content');

  // 载荷：全量场景 + 标签 + 策展，一起送
  expect(Array.isArray(saved.scenes)).toBeTruthy();
  expect(saved.scenes.length).toBeGreaterThan(200);
  expect(Array.isArray(saved.tags)).toBeTruthy();
  expect(saved.curation).toBeTruthy();
  const edited = saved.scenes.find((s: any) => s.id === sceneId);
  expect(edited.title).toBe('E2E 改过的标题');

  expect(errors).toEqual([]);
});

test('flow 5b · 场景保存失败：错误如实回显，脏态保留', async ({ page }) => {
  await page.route('**/api/maintenance/scenes', route => route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: 'sc001 标记为招牌场景时必须填写推荐理由', rolledBack: true }),
  }));

  await page.goto('/scene-manager');
  await expect(page.locator('table tbody tr').first()).toBeVisible();
  await page.locator('table tbody tr').first().getByRole('button', { name: '编辑' }).click();
  await page.locator('.modal-card .form-group', { hasText: '标题' }).locator('input').fill('会被拒绝的标题');
  await page.locator('.modal-card').getByRole('button', { name: '保存' }).click();

  await page.getByRole('button', { name: /保存到项目/ }).click();
  await expect(page.locator('.maintenance-state')).toContainText('推荐理由');
  // 保存失败后必须仍是脏态，否则用户会以为已经存上了
  await expect(page.locator('.maintenance-state')).toHaveClass(/dirty/);
  await expect(page.getByRole('button', { name: /保存到项目/ })).toBeEnabled();
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 深链
// ─────────────────────────────────────────────────────────────────────────────
test('flow 6 · 深链：?scene 决定角色，?mood 与场景推断共存', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  // sc005 是夏目场景。同时给 ?char=nene 是故意的：场景自带的角色必须赢 ——
  // 否则会出现「夏目的场景配宁宁的 LoRA」这种串位成片。
  await page.goto('/prompt-builder?scene=sc005&char=nene&mood=warmth');

  await expect(page.locator('.pb')).toHaveAttribute('data-character', 'natsume');
  await expect(page.locator('.char-btn.active')).toContainText('夏目');
  await expect(page.locator('.scene-context-title')).not.toHaveText('');
  await expect(page.locator('.mood-card.active')).toHaveCount(1);
  await expect(page.locator('.preview-output')).toContainText('lora');
  // 场景推断出的镜头/光照/构图至少落一项，否则"智能预填"等于没接
  await expect(page.locator('.col-right .option.selected')).not.toHaveCount(0);

  expect(errors).toEqual([]);
});

test('flow 6b · 深链：无场景时 ?char 生效', async ({ page }) => {
  await page.goto('/prompt-builder?char=natsume');
  await expect(page.locator('.pb')).toHaveAttribute('data-character', 'natsume');
  await expect(page.locator('.char-btn.active')).toContainText('夏目');
  // 声线随角色联动
  await expect(page.locator('.voice-field select').first()).toHaveValue('natsume');
});

test('flow 6c · 深链：?resume=1 恢复上次草稿', async ({ page }) => {
  // 先留下一份草稿
  await page.goto('/prompt-builder');
  await page.locator('.story-input').fill('雪天围围巾的温柔一瞬');
  await page.locator('.trait-chip').first().click();
  // 等草稿保存包含 manualTags（saveDraft 有 280ms debounce，仅检查 non-null 会命中
  // 早于 trait-chip 点击的草稿快照，导致恢复后缺少 tag）
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('aics_pb_last_draft')
    if (!raw) return null
    try { const d = JSON.parse(raw); return Array.isArray(d.manualTags) && d.manualTags.length > 0 ? 'ok' : null } catch { return null }
  })).toBe('ok');

  await page.goto('/prompt-builder?resume=1');
  await expect(page.locator('.story-input')).toHaveValue('雪天围围巾的温柔一瞬');
  await expect(page.locator('.manual-tag')).toHaveCount(1);
});

test('flow 6d · 深链：?regen=<id> 复原历史参数与 seed', async ({ page }) => {
  await page.goto('/prompt-builder?scene=sc001');
  await expect(page.locator('.api-status .badge')).toHaveText(/SD 已连接/);
  await openGenerationSettings(page);
  await toggle(page, '.ctrl-seed input[type="checkbox"]', true);
  await page.locator('.ctrl-seed input[type="number"]').fill('777');
  await page.getByRole('button', { name: '生成图片' }).click();
  await expect(page.locator('.result-image')).toBeVisible();
  await page.getByRole('button', { name: '保存快照' }).click();
  await expect(page.locator('.history-item')).toHaveCount(1);

  const entryId = await page.evaluate(async () => {
    const value = await new Promise<any>((resolve, reject) => {
      const request = indexedDB.open('aics_kv_store', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('kv', 'readonly');
        const get = tx.objectStore('kv').get('aics_pb_history');
        get.onsuccess = () => { resolve(get.result?.value ?? []); db.close(); };
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    });
    return value[0]?.id as number;
  });
  expect(entryId).toBeTruthy();

  await page.goto(`/prompt-builder?regen=${entryId}`);
  await openGenerationSettings(page);
  await expect(page.locator('.ctrl-seed input[type="number"]')).toHaveValue('777');
  await expect(page.locator('.ctrl-seed input[type="checkbox"]')).toBeChecked();
  await expect(page.locator('.scene-context-title')).not.toHaveText('');
});

test('flow 6e · 深链：未知场景 id 不得让导演台崩在半途', async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto('/prompt-builder?scene=sc999&mood=not-a-mood');

  // 无效参数应被忽略，页面保持可用
  await expect(page.locator('.story-input')).toBeVisible();
  await expect(page.locator('.scene-list button.scene-card').first()).toBeVisible();
  await expect(page.locator('.scene-context-title')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('flow 6f · 快速出图：复用最近成功参数并自动提交一次生成', async ({ page, request }) => {
  const errors = collectRuntimeErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem('aics_sd_last_success_v1', JSON.stringify({
      version: 1,
      savedAt: 1,
      checkpoint: 'waiNSFWIllustrious_v140.safetensors [abc123]',
      sampler: 'Euler a',
      scheduler: 'Karras',
      cfg: 6,
      steps: 22,
      size: '896×1152',
      hiresFix: false,
      hiresUpscaler: 'Latent',
      hiresScale: 1.5,
    }));
  });

  await page.goto('/prompt-builder?scene=sc001&quick=1');
  await expect(page.locator('.result-image')).toBeVisible();
  const generated = await callsTo(request, MOCK.sd, '/sdapi/v1/txt2img');
  expect(generated).toHaveLength(1);
  expect(generated[0].body).toMatchObject({
    width: 896,
    height: 1152,
    sampler_name: 'Euler a',
    scheduler: 'Karras',
    cfg_scale: 6,
    steps: 22,
  });
  const savedAt = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('aics_sd_last_success_v1') || '{}');
    return Number(saved.savedAt);
  });
  expect(savedAt).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});
