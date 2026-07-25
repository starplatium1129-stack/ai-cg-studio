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
// prompt-builder remains on a temporary unsafe-inline exception.
const noInlineHandlerPages = pages.map(function (entry) { return entry[0]; });

const inlineHandlerRe = /\son(?:click|change|input|submit|keydown|keyup|focus|blur)\s*=/i;
const jsInlineHandlerRe = /\son(?:click|change|input|submit|keydown|keyup|focus|blur)\s*=/;

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

console.log(`Page architecture tests passed: ${pages.length} controllers are external, CSP-ready, and syntactically valid`);
