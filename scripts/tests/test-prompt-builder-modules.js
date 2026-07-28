'use strict';

const assert = require('assert');

/**
 * 导演台模块布局契约（Vue SPA 版本）
 *
 * 重构前断言 tools/prompt-builder.html 的脚本加载顺序与 12 个全局模块。
 * 现在导演台是 src/views/PromptBuilderView.vue + store/composable/util，
 * 保障目标改为「关键能力各有归属且真正接线」：
 *   1. 提示词管线：质量前缀 / 负面策略 / LoRA 权重 / framing / 标签规范化
 *   2. 出图：队列、错误分类恢复、seed 锁定
 *   3. 数据：草稿持久化、历史落盘、备份恢复
 *   4. 场景推断与配音接线
 *   5. 设计系统与导演台样式仍提供共享 chrome
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const exists = (...parts) => fs.existsSync(path.join(root, ...parts));
const persistence = require('../../src/utils/promptBuilderPersistence.ts');

function fail(message) {
  throw new Error('[prompt-builder modules] ' + message);
}

// ── 1. 模块必须各有归属文件 ──────────────────────────────────────────────
const modules = [
  ['src/stores/promptBuilderStore.ts', ['saveDraft', 'restoreDraft', 'commitHistoryEntry', 'applyModelProfile', 'loadScene']],
  ['src/utils/promptPolicy.ts', ['qualityPrefix', 'modelNegativePrompt', 'resolveLoraSpecs', 'applyFraming', 'norm', 'analyzeParts', 'sceneTemplateText']],
  ['src/utils/promptBuilderPersistence.ts', ['parsePromptBuilderDraft', 'parseProjectOptions', 'parsePresetCatalog']],
  ['src/utils/sceneInference.ts', ['sceneLighting', 'sceneShot', 'sceneColorMood', 'sceneRecommendedSize']],
  ['src/utils/sdError.ts', ['classifySDError', 'SAFE_SAMPLING', 'LIGHT_LOAD']],
  ['src/utils/sdRequest.ts', ['buildTxt2ImgRequest', 'parseTxt2ImgResponse', 'DEFAULT_SD_NEGATIVE']],
  ['src/composables/useSDGenerate.ts', ['checkStatus', 'generate', 'cancel']],
  ['src/composables/useSDQueue.ts', ['useSDQueue', 'SD_QUEUE_LIMIT']],
  ['src/composables/usePromptAssembly.ts', ['usePromptAssembly', 'qualityPrefix', 'modelNegativePrompt', 'resolveLoraSpecs', 'applyFraming', 'analyzeParts']],
  ['src/composables/useBackup.ts', ['exportBackup', 'restore', 'healthCheck', 'cleanOrphanImages']],
  ['src/composables/useVoice.ts', ['startTurn', 'append', 'finishTurn']],
  ['src/composables/useImageStore.ts', ['imgPut', 'imgGet', 'imgDeleteMany']],
  ['src/composables/useKVStore.ts', ['kvGet', 'kvSet']],
   ['src/components/HistoryPanel.vue', ['history-wrap', 'imgGet']],
  ['src/components/VoiceStudio.vue', ['voice-studio', '/api/tts-status', '/api/translate', '/api/tts']],
  ['src/components/PromptDataTools.vue', ['useBackup', 'pb-backup-overlay', 'useFocusTrap']],
  ['src/components/PromptHealthPanel.vue', ['PromptReport', 'prompt-health-warnings', 'artViolations']],
  ['src/components/GenerationQueuePanel.vue', ['SDQueueJob', 'sd-queue-list', "emit('remove'"]],
  ['src/components/GenerationParamsPanel.vue', ['params: SDParams', "'reuse-seed'", 'samplerOptions']],
  ['src/components/GenerationOutputControls.vue', ['params: SDParams', 'generation-output-controls', 'queueAvailable']],
  ['src/components/SDRecoveryPanel.vue', ['SDErrorReport', "emit('recover'"]],
];

for (const [rel, markers] of modules) {
  if (!exists(rel)) fail('missing module file ' + rel);
  const source = read(rel);
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${rel} is missing its public entry point: ${marker}`);
  }
}

const parsedDraft = persistence.parsePromptBuilderDraft({
  updatedAt:'123',
  story:'雨夜',
  char:'invalid',
  selections:{ emotion:['shy', 7], shot:'close' },
  sdParams:{ cfg:'5.5', steps:'bad', hiresFix:true, injected:'no' },
});
assert(parsedDraft, 'valid draft must survive persistence parsing');
assert.strictEqual(parsedDraft.char, undefined, 'unknown character ids must not enter director state');
assert.deepStrictEqual(parsedDraft.selections.emotion, ['shy'], 'draft selections must keep only string ids');
assert.deepStrictEqual(parsedDraft.sdParams, { cfg:5.5, hiresFix:true }, 'draft SD params must whitelist known typed fields');
assert.strictEqual(
  persistence.parsePromptBuilderDraft({ updatedAt:1, story:'', sceneId:null }),
  null,
  'empty drafts must not replace current director state',
);
assert.deepStrictEqual(
  persistence.parseProjectOptions([{ id:7, title:'旧项目' }, null, { id:'' }]),
  [{ id:'7', name:'旧项目' }],
  'legacy project ids and titles must normalize at the persistence boundary',
);
const parsedCatalog = persistence.parsePresetCatalog({
  presets:[{ id:'balanced', name:'平衡' }, { name:'missing id' }],
  model_profiles:[{ id:'wai', match:['wai', 3], steps:'28', cfg:5.5 }, null],
});
assert.strictEqual(parsedCatalog.presets.length, 1, 'malformed presets must be ignored');
assert.deepStrictEqual(parsedCatalog.modelProfiles[0].match, ['wai'], 'profile match keys must be strings');
assert.strictEqual(parsedCatalog.modelProfiles[0].steps, 28, 'numeric profile fields must normalize');

const storeSource = read('src/stores/promptBuilderStore.ts');
if (/\bany\b/.test(storeSource)) fail('prompt builder store must keep scene, profile, draft, and project boundaries explicitly typed');

// ── 2. 导演台视图必须真正接线这些能力 ────────────────────────────────────
const view = read('src/views/PromptBuilderView.vue');
const promptAssembly = read('src/composables/usePromptAssembly.ts');
if (/\bany\b/.test(view)) fail('PromptBuilderView must keep deep links, scenes, and history explicitly typed');
if (/\bany\b/.test(promptAssembly)) fail('prompt assembly must keep its store and policy boundary explicitly typed');
if (/entry\.char\b/.test(view) || !view.includes('entry.character')) {
  fail('history deep links must restore the canonical character field');
}

const promptPipeline = [
  ['qualityPrefix', 'quality prefix must come from the model profile, not a hardcoded string'],
  ['modelNegativePrompt', 'negative prompt must apply the model profile merge/replace策略'],
  ['resolveLoraSpecs', 'LoRA weight must be resolved per framing'],
  ['applyFraming', 'framing conflicts must be resolved at composition time'],
  ['sceneTemplateText', 'scene templates must be sanitized before use'],
  ['analyzeParts', 'prompt structure health must be reported'],
];
for (const [marker, message] of promptPipeline) {
  if (!promptAssembly.includes(marker)) fail(message);
}
if (!view.includes('usePromptAssembly')) {
  fail('PromptBuilderView must consume the dedicated prompt assembly composable');
}
if (view.includes("from '@/utils/promptPolicy'")) {
  fail('prompt policy composition must stay owned by usePromptAssembly');
}

const wiring = [
  ['classifySDError', 'generation failures must be classified into recovery actions'],
  ['useSDQueue', 'director must support a serial generation queue'],
  ['PromptDataTools', 'director must mount the local data backup/restore component'],
  ['PromptHealthPanel', 'director must mount the collapsible prompt health component'],
  ['GenerationQueuePanel', 'director must mount the generation queue component'],
  ['GenerationParamsPanel', 'director must mount the dedicated generation parameter component'],
  ['GenerationOutputControls', 'director must mount the dedicated generation output controls'],
  ['SDRecoveryPanel', 'director must mount the classified SD recovery component'],
  ['commitHistoryEntry', 'generated art must be committed to IndexedDB-backed history'],
  ['applyModelProfile', 'SD params must follow the matched checkpoint profile'],
  ['HistoryPanel', 'director must render the artwork history panel'],
  ['VoiceStudio', 'director must mount the dedicated voice studio component'],
  ['reuseLastSeed', 'director must allow reusing the last seed'],
  ['runRecovery', 'director must offer one-click error recovery'],
];
for (const [marker, message] of wiring) {
  if (!view.includes(marker)) fail(message);
}

// 硬编码质量前缀是回归信号：必须走 profile
if (/parts\.unshift\(['"]masterpiece, best quality, highres['"]\)/.test(view)) {
  fail('quality prefix must not be hardcoded; use the model profile');
}

// 深链恢复
for (const param of ['scene', 'regen', 'variant', 'mood', 'resume', 'quick']) {
  if (!new RegExp(`q\\.${param}`).test(view)) fail('missing deep-link restoration for ?' + param);
}

// 配音工作室的 HTTP 接线归 VoiceStudio 所有；PromptBuilderView 只负责传入
// 当前角色/故事默认值，避免它再次变成第六个子系统的宿主。
const voiceStudio = read('src/components/VoiceStudio.vue');
for (const marker of ['/api/tts-status', '/api/translate', '/api/tts', 'voice-studio']) {
  if (!voiceStudio.includes(marker)) fail('voice studio must own: ' + marker);
}
for (const marker of ['initial-voice', 'suggested-caption']) {
  if (!view.includes(marker)) fail('director must wire voice studio prop: ' + marker);
}

// ── 3. 出图参数必须与底模 profile 一致，且支持 hires 细项 ────────────────
for (const marker of ['hr_second_pass_steps', 'denoising_strength', 'hiresSteps', 'hiresDenoise']) {
  if (!view.includes(marker)) fail('hires pipeline must expose ' + marker);
}
for (const marker of ['faceDetailer', 'face_yolov8s.pt', 'hand_yolov8n.pt', 'buildSingleDetailerScripts']) {
  if (!view.includes(marker)) fail('high-resolution detailer must retain ' + marker);
}

const sdGenerate = read('src/composables/useSDGenerate.ts');
if (!sdGenerate.includes('buildTxt2ImgRequest') || !sdGenerate.includes('parseTxt2ImgResponse')) {
  fail('SD composable must use the shared production request builder and response parser');
}
for (const marker of ['pollInFlight', 'pollFailures', 'void pollProgress(token)', '进度读取失败']) {
  if (!sdGenerate.includes(marker)) fail('SD progress polling must retain ' + marker);
}

// ── 4. 样式层仍提供共享 chrome ───────────────────────────────────────────
const directorCss = read('src/assets/css/director.css');
if (!directorCss.includes('.pb.focus-mode .col-left')) fail('missing focus mode layout rules');
if (!directorCss.includes('@property --character-accent') || !directorCss.includes('characterGlassSweep')) {
  fail('missing animated character theme treatment');
}
if (!directorCss.includes('workspace-enter-result') || !directorCss.includes('directorViewIn')) {
  fail('missing director view transition');
}
// 生成等待反馈
if (!directorCss.includes('stageBreath') || !directorCss.includes('stageSweep')) {
  fail('missing generating-state breathing feedback on the canvas');
}

const designCss = read('src/assets/css/design-system.css');
if (!designCss.includes('@view-transition') || !designCss.includes('--glass-fill-strong')) {
  fail('missing global page transition or liquid glass tokens');
}
if (!designCss.includes('.nav-back') || !designCss.includes('.page-kicker') || !designCss.includes('.empty-state')) {
  fail('missing shared atelier chrome components');
}
// 字体现在由 index.html preconnect + link 加载（CSS @import 会串行化 RTT）。
// 仍要确认字体族在 token 里声明，且入口真的去取了它。
if (!designCss.includes('Noto Sans SC')) {
  fail('missing Noto Sans SC in the --font-* token stack');
}
if (!read('index.html').includes('Noto+Sans+SC')) {
  fail('index.html must load Noto Sans SC (preconnect + stylesheet link)');
}
// 全局颜色过渡不得回退成通配符（性能回归信号）
if (/^\s*\*,\s*$[\s\S]{0,80}transition:/m.test(designCss)) {
  fail('global color transition must not target every element with a wildcard selector');
}

// ── 5. 情绪推断与历史恢复的防回归 ────────────────────────────────────────
const sceneUx = read('src/utils/sceneUX.ts');
for (const fn of ['isSceneBoundStory', 'restoreHistoryManualTags', 'restoreHistoryStory']) {
  if (!sceneUx.includes('export function ' + fn)) fail('sceneUX must export ' + fn);
}

console.log('Prompt Builder module layout tests passed: ownership, wiring, hires pipeline, chrome, and regression guards');
