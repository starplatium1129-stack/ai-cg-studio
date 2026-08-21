'use strict';

const assert = require('assert');

const { test } = require('node:test');

test("Prompt Builder module layout tests passed: ownership, wiring, hires pipeline, chrome, and regression guards", () => {
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
  ['src/composables/usePromptAssembly.ts', ['usePromptAssembly', 'qualityPrefix', 'assembleNegative', 'resolveLoraSpecs', 'applyFraming', 'analyzeParts']],
  ['src/composables/useBackup.ts', ['exportBackup', 'restore', 'healthCheck', 'cleanOrphanImages']],
  ['src/composables/useVoice.ts', ['startTurn', 'append', 'finishTurn']],
  ['src/composables/useImageStore.ts', ['imgPut', 'imgGet', 'imgDeleteMany']],
  ['src/composables/useKVStore.ts', ['kvGet', 'kvSet']],
   ['src/components/HistoryPanel.vue', ['history-wrap', 'imgGet']],
  ['src/components/VoiceStudio.vue', ['voice-studio', 'voiceApi.getStatus', 'voiceApi.prepare', 'voiceApi.translate', '/api/tts']],
  ['src/components/PromptDataTools.vue', ['useBackup', 'pb-backup-overlay', 'useFocusTrap']],
  ['src/components/PromptHealthPanel.vue', ['PromptReport', 'prompt-health-warnings', 'artViolations']],
  ['src/components/GenerationQueuePanel.vue', ['SDQueueJob', 'sd-queue-list', "emit('remove'"]],
  ['src/components/GenerationParamsPanel.vue', ["defineModel<SDParams>('params'", "'reuse-seed'", 'samplerOptions']],
  ['src/components/ManagedDrawingRouteCard.vue', ['managed-route-card', "reuse: [id: number]", 'route.promptFormat']],
  ['src/components/GenerationOutputControls.vue', ["defineModel<SDParams>('params'", 'generation-output-controls', 'queueAvailable', 'engine: DrawEngine']],
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
const parsedAnima = persistence.parsePresetCatalog({
  model_profiles:[{
    id:'anima_base', engine:'anima', model_id:'anima-base-v1.0', tag_style:'space',
    lora_in_prompt:false, lora_strength:'0.85', exact_tokens:['ayachi_nene', 'nene_school_uniform'], match:['anima-base-v1.0', 7],
  }],
}).modelProfiles[0];
assert.strictEqual(parsedAnima.engine, 'anima', 'Anima profile engine must survive persistence parsing');
assert.strictEqual(parsedAnima.tag_style, 'space', 'Anima tag style must survive persistence parsing');
assert.strictEqual(parsedAnima.lora_in_prompt, false, 'Anima must not inject A1111 LoRA syntax');
assert.strictEqual(parsedAnima.lora_strength, 0.85, 'Anima LoRA strength must normalize as a number');
assert.deepStrictEqual(parsedAnima.exact_tokens, ['ayachi_nene', 'nene_school_uniform'], 'v19 exact token list must survive persistence parsing');
const parsedWai = persistence.parsePresetCatalog({
  model_profiles:[{ id:'wai', engine:'sd', hires_fix:true, hires_scale:1.5, hires_steps:20, hires_denoising_strength:0.4 }],
}).modelProfiles[0];
assert.strictEqual(parsedWai.hires_fix, true, 'WAI automatic hires flag must survive persistence parsing');
assert.strictEqual(parsedWai.hires_denoising_strength, 0.4, 'WAI hires denoise must survive persistence parsing');
const restoredContext = persistence.restoreHistorySceneStory(
  { scene:'scene-cafe', story:'用户自定义：宁宁在雨后收起伞。' },
  [{ id:'scene-cafe', title:'咖啡馆' }],
);
assert.strictEqual(restoredContext.scene.id, 'scene-cafe', 'history round-trip must resolve the saved scene');
assert.strictEqual(restoredContext.story, '用户自定义：宁宁在雨后收起伞。', 'history round-trip must preserve custom story text');
assert.deepStrictEqual(parsedAnima.match, ['anima-base-v1.0'], 'profile match list must remain string-only');

const storeSource = read('src/stores/promptBuilderStore.ts');
if (/\bany\b/.test(storeSource)) fail('prompt builder store must keep scene, profile, draft, and project boundaries explicitly typed');
for (const marker of ['engine?: DrawEngine', 'profile?: string', 'model?: string', 'loraId?: string | null', 'loraStrength?: number | null']) {
  if (!storeSource.includes(marker)) fail('history entries must retain generation metadata: ' + marker);
}
for (const marker of ['engine: entry.engine ?? \'sd\'', 'profile: entry.profile ?? \'\'', 'model: entry.model ?? sdModelName.value']) {
  if (!storeSource.includes(marker)) fail('history commit must persist generation metadata: ' + marker);
}
if (!storeSource.includes("two_red_hairclips, mole_under_eye, no_hair_ribbon")) {
  fail('Natsume control prompt must retain the explicit red-clip and mole identity anchors');
}
if (!/nene:\s*'1girl, solo/.test(storeSource) || !/natsume:\s*'1girl, solo/.test(storeSource)) {
  fail('single-character wallpaper prompts must retain their solo composition lock');
}

// ── 2. 导演台视图必须真正接线这些能力 ────────────────────────────────────
const view = read('src/views/PromptBuilderView.vue');
const promptAssembly = read('src/composables/usePromptAssembly.ts');
const drawingRoute = read('src/utils/drawingRoute.ts');
const animaPanel = read('src/components/AnimaQuickPanel.vue');
const sdGenerateSource = read('src/composables/useSDGenerate.ts');
if (storeSource.includes('kreaStyleId') || storeSource.includes('artistInfluences') || !storeSource.includes('styleLoraId: entry.styleLoraId ?? null')) {
  fail('history must retain generated metadata without restoring manual style or artist controls');
}
if (!sdGenerateSource.includes('L_NENE_V18_WD14') || !view.includes('loras[0]?.id')) {
  fail('WAI history must preserve structured canonical LoRA ids and weights');
}
if (/\bany\b/.test(view)) fail('PromptBuilderView must keep deep links, scenes, and history explicitly typed');
if (/\bany\b/.test(promptAssembly)) fail('prompt assembly must keep its store and policy boundary explicitly typed');
if (!view.includes('<GenerationOutputControls') || !view.includes(':engine="drawEngine"') || !view.includes("drawEngine !== 'sd' && pb.directorMode === 'pro'")) {
  fail('all engines must share generation controls while detailed Anima parameters stay expert-only');
}
if (view.includes('GenerationStylePanel') || view.includes('artistInfluences') || view.includes('kreaStyleId')) {
  fail('director must not restore the removed free-form artist/style channels');
}
if (!view.includes('ArtistStylePicker') || !view.includes("pb.directorMode === 'pro'")) {
  fail('curated artist tags must stay scoped to expert mode');
}
if (/entry\.char\b/.test(view) || !view.includes('entry.character')) {
  fail('history deep links must restore the canonical character field');
}

const promptPipeline = [
  ['qualityPrefix', 'quality prefix must come from the model profile, not a hardcoded string'],
  ['assembleNegative', 'negative prompt must apply the model profile merge/replace策略'],
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
for (const marker of ['recommendDrawingRoute', 'managedRoute', 'applyManagedRoute', 'reuseSuccessfulRecipe', 'ManagedDrawingRouteCard']) {
  if (!view.includes(marker)) fail('scene mode must consume the managed drawing route: ' + marker);
}
for (const marker of ['L_NENE_V21_ANIMA', "engine: 'sd'", "engine: 'anima'", "engine: 'krea2'"]) {
  if (!drawingRoute.includes(marker)) fail('drawing route must pin the validated engine contract: ' + marker);
}
if (view.includes('prompt-style-switch') || view.includes('aics_parameter_memory_v1')) {
  fail('prompt syntax and detached parameter memory must not be exposed as independent scene-mode choices');
}
for (const marker of ['DrawEngine', 'historyGenerationFields', 'animaModelId', 'engine: meta.engine']) {
  if (!view.includes(marker)) fail('director must wire engine-specific generation metadata: ' + marker);
}
if (view.includes('styleLoraId: animaState.value.styleLoraId')) {
  fail('one-click requests must not submit a hidden Style LoRA selection');
}
// Anima 生成生命周期自第十一轮起归 useAnimaSession 组合函数所有：
// 视图保留 prompt 组装与结果协调，会话状态机/轮询/取消在组合函数内。
const animaSessionSource = read('src/composables/useAnimaSession.ts');
for (const marker of ['buildAnimaRequest', 'onAnimaResult', 'cancelAnimaJob', '@generate="callGenerate"', 'cancelGeneration']) {
  if (!view.includes(marker)) fail('Anima generation must be parent-owned and metadata-driven: ' + marker);
}
for (const marker of ['metadataFromJob', 'pollJob', 'generate', 'cancel', 'dispose', 'animaRequestPayload']) {
  if (!animaSessionSource.includes(marker)) fail('Anima session composable must own ' + marker);
}
if (!view.includes('useAnimaSession')) {
  fail('PromptBuilderView must consume the dedicated Anima session composable');
}
for (const forbidden of ['animaPanelRef', 'syncAnimaPanelState', 'restoreAnimaPanelState', 'querySelectorAll']) {
  if (view.includes(forbidden)) fail('PromptBuilderView must not read Anima controls through DOM: ' + forbidden);
}
if (animaPanel.includes("fetch('/api/anima/jobs'")) fail('AnimaQuickPanel must not own the generation HTTP lifecycle');
for (const marker of ['update:state', 'readonly']) {
  if (!animaPanel.includes(marker)) fail('AnimaQuickPanel must remain a typed presentational control surface: ' + marker);
}
if (animaPanel.includes("emit('submit')") || animaPanel.includes("emit('cancel')") || animaPanel.includes('Style LoRA')) {
  fail('AnimaQuickPanel must not own generation actions or manual Krea style setup');
}
const sceneLoad = view.indexOf('if (restoredContext.scene) pb.loadScene(restoredContext.scene)');
const storyRestore = view.indexOf('pb.setStory(restoredContext.story)');
if (sceneLoad < 0 || storyRestore < sceneLoad) fail('history restore must load the scene before restoring custom story text');
if (view.includes("else if (entry.engine === 'sd')")) {
  fail('legacy history without an engine field must restore through the SD path');
}
for (const marker of ['requestSerial += 1', "method: 'DELETE'"]) {
  if (!animaSessionSource.includes(marker)) fail('leaving the director must stop Anima polling and cancel the owned job: ' + marker);
}
if (view.includes('animaRequestSerial') || view.includes('animaStatusRequest') || view.includes('animaJobRequest')) {
  fail('Anima session request serials and controllers must live in the session composable');
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
const voiceApi = read('src/api/voiceApi.ts');
for (const marker of ["import { voiceApi } from '@/api/voiceApi'", 'voiceApi.getStatus', 'voiceApi.prepare', 'voiceApi.translate', '/api/tts', 'voice-studio']) {
  if (!voiceStudio.includes(marker)) fail('voice studio must own: ' + marker);
}
for (const endpoint of ['/api/tts-status', '/api/voice/prepare', '/api/translate']) {
  if (!voiceApi.includes(endpoint)) fail('voice API module must own migrated endpoint: ' + endpoint);
  if (voiceStudio.includes(endpoint)) fail('VoiceStudio must not own migrated JSON endpoint: ' + endpoint);
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
const generationApiSource = read('src/api/generationApi.ts');
if (!sdGenerate.includes('buildTxt2ImgRequest') || !sdGenerate.includes('generationApi')) {
  fail('SD composable must use the shared production request builder and the application generation API module');
}
if (!generationApiSource.includes('/api/generation/jobs')) {
  fail('generation API module must own the application generation job endpoints');
}
if (!sdGenerate.includes("accepted.job.provider === 'comfy' ? 'comfy' : 'webui'")) {
  fail('SD provider state must fail safe to WebUI when the server response is missing or unknown');
}
if (!sdGenerate.includes("'SD WebUI 生成中…'") || !sdGenerate.includes("'ComfyUI 生成中…'")) {
  fail('SD generation status text must distinguish the Comfy-first and WebUI providers');
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
// 字体已本地自托管（@fontsource，src/main.ts 引入；index.html 不再请求 Google）。
// 仍要确认字体族在 token 里声明，且入口真的去取了它。
if (!designCss.includes('Noto Sans SC')) {
  fail('missing Noto Sans SC in the --font-* token stack');
}
if (!read('src/main.ts').includes('@fontsource/noto-sans-sc')) {
  fail('main.ts must import self-hosted Noto Sans SC from @fontsource');
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

});
