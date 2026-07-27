'use strict';

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

function fail(message) {
  throw new Error('[prompt-builder modules] ' + message);
}

// ── 1. 模块必须各有归属文件 ──────────────────────────────────────────────
const modules = [
  ['src/stores/promptBuilderStore.ts', ['saveDraft', 'restoreDraft', 'commitHistoryEntry', 'applyModelProfile', 'loadScene']],
  ['src/utils/promptPolicy.ts', ['qualityPrefix', 'modelNegativePrompt', 'resolveLoraSpecs', 'applyFraming', 'norm', 'analyzeParts', 'sceneTemplateText']],
  ['src/utils/sceneInference.ts', ['sceneLighting', 'sceneShot', 'sceneColorMood', 'sceneRecommendedSize']],
  ['src/utils/sdError.ts', ['classifySDError', 'SAFE_SAMPLING', 'LIGHT_LOAD']],
  ['src/composables/useSDGenerate.ts', ['checkStatus', 'generate', 'cancel']],
  ['src/composables/useSDQueue.ts', ['useSDQueue', 'SD_QUEUE_LIMIT']],
  ['src/composables/useBackup.ts', ['exportBackup', 'restore', 'healthCheck', 'cleanOrphanImages']],
  ['src/composables/useVoice.ts', ['startTurn', 'append', 'finishTurn']],
  ['src/composables/useImageStore.ts', ['imgPut', 'imgGet', 'imgDeleteMany']],
  ['src/composables/useKVStore.ts', ['kvGet', 'kvSet']],
  ['src/components/HistoryPanel.vue', ['history-wrap', 'imgGet']],
];

for (const [rel, markers] of modules) {
  if (!exists(rel)) fail('missing module file ' + rel);
  const source = read(rel);
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${rel} is missing its public entry point: ${marker}`);
  }
}

// ── 2. 导演台视图必须真正接线这些能力 ────────────────────────────────────
const view = read('src/views/PromptBuilderView.vue');

const wiring = [
  ['qualityPrefix', 'quality prefix must come from the model profile, not a hardcoded string'],
  ['modelNegativePrompt', 'negative prompt must apply the model profile merge/replace策略'],
  ['resolveLoraSpecs', 'LoRA weight must be resolved per framing'],
  ['applyFraming', 'framing conflicts must be resolved at composition time'],
  ['sceneTemplateText', 'scene templates must be sanitized before use'],
  ['analyzeParts', 'prompt structure health must be reported'],
  ['classifySDError', 'generation failures must be classified into recovery actions'],
  ['useSDQueue', 'director must support a serial generation queue'],
  ['useBackup', 'director must expose local data backup/restore'],
  ['commitHistoryEntry', 'generated art must be committed to IndexedDB-backed history'],
  ['applyModelProfile', 'SD params must follow the matched checkpoint profile'],
  ['HistoryPanel', 'director must render the artwork history panel'],
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

// 配音工作室接线
for (const marker of ['/api/tts-status', '/api/translate', '/api/tts', 'voice-studio']) {
  if (!view.includes(marker)) fail('voice studio must be wired: ' + marker);
}

// ── 3. 出图参数必须与底模 profile 一致，且支持 hires 细项 ────────────────
for (const marker of ['hr_second_pass_steps', 'denoising_strength', 'hiresSteps', 'hiresDenoise']) {
  if (!view.includes(marker)) fail('hires pipeline must expose ' + marker);
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
if (!designCss.includes('Noto+Sans+SC') && !designCss.includes('fonts.googleapis.com')) {
  fail('missing web font loading for Noto Sans SC');
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
