const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const compiler = require('../../src/utils/promptCompiler.ts');
const policy = require('../../src/utils/promptPolicy.ts');
const animaRoute = require('../../routes/anima.js');
const presets = require('../../data/presets.json');
const loras = require('../../data/loras.json');

test('prompt compiler keeps story and search metadata outside all model families', () => {
  const input = {
    story: '这是故事，不可见的心理活动，以及“台词”',
    identity: '1girl, ayachi_nene, white_hair',
    controls: ['natsume_r18', 'natsume_cafe_uniform'],
    scenePrompt: 'warm_lighting, cafe interior',
    visualDescription: 'Nene stands beside a rain-covered cafe window.',
    manual: [],
  };
  const anima = compiler.renderPromptPlan(compiler.createPromptPlan(input), 'anima');
  const krea = compiler.renderPromptPlan(compiler.createPromptPlan(input), 'krea2');
  const sd = compiler.renderPromptPlan(compiler.createPromptPlan(input), 'sd');
  for (const value of [anima.prompt, anima.negative, krea.prompt, krea.negative, sd.prompt, sd.negative]) {
    assert(!value.includes('official_cg'), 'scene search metadata must not be compiled');
    assert(!value.includes('visual_audited'), 'audit metadata must not be compiled');
    assert(!value.includes('这是故事'), 'story must never be compiled');
    assert(!value.includes('台词'), 'dialogue must never be compiled');
  }
  assert(anima.prompt.includes('natsume_r18'));
  assert(anima.prompt.includes('natsume_cafe_uniform'));
  assert(anima.prompt.includes('warm lighting'));
  assert(!anima.prompt.includes('<lora:'));
  assert(!anima.prompt.includes('A visual novel event CG'), 'anima prose tail must not use meta phrases');
  assert(!krea.prompt.includes('masterpiece'));
  assert(!krea.prompt.includes('score_'));
  assert(!krea.prompt.includes('Identity is not guaranteed'));
  assert(!krea.prompt.includes('natsume_r18'));
  assert(!krea.prompt.includes('natsume_cafe_uniform'));
  assert(!krea.prompt.includes(':1.4'));
  assert.strictEqual(krea.negative, '');
  // Krea 官方散文段结构：无 meta 标签、无逗号标签堆砌、散文段原样织入。
  for (const value of [krea.prompt, anima.prompt]) {
    assert(!/(?:In this image|The image shows|Scene details:|Composition and lighting|A visual novel event CG featuring)/i.test(value), 'must not leak meta phrases');
  }
  assert(!/[a-z]+_[a-z]+/i.test(krea.prompt), 'krea prose must not carry raw danbooru tokens');
  assert(krea.prompt.includes('Nene stands beside a rain-covered cafe window.'), 'krea must weave visualDescription prose verbatim');
  assert(/warm lighting, cafe interior\./i.test(krea.prompt), 'krea must weave scene fragments as readable prose');
  assert.strictEqual(policy.formatPromptForEngine('natsume_r18, natsume_cafe_uniform, warm_lighting', 'anima'), 'natsume_r18, natsume_cafe_uniform, warm lighting');
  assert.strictEqual(policy.formatPromptForEngine('nene_school_uniform, natsume_cafe_uniform', 'anima', [], ['nene_', 'natsume_']), 'nene_school_uniform, natsume_cafe_uniform');
});

test('prompt compiler: Krea style recipe lead goes first and medium closes the paragraph', () => {
  const input = {
    identity: 'a girl with long hair',
    scenePrompt: 'a quiet cafe interior',
    visualDescription: 'she wears a navy dress',
    style: ['A polished visual novel event CG with refined cel shading'],
    medium: 'visual novel event CG',
  };
  const krea = compiler.renderPromptPlan(compiler.createPromptPlan(input), 'krea2');
  assert(krea.prompt.startsWith('A polished visual novel event CG with refined cel shading.'),
    'style language must come first');
  assert(/visual novel event CG\.$/i.test(krea.prompt), 'medium must close the paragraph');
  assert(!/[a-z]+_[a-z]+/i.test(krea.prompt), 'no raw tokens even with style phrases');
});

test('creative catalog rejects Krea LoRA/negative and emits the official Krea core workflow', () => {
  const input = animaRoute.validateInput({ prompt: 'A rainy cafe scene.', modelId: 'krea2-turbo-fp8', width: 1024, height: 1024, seed: 7 });
  assert.strictEqual(input.family, 'krea2');
  assert.strictEqual(input.steps, 8);
  assert.strictEqual(input.cfg, 1);
  for (const size of [[1024, 1536], [1536, 1024]]) {
    const sized = animaRoute.validateInput({ prompt: 'x', modelId: 'krea2-turbo-fp8', width: size[0], height: size[1] });
    assert.deepStrictEqual([sized.width, sized.height], size);
  }
  assert.throws(() => animaRoute.validateInput({ prompt: 'x', modelId: 'krea2-turbo-fp8', width: 1024, height: 1024, steps: 7 }), /steps/);
  assert.throws(() => animaRoute.validateInput({ prompt: 'x', modelId: 'krea2-turbo-fp8', width: 1024, height: 1024, cfg: 3 }), /CFG/);
  assert.throws(() => animaRoute.validateInput({ prompt: 'x', modelId: 'krea2-turbo-fp8', width: 1024, height: 1024, loraId: 'L_NENE_V20_ANIMA' }), /Krea/);
  assert.throws(() => animaRoute.validateInput({ prompt: 'x', negative: 'bad anatomy', modelId: 'krea2-turbo-fp8', width: 1024, height: 1024 }), /Krea/);
  const workflow = animaRoute.buildWorkflow(input);
  const classes = Object.values(workflow).map(node => node.class_type);
  assert.deepStrictEqual(classes, ['UNETLoader', 'CLIPLoader', 'VAELoader', 'CLIPTextEncode', 'ConditioningZeroOut', 'EmptyLatentImage', 'KSampler', 'VAEDecode', 'SaveImage', 'ConditioningKrea2Rebalance']);
  assert.strictEqual(workflow['2'].inputs.type, 'krea2');
  assert.strictEqual(workflow['7'].inputs.steps, 8);
  assert.strictEqual(workflow['7'].inputs.cfg, 1);
  assert.strictEqual(workflow['7'].inputs.sampler_name, 'euler');
  assert.strictEqual(workflow['7'].inputs.scheduler, 'simple');
  assert.deepStrictEqual(workflow['7'].inputs.negative, ['5', 0]);
});

test('Anima rating and controls remain aligned without safe/R18 contradiction', () => {
  const profile = { quality_prefix: 'best_quality', rating_all: 'safe', rating_r18: 'nsfw', exact_tokens: [], exact_prefixes: ['nene_'] };
  const safe = compiler.renderPromptPlan(compiler.createPromptPlan({ profile, identity: 'ayachi_nene', controls: ['nene_school_uniform'], rating: 'safe' }), 'anima', profile);
  const adult = compiler.renderPromptPlan(compiler.createPromptPlan({ profile, identity: 'ayachi_nene', controls: ['nene_r18'], rating: 'nsfw' }), 'anima', profile);
  assert(safe.prompt.includes('safe'));
  assert(safe.prompt.includes('nene_school_uniform'));
  assert(!safe.prompt.includes('nene_r18'));
  assert(adult.prompt.includes('nsfw'));
  assert(adult.prompt.includes('nene_r18'));
});

test('Anima profiles do not bind one character and LoRA contracts own exact controls', () => {
  const assemblySource = fs.readFileSync(path.join(__dirname, '../../src/composables/usePromptAssembly.ts'), 'utf8');
  assert(assemblySource.includes("const selectedLoraId = pb.char === 'triad' ? '' : controlLoraIds.value[pb.char]"));
  assert(!assemblySource.includes('Object.values(controlLoraIds.value)'));
  const animaProfiles = presets.model_profiles.filter(profile => profile.engine === 'anima');
  for (const profile of animaProfiles) {
    assert.strictEqual(profile.lora_id, undefined);
    assert.strictEqual(profile.lora_name, undefined);
    assert.strictEqual(profile.lora_strength, undefined);
    assert.deepStrictEqual(profile.exact_tokens, ['best_quality']);
  }
  const nene = loras.find(lora => lora.id === 'L_NENE_V20_ANIMA');
  const natsume = loras.find(lora => lora.id === 'L_NAT_V19_ANIMA_PREVIEW');
  assert(nene.prompt_contract.exact_prefixes.includes('nene_'));
  assert(natsume.prompt_contract.exact_prefixes.includes('natsume_'));
  assert(!nene.prompt_contract.exact_prefixes.includes('natsume_'));
  assert(!natsume.prompt_contract.exact_prefixes.includes('nene_'));
});
