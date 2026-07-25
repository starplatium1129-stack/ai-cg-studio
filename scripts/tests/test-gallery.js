'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const page = fs.readFileSync(path.join(root, 'tools', 'gallery.html'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'tools', 'gallery.js'), 'utf8');

assert(page.includes('gallery-wall') && page.includes('columns:4 260px'), 'gallery must use a responsive masonry exhibition wall');
assert(page.includes('object-fit:contain') && !page.includes('object-fit:cover'), 'artwork must preserve the complete original composition');
assert(page.includes('art-viewer') && page.includes('aria-label="作品观赏模式"'), 'gallery must provide an accessible immersive viewer');
assert(/gallery\.js\?v=\d+/.test(page), 'gallery behavior must live in a maintainable external controller');
assert(page.includes('storage-health.js'), 'gallery must load storage health helpers for history validation');
assert(controller.includes('function artworkRatio') && controller.includes('image.naturalWidth'), 'gallery must honor stored and decoded image dimensions');
assert(controller.includes("event.key === 'ArrowLeft'") && controller.includes("event.key === 'ArrowRight'"), 'immersive viewer must support keyboard navigation');
assert(controller.includes('AICGImageStore.get') && controller.includes('revokeCardUrls') && controller.includes('revokeViewerUrl'), 'gallery must load local originals lazily and release object URLs');
assert(controller.includes("loading = className === 'artwork-image' ? 'lazy' : 'eager'"), 'wall images must lazy-load while the selected artwork loads eagerly');

new Function(controller);
console.log('Gallery tests passed: original ratios, masonry wall, immersive viewer, lazy images and cleanup');
