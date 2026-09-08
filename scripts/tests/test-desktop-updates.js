'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  RELEASE_REPOSITORY,
  createManifest,
  releaseTag,
} = require('../maintenance/release-desktop-update');

const ROOT = path.resolve(__dirname, '..', '..');

test('桌面更新端点固定使用主项目 GitHub Releases', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'desktop-tauri/src-tauri/tauri.conf.json'), 'utf8'));
  assert.deepEqual(config.plugins.updater.endpoints, [
    `https://github.com/${RELEASE_REPOSITORY}/releases/latest/download/latest.json`,
  ]);
  assert.equal(config.plugins.updater.dangerousInsecureTransportProtocol, undefined);
});

test('发布清单指向同版本公开 Release 安装包', () => {
  const manifest = createManifest('1.5.9', 'signed', 'AI-CG-Studio_1.5.9_x64-setup.exe', new Date('2026-09-08T10:00:00Z'));
  assert.equal(releaseTag(manifest.version), 'v1.5.9');
  assert.equal(manifest.pub_date, '2026-09-08T10:00:00.000Z');
  assert.equal(manifest.platforms['windows-x86_64'].signature, 'signed');
  assert.equal(
    manifest.platforms['windows-x86_64'].url,
    'https://github.com/starplatium1129-stack/ai-cg-studio/releases/download/v1.5.9/AI-CG-Studio_1.5.9_x64-setup.exe',
  );
});

test('自动检查只提示，安装必须由用户点击触发', () => {
  const banner = fs.readFileSync(path.join(ROOT, 'src/components/DesktopUpdateBanner.vue'), 'utf8');
  const updater = fs.readFileSync(path.join(ROOT, 'src/composables/useDesktopUpdater.ts'), 'utf8');
  assert.match(banner, /@click="installUpdate\(\)"/);
  assert.doesNotMatch(banner, /onMounted\([^\n]*installUpdate/);
  assert.match(updater, /async function install\(\)/);
});
