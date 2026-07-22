'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const page = read('tools/showcase.html');
const nav = read('tools/nav.js');
const home = read('index.html');
const server = read('server.js');

assert(page.includes('data-nav="showcase"'), 'showcase page must activate its navigation item');
assert(page.includes("state={entries:[],filtered:[],featured:new Set(),scope:'all',character:'all',rating:'all',adult:false"), 'R18 must be hidden by default');
assert(page.includes("fetch('/scene-showcase/manifest.json'"), 'showcase page must load the approved manifest');
assert(page.includes("prompt-builder.html?scene="), 'approved samples must link back to the director');
assert(page.includes('loading="lazy"'), 'sample thumbnails must lazy-load');
assert(page.includes('id="r18Filter"') && page.includes('window.confirm'), 'R18 requires an explicit reveal action');
assert(nav.includes("id:'showcase'") && nav.includes("href:'tools/showcase.html'"), 'global navigation must expose the showcase');
assert(home.includes('href="tools/showcase.html"'), 'home page must expose the showcase');
assert(server.includes("app.use('/scene-showcase'"), 'server must mount showcase assets');
assert(server.includes('SCENE_SHOWCASE_DIR') && server.includes('manifest\\.json'), 'server must resolve and restrict the showcase directory');

const inlineScripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
assert(inlineScripts.length === 1, 'showcase page should have one inline controller');
new Function(inlineScripts[0]);

const showcaseRoot = path.resolve(root, '..', 'AI', 'SceneShowcase');
if (fs.existsSync(showcaseRoot)) {
  const candidates = fs.readdirSync(showcaseRoot, { withFileTypes:true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(showcaseRoot, entry.name, 'manifest.json')))
    .sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'));
  if (candidates[0]) {
    const selected = path.join(showcaseRoot, candidates[0].name);
    const manifest = JSON.parse(fs.readFileSync(path.join(selected, 'manifest.json'), 'utf8'));
    assert.strictEqual(manifest.entries.length, manifest.sceneCount, 'manifest count must match entries');
    assert.strictEqual(new Set(manifest.entries.map((entry) => entry.id)).size, manifest.entries.length, 'manifest ids must be unique');
    manifest.entries.forEach((entry) => {
      assert(fs.existsSync(path.join(selected, 'images', entry.id + '.jpg')), 'missing approved image: ' + entry.id);
      assert(fs.existsSync(path.join(selected, 'thumbs', entry.id + '.jpg')), 'missing approved thumbnail: ' + entry.id);
    });
  }
}

console.log('Showcase tests passed: navigation, safe filtering, director links, scripts, and approved assets');
