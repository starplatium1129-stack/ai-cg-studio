const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'tools', 'prompt-builder.html');
const iconPath = path.join(root, 'tools', 'icon-system.js');
const designPath = path.join(root, 'css', 'design-system.css');
const promptPolicyPath = path.join(root, 'tools', 'prompt-policy.js');
const modules = [
  ['state.js', 'function loadData'],
  ['scene.js', 'function renderScenes'],
  ['prompt.js', 'function buildParts'],
  ['sd.js', 'function callSDGenerate'],
  ['queue.js', 'function enqueueSDGenerate'],
  ['voice.js', 'function generateAIVoice'],
  ['history.js', 'function commitHistoryEntry'],
  ['backup.js', 'function exportLocalData'],
  ['ui.js', 'function toggleFocusMode'],
  ['app.js', 'function init']
];

function fail(message) {
  throw new Error('[prompt-builder modules] ' + message);
}

const html = fs.readFileSync(htmlPath, 'utf8');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
  fail('prompt-builder.html must not contain an inline script block');
}

if (!html.includes('icon-system.js?v=1')) fail('missing icon-system script reference');
if (!html.includes('prompt-policy.js?v=1')) fail('missing prompt policy script reference');
if (html.indexOf('prompt-policy.js?v=1') > html.indexOf('prompt-builder/state.js?v=1')) fail('prompt policy must load before builder modules');
if (!html.includes('id="focusModeBtn"')) fail('missing focus mode control');
if (!html.includes('body.focus-mode .col-left')) fail('missing focus mode layout rules');
if (!html.includes('id="firstRunExperienceBtn"')) fail('missing actionable first creation entry');
if (!html.includes('id="directorModeBasic"') || !html.includes('id="directorModePro"')) fail('missing director mode controls');
if (!html.includes('id="recentSceneShortcuts"')) fail('missing recent scene shortcuts');
if (!html.includes('@property --character-accent') || !html.includes('characterGlassSweep')) fail('missing animated character theme treatment');
if (!html.includes('workspace-enter-result') || !html.includes('directorViewIn')) fail('missing director view transition');
if (html.includes('id="obOverlay"') || html.includes('data-ob-active')) fail('legacy blocking onboarding must be removed');
const designSource = fs.readFileSync(designPath, 'utf8');
if (!designSource.includes('@view-transition') || !designSource.includes('--glass-fill-strong')) fail('missing global page transition or liquid glass tokens');
if (!fs.existsSync(iconPath)) fail('missing icon-system.js');
if (!fs.existsSync(promptPolicyPath)) fail('missing prompt-policy.js');
const promptPolicySource = fs.readFileSync(promptPolicyPath, 'utf8');
try { new Function(promptPolicySource); } catch (error) { fail('prompt-policy.js has a syntax error: ' + error.message); }
const iconSource = fs.readFileSync(iconPath, 'utf8');
if (!iconSource.includes('window.AICIcons')) fail('icon system is missing its public API');
try {
  new Function(iconSource);
} catch (error) {
  fail('icon-system.js has a syntax error: ' + error.message);
}

let previousOffset = -1;
for (const [name, marker] of modules) {
  const src = 'prompt-builder/' + name + '?v=1';
  const offset = html.indexOf(src);
  if (offset < 0) fail('missing script reference for ' + name);
  if (offset <= previousOffset) fail('module load order is invalid near ' + name);
  previousOffset = offset;

  const file = path.join(root, 'tools', 'prompt-builder', name);
  if (!fs.existsSync(file)) fail('missing module file ' + name);
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes(marker)) fail(name + ' is missing its public entry point');
  try {
    new Function(source);
  } catch (error) {
    fail(name + ' has a syntax error: ' + error.message);
  }
}

const sceneSource = fs.readFileSync(path.join(root, 'tools', 'prompt-builder', 'scene.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'tools', 'prompt-builder', 'app.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'tools', 'prompt-builder', 'history.js'), 'utf8');
const queueSource = fs.readFileSync(path.join(root, 'tools', 'prompt-builder', 'queue.js'), 'utf8');
const sdSource = fs.readFileSync(path.join(root, 'tools', 'prompt-builder', 'sd.js'), 'utf8');
if (!sceneSource.includes("document.createElement('article')") || !sceneSource.includes("selectBtn.className = 'scene-card-main'")) {
  fail('scene cards must expose separate native controls for loading and quick generation');
}
if (sceneSource.includes("card.setAttribute('role','button')") || sceneSource.includes('card.tabIndex = 0')) {
  fail('scene card containers must not impersonate a button around nested actions');
}
if (!html.includes('.scene-card:focus-within .scene-direct-btn')) fail('keyboard focus must reveal the scene quick action');
if (!sceneSource.includes('isSceneBoundStory(activeScene, state.story, state.__sceneBaseStory)') || !sceneSource.includes('keepStory:!sceneBoundStory')) {
  fail('character switching must drop only story text still bound to an incompatible scene');
}
if (!sceneSource.includes('function syncDecisionSelectionUI()') || !sceneSource.includes("control.setAttribute('aria-pressed', selected ? 'true' : 'false')")) {
  fail('director selection state must have a shared aria-pressed synchronizer');
}
if (!sceneSource.includes('var source = sourceCompatible ? storedSource : null;') || !sceneSource.includes('state.__sceneId = source ? source.id : null;')) {
  fail('draft restoration must not revive a scene that is incompatible with the restored character');
}
if (!appSource.includes('syncDecisionSelectionUI();') || !appSource.includes('syncSceneCardSelection();')) {
  fail('history restoration must synchronize visual and accessible selection state');
}
if (!historySource.includes('manual_tags:manualTags.slice()') || !historySource.includes('queueJob.manualTags')) {
  fail('history entries must persist the exact editor or queued manual tag snapshot');
}
if (!queueSource.includes('manualTags:Array.from(state.manualTags || [])')) {
  fail('queued generation must freeze manual tags with the rest of the job state');
}
if (!html.includes('1344×768 · 高清') || !html.includes('1536×864 · 16G 显存') || !html.includes('id="sceneSizeHint"')) {
  fail('director must expose true 16:9 CG sizes and the scene-size explanation');
}
if (!sdSource.includes('function applySceneGenerationPreset(scene)') || !sdSource.includes('applySceneGenerationPreset(activeScene)')) {
  fail('scene size presets must survive quick-create parameter reuse');
}
if (!sceneSource.includes('applySceneGenerationPreset(s)')) {
  fail('loading a scene must apply its generation-size preset');
}
if (!appSource.includes('restoreHistoryManualTags(h, historyScene, !!sceneCompatible)') ||
    !appSource.includes('restoreHistoryStory(h, historyScene, !!sceneCompatible)') ||
    !appSource.includes('isSceneBoundStory(historyScene, h.story, historyScene.story)')) {
  fail('history restoration must recover scene tags and drop only incompatible scene-bound stories');
}

console.log('Prompt Builder module layout tests passed');
