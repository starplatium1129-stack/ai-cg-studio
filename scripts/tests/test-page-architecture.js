'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const pages = [
  ['index.html', 'tools/home.js'],
  ['tools/scene-manager.html', 'tools/scene-manager.js'],
  ['tools/scene-explorer.html', 'tools/scene-explorer.js'],
  ['tools/control.html', 'tools/control.js'],
  ['tools/showcase.html', 'tools/showcase.js'],
  ['tools/scenario.html', 'tools/scenario.js'],
  ['tools/lora.html', 'tools/lora.js'],
  ['tools/character.html', 'tools/character.js'],
  ['tools/color-script.html', 'tools/color-script.js'],
  ['tools/style.html', 'tools/style.js'],
  ['tools/gallery.html', 'tools/gallery.js']
];

// Pages that must have zero HTML event attributes (CSP-ready).
const noInlineHandlerPages = pages.map(function (entry) { return entry[0]; });

const inlineHandlerRe = /\son(?:click|change|input|submit|keydown|keyup|focus|blur|error)\s*=/i;
// Leading whitespace or quote so property assigns like el.onclick= are not matched.
const jsInlineHandlerRe = /(?:^|[\s"'`])on(?:click|change|input|submit|keydown|keyup|focus|blur|error)\s*=/;

for (const [htmlRelative, jsRelative] of pages) {
  const htmlPath = path.join(root, htmlRelative);
  const jsPath = path.join(root, jsRelative);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptTags = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  const inline = scriptTags.filter((match) => !/\bsrc\s*=/.test(match[1]));
  assert.strictEqual(inline.length, 0, `${htmlRelative} must not contain an inline controller`);
  assert(fs.existsSync(jsPath), `${jsRelative} must exist`);
  const expectedSrc = path.relative(path.dirname(htmlPath), jsPath).replace(/\\/g, '/');
  const escapedSrc = expectedSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(scriptTags.some((match) => new RegExp(`\\bsrc=["']${escapedSrc}\\?v=\\d+["']`).test(match[1])),
    `${htmlRelative} must load ${expectedSrc} with a cache-busting version`);
  const source = fs.readFileSync(jsPath, 'utf8');
  new vm.Script(source, { filename:jsRelative });
  if (noInlineHandlerPages.includes(htmlRelative)) {
    assert(!inlineHandlerRe.test(html), `${htmlRelative} must not use HTML event attributes`);
    assert(!jsInlineHandlerRe.test(source), `${jsRelative} must not emit inline event attributes`);
  }
}

// prompt-builder is multi-module; scan HTML + modules that emit dynamic markup.
const builderHtmlRel = 'tools/prompt-builder.html';
const builderHtml = fs.readFileSync(path.join(root, builderHtmlRel), 'utf8');
assert(!inlineHandlerRe.test(builderHtml), `${builderHtmlRel} must not use HTML event attributes`);
const builderModules = ['scene.js', 'queue.js', 'history.js', 'ui.js', 'app.js', 'prompt.js', 'sd.js'];
for (const name of builderModules) {
  const rel = 'tools/prompt-builder/' + name;
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(!jsInlineHandlerRe.test(source), `${rel} must not emit inline event attributes`);
  new vm.Script(source, { filename:rel });
}

// chat is multi-module (ESM); scan HTML + local modules for CSP readiness.
const chatHtmlRel = 'tools/chat.html';
const chatHtml = fs.readFileSync(path.join(root, chatHtmlRel), 'utf8');
assert(!inlineHandlerRe.test(chatHtml), `${chatHtmlRel} must not use HTML event attributes`);
assert(/type=["']module["']/.test(chatHtml) && /chat\/app\.mjs\?v=\d+/.test(chatHtml),
  `${chatHtmlRel} must load chat/app.mjs as a versioned module`);
const chatModules = [
  'app.mjs', 'config.mjs', 'live2d.mjs', 'storage.mjs', 'utils.mjs', 'voice.mjs', 'live2d-bootstrap.js'
];
for (const name of chatModules) {
  const rel = 'tools/chat/' + name;
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(!jsInlineHandlerRe.test(source), `${rel} must not emit inline event attributes`);
  if (name.endsWith('.js')) new vm.Script(source, { filename:rel });
}

// Hot pages share atelier chrome: back link + kicker primitives.
const chromePages = [
  'tools/control.html',
  'tools/gallery.html',
  'tools/scene-manager.html',
  'tools/chat.html',
  'tools/prompt-builder.html',
  'tools/showcase.html',
  'tools/scenario.html',
  'tools/color-script.html',
  'tools/lora.html'
];
for (const rel of chromePages) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(/class=["'][^"']*\bnav-back\b/.test(html), `${rel} must expose nav-back chrome`);
  assert(
    /class=["'][^"']*\b(page-kicker|pb-kicker|gallery-kicker)\b/.test(html),
    `${rel} must expose page/pb/gallery kicker chrome`
  );
}

console.log(`Page architecture tests passed: ${pages.length} controllers + prompt-builder + chat modules are external, CSP-ready, and syntactically valid`);
