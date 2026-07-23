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
      lora:'ayachi_nene_v14:0.55, shiki_natsume_v14:0.55',
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
  assert(payload.prompt.indexOf('<lora:ayachi_nene_v14:0.55>') < payload.prompt.indexOf('BREAK'), 'dual LoRAs must live in the shared base scope in Attention mode');
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
    lora:'ayachi_nene_v14:0.85',
    dualEnhancement:{ regional:true, controlImage:'data:image/png;base64,cG9zZQ==' }
  });
  assert(!payload.alwayson_scripts, 'single-character generation must remain extension-free');
  assert.strictEqual(single.enhancements.regional, false);
}

function testProfilesAndCapabilities() {
  const elements = {
    sdModel: select(['staleModel']),
    sampler: select(['Euler a']),
    scheduler: select(['', 'Karras']),
    sdHiresUpscaler: select(['Latent'])
  };
  elements.sdModel.value = 'staleModel';
  const context = {
    console,
    Promise,
    Number,
    Array,
    String,
    Date,
    MODEL_PROFILES: [
      {
        id: 'actual',
        name: 'Actual',
        match: ['actualModel'],
        quality_prefix: 'quality',
        negative_prefix: 'model-neg',
        negative_mode: 'replace',
        rating_safe: 'safe',
        rating_mature: 'nsfw',
        hires: { steps: 12, scale: 1.5, upscaler: 'Latent' }
      },
      { id: 'stale', name: 'Stale', match: ['staleModel'], quality_prefix: 'stale-quality' }
    ],
    ACTIVE_MODEL_PROFILE: null,
    AICPromptPolicy: require('../tools/prompt-policy'),
    document: {
      getElementById: id => elements[id] || null,
      createElement: () => ({ value: '', textContent: '' })
    },
    localStorage: { getItem: () => '{}', setItem() {} },
    mergeTokenText: (a, b) => [a, b].filter(Boolean).join(', '),
    updateLivePreview() {},
    flash() {}
  };
  vm.createContext(context);
  vm.runInContext(source('tools/prompt-builder/sd.js'), context);
  context._sdCapabilities = {
    currentModel: 'actualModel',
    models: [{ title: 'actualModel' }],
    samplers: [{ name: 'Euler a' }, { name: 'Euler a Karras' }],
    schedulers: [],
    upscalers: [{ name: 'Latent' }]
  };
  context.populateSDCapabilities(context._sdCapabilities);

  assert.strictEqual(context.ACTIVE_MODEL_PROFILE.id, 'actual', 'stale model must not retain its profile');
  assert.strictEqual(context.currentQualityPrefix({ rating: 'All' }), 'quality, safe');
  assert.strictEqual(context.currentQualityPrefix({ rating: 'R15' }), 'quality', 'R15 must not inherit safe');
  assert.strictEqual(context.currentQualityPrefix({ rating: 'R18' }), 'quality, nsfw');
  assert.strictEqual(
    context.currentModelNegativePrefix({ rating: 'All' }, 'bad anatomy, crowd, daylight'),
    'model-neg, crowd, daylight',
    'replace mode must only replace boilerplate and preserve scene semantics'
  );
  elements.sdModel.value = 'mysteryModel';
  assert.strictEqual(
    context.currentQualityPrefix({ rating: 'All' }),
    'masterpiece, best_quality, very_aesthetic, absurdres',
    'an explicitly unknown model must not inherit the stale active profile'
  );
  assert.strictEqual(
    context.currentModelNegativePrefix({ rating: 'All' }, 'scene-neg'),
    'scene-neg',
    'an explicitly unknown model must preserve the custom negative prompt'
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(context.currentHiresProfileSettings('mysteryModel'))),
    { steps: null, denoisingStrength: null, scale: null, upscaler: '' },
    'an explicitly unknown model must not inherit profile-specific hires settings'
  );
  elements.sdModel.value = 'actualModel';
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(context.resolveSDSamplingSelection('Euler a', 'Karras'))),
    { sampler: 'Euler a Karras', scheduler: '' }
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(context.resolveSDSamplingSelection('Euler a', 'Unknown'))),
    { sampler: 'Euler a', scheduler: '' },
    'unsupported schedulers must not be manufactured into sampler names'
  );
}

async function testFailedQueueJobIsRetained() {
  const flashes = [];
  const context = {
    console,
    Promise,
    Math,
    Date,
    document: { getElementById: () => null },
    escapeHtml: String,
    flash: message => flashes.push(message),
    callSDGenerate: () => Promise.resolve({ status: 'failure' }),
    _sdGeneration: null
  };
  vm.createContext(context);
  vm.runInContext(source('tools/prompt-builder/queue.js'), context);
  context._sdQueue = [{ id: 'one', title: 'one' }];
  context.processSDQueue();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.strictEqual(context._sdQueuePaused, true);
  assert.strictEqual(context._sdQueue.length, 1);
  assert.strictEqual(context._sdQueue[0].id, 'one');
  assert.strictEqual(context._sdActiveQueueJob, null);
  assert(flashes.some(message => message.includes('已保留')));
}

(async () => {
  await testExplicitEmptyNegative();
  await testDualEnhancementPayload();
  testProfilesAndCapabilities();
  await testFailedQueueJobIsRetained();
  console.log('SD runtime tests passed: negative toggle, profile refresh, capabilities, and queue retention');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
