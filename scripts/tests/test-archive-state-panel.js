'use strict';

const { test } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

test('archive state language contract', () => {
  const root = path.resolve(__dirname, '..', '..');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const panel = read('src/components/visual/ArchiveStatePanel.vue');
  const scene = read('src/views/SceneExplorerView.vue');
  const gallery = read('src/views/GalleryView.vue');
  const showcase = read('src/views/ShowcaseView.vue');
  const character = read('src/views/CharacterView.vue');
  const home = read('src/views/HomeView.vue');

  assert(panel.includes("'loading' | 'empty' | 'filtered' | 'error' | 'success'"), 'state union must distinguish filtered results');
  assert(panel.includes("filtered:'search'"), 'filtered state must use a search icon');
  assert(panel.includes("filtered:'NO FILTER MATCH'"), 'filtered state must have a distinct default code');
  assert(panel.includes(':data-kind="kind"'), 'state kind must be exposed for styling and tests');
  assert(panel.includes("props.kind === 'loading' ? 'status'"), 'loading must remain a status announcement');
  assert(panel.includes("props.kind === 'error' ? 'alert'"), 'errors must remain alerts');
  assert(panel.includes('compact?: boolean') && panel.includes('.archive-state-panel.compact'), 'compact state contract must be supported');

  assert(scene.includes('v-else-if="paged.length === 0"') && scene.includes('kind="filtered"'), 'scene filter misses must be filtered');
  assert(gallery.includes('v-else-if="!visible.length"') && gallery.includes('kind="filtered"'), 'gallery filter misses must be filtered');
  assert(showcase.includes('v-else-if="manifestLoading"') && showcase.includes('kind="loading"'), 'showcase manifest loading must be loading');
  assert(showcase.includes('v-else-if="!filtered.length"') && showcase.includes('kind="filtered"'), 'showcase filter misses must be filtered');
  assert(character.includes('v-else-if="!characters.length"') && character.includes('kind="empty"'), 'character empty data must have a real empty state');
  assert(home.includes('ArchiveStatePanel') && home.includes('compact') && home.includes('recent-empty-state'), 'home recent works must use the compact shared state');
  assert(!/recent-empty-state[\s\S]*<div class="empty-state-icon"/.test(home), 'home must not retain the bespoke empty-state icon');
});
