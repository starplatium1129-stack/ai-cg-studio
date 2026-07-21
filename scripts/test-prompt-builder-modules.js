const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'tools', 'prompt-builder.html');
const iconPath = path.join(root, 'tools', 'icon-system.js');
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
if (!html.includes('id="focusModeBtn"')) fail('missing focus mode control');
if (!html.includes('body.focus-mode .col-left')) fail('missing focus mode layout rules');
if (!fs.existsSync(iconPath)) fail('missing icon-system.js');
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

console.log('Prompt Builder module layout tests passed');
