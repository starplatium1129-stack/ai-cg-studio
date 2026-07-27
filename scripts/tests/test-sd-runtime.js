const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function source(path) {
  return fs.readFileSync(path, 'utf8');
}

function select(initial) {
  const element = {
    options: [],
    value: '',
    appendChild(option) {
      this.options.push(option);
      if (!this.value) this.value = option.value;
    }
  };
  Object.defineProperty(element, 'textContent', {
    set() {
      element.options.length = 0;
      element.value = '';
    }
  });
  (initial || []).forEach(value => element.appendChild({ value, textContent: value }));
  return element;
}

async function testExplicitEmptyNegative() {
  let payload;
  const context = { console, setTimeout, clearTimeout, AbortController };
  context.window = context;
  vm.runInNewContext(source('tools/sd-api.js'), context);
  const connector = new context.SDWebUIConnector('');
  connector.request = (_path, init) => {
    payload = JSON.parse(init.body);
    return Promise.resolve({ images: ['abc'], info: '{}' });
  };

  await connector.generateImage('prompt', '', {});
  assert.strictEqual(payload.negative_prompt, '', 'explicit empty negative prompt must stay empty');
  await connector.generateImage('prompt', undefined, {});
  assert(payload.negative_prompt.includes('worst quality'), 'omitted negative prompt should use defaults');
}

async function testDualEnhancementPayload() {
  let payload;
  const context = { console, setTimeout, clearTimeout, AbortController, Promise };
  context.window = context;
  vm.runInNewContext(source('tools/sd-api.js'), context);
  const connector = new context.SDWebUIConnector('');
  connector.request = (_path, init) => {
    payload = JSON.parse(init.body);
    return Promise.resolve({ images: ['abc'], info: '{}' });
  };

  const result = await connector.generateImage(
    'masterpiece, 2girls, candlelit bedroom, (ayachi_nene, white_hair, purple_eyes) BREAK (shiki_natsume, black_hair, yellow_eyes)',
    'bad anatomy',
    {
      char:'triad',
      lora:'ayachi_nene_v15:0.55, shiki_natsume_v15:0.55',
      dualEnhancement:{
        regional:true,
        generationMode:'Attention',
        controlModel:'xinsir_openpose_sdxl_1.0 [d0333a45]',
        controlImage:'data:image/png;base64,cG9zZQ==',
        adetailer:true,
        adModel:'face_yolov8s.pt'
      }
    }
  );

  assert(payload.prompt.split(/\bBREAK\b/).length === 3, 'dual regional prompt must contain base, left, and right scopes');
  assert(payload.prompt.indexOf('<lora:ayachi_nene_v15:0.55>') < payload.prompt.indexOf('BREAK'), 'dual LoRAs must live in the shared base scope in Attention mode');
  assert(payload.alwayson_scripts['Regional Prompter'], 'Regional Prompter payload must be enabled');
  assert.strictEqual(payload.alwayson_scripts['Regional Prompter'].args[11], 'Attention');
  assert(payload.alwayson_scripts.ControlNet, 'ControlNet payload must be enabled when a pose exists');
  assert.strictEqual(payload.alwayson_scripts.ControlNet.args[0].resize_mode, 'Resize and Fill');
  assert.strictEqual(payload.alwayson_scripts.ControlNet.args[0].image, 'cG9zZQ==');
  assert(payload.alwayson_scripts.ADetailer, 'ADetailer payload must be enabled for distant dual faces');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(result.enhancements)),
    { regional:true, controlNet:true, adetailer:true }
  );

  payload = null;
  const single = await connector.generateImage('1girl, ayachi_nene, close_up', '', {
    char:'nene',
    lora:'ayachi_nene_v15:0.85',
    dualEnhancement:{ regional:true, controlImage:'data:image/png;base64,cG9zZQ==' }
  });
  assert(!payload.alwayson_scripts, 'single-character generation must remain extension-free');
  assert.strictEqual(single.enhancements.regional, false);
}

// ── 模型 profile 与能力协商（迁移到 src/utils/promptPolicy.ts） ──────────
function testProfilesAndCapabilities() {
  const policy = require('../../src/utils/promptPolicy.ts');
  const profiles = [
    {
      id: 'actual', name: 'Actual', match: ['actualModel'],
      quality_prefix: 'quality',
      negative_prefix: 'model-neg',
      negative_mode: 'replace',
      negative_replace_scope: 'boilerplate',
      rating_all: 'safe', rating_r18: 'nsfw',
      hires_steps: 12, hires_scale: 1.5, hires_upscaler: 'Latent'
    },
    { id: 'stale', name: 'Stale', match: ['staleModel'], quality_prefix: 'stale-quality' }
  ];

  const actual = policy.resolveModelProfile(profiles, 'actualModel');
  assert.strictEqual(actual.id, 'actual', 'checkpoint must resolve to its own profile');

  assert.strictEqual(policy.qualityPrefix(actual, { rating: 'All' }), 'quality, safe');
  assert.strictEqual(policy.qualityPrefix(actual, { rating: 'R15' }), 'quality', 'R15 must not inherit safe');
  assert.strictEqual(policy.qualityPrefix(actual, { rating: 'R18' }), 'quality, nsfw');

  assert.strictEqual(
    policy.modelNegativePrompt(actual, 'bad anatomy, crowd, daylight'),
    'model-neg, crowd, daylight',
    'replace mode must only replace boilerplate and preserve scene semantics'
  );

  // 站内 LoRA 基于 WAI/Illustrious 训练：未识别的 checkpoint 回退首个 profile，
  // 而不是退回与项目无关的通用 SDXL 词组。
  const unknown = policy.resolveModelProfile(profiles, 'mysteryModel');
  assert.strictEqual(unknown.id, 'actual', 'unknown checkpoints must fall back to the primary profile');
  assert.strictEqual(
    policy.qualityPrefix(null, { rating: 'All' }),
    'masterpiece, best_quality, very_aesthetic, absurdres',
    'with no profile at all the generic anime prefix is used'
  );
  assert.strictEqual(
    policy.modelNegativePrompt(null, 'scene-neg'),
    'scene-neg',
    'with no profile the custom negative prompt must be preserved'
  );

  // framing 决定 LoRA 权重
  const loraMeta = [{
    name: 'ayachi_nene_v15',
    strength: { default: 0.8 },
    recommended_weight: { portrait: 0.85, fullbody: 0.75, complex_scene: 0.7 }
  }];
  const closeUp = policy.resolveLoraSpecs('nene', null, loraMeta, { nene: 'ayachi_nene_v15' }, { shot: 'close' });
  const wide = policy.resolveLoraSpecs('nene', null, loraMeta, { nene: 'ayachi_nene_v15' }, { shot: 'wide' });
  assert.strictEqual(closeUp[0].weight, 0.85, 'close-up must use the portrait weight');
  assert.strictEqual(wide[0].weight, 0.75, 'wide shot must use the fullbody weight');
  const dual = policy.resolveLoraSpecs(
    'triad', null, loraMeta, { triad: 'ayachi_nene_v15, shiki_natsume_v15' }, {}
  );
  assert(dual.every(spec => spec.weight === 0.62), 'dual scenes must lower both LoRA weights');

  // framing 冲突消解
  assert(
    !policy.filterFraming('close_up, full_body, smile', 'close').includes('full_body'),
    'close-up framing must drop conflicting wide tokens'
  );

  // Danbooru 规范化
  assert.strictEqual(policy.norm('golden hour, window light'), 'golden_hour, window_light');
}

// ── 队列失败保留（迁移到 src/composables/useSDQueue.ts） ─────────────────
async function testFailedQueueJobIsRetained() {
  const flashes = [];
  const { useSDQueue } = require('../../src/composables/useSDQueue.ts');
  const queue = useSDQueue({
    run: () => Promise.resolve({ status: 'failure' }),
    onFlash: message => flashes.push(message),
    isBusy: () => false
  });

  queue.enqueue({ title: 'one', prompt: 'p', negative: '', size: '832x1216', seed: -1 });
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.strictEqual(queue.paused.value, true, 'a failed job must pause the queue');
  assert.strictEqual(queue.queue.value.length, 1, 'the failed job must be retained');
  assert.strictEqual(queue.queue.value[0].title, 'one');
  assert.strictEqual(queue.activeJob.value, null);
  assert(flashes.some(message => message.includes('已保留')), 'user must be told the job was kept');

  // 上限保护：忙碌时连续入队不得超过上限
  const full = useSDQueue({
    run: () => new Promise(() => {}),
    onFlash: message => flashes.push(message),
    isBusy: () => true
  });
  for (let i = 0; i < 10; i += 1) {
    full.enqueue({ title: 'j' + i, prompt: 'p', negative: '', size: '832x1216', seed: -1 });
  }
  assert(full.total.value <= 8, 'queue must not exceed its limit');
}

(async () => {
  await testExplicitEmptyNegative();
  await testDualEnhancementPayload();
  testProfilesAndCapabilities();
  await testFailedQueueJobIsRetained();
  console.log('SD runtime tests passed: negative toggle, dual enhancement payload, profile resolution, LoRA framing weights, and queue retention');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
