'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { VERSIONED_FILES } = require('../scripts/lib/data-version');

// 编辑基线包含源文件；浏览器缓存的 DATA_VERSION 不能保护尚未聚合的源修改。
function sourceFiles(root) {
  const files = [];
  function visit(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(file);
    }
  }
  for (const name of ['scenes', 'blueprints', 'popular']) visit(path.join(root, 'data', name));
  return files.sort();
}

function sceneContentVersion(root) {
  const hash = crypto.createHash('sha256');
  const files = [...VERSIONED_FILES, 'retired-scenes.json', 'prompt-pinned-scenes.json']
    .map(name => path.join(root, 'data', name)).concat(sourceFiles(root));
  for (const file of files) {
    const bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
    hash.update(JSON.stringify([path.relative(root, file), bytes ? bytes.length : null]));
    if (bytes) hash.update(bytes);
  }
  return Number.parseInt(hash.digest('hex').slice(0, 12), 16);
}

// 调用方持有保存锁；内容和基线一起返回，避免客户端先读旧产物再领取新版本。
function readSceneState(root, store, sceneWrite) {
  const version = sceneContentVersion(root);
  const integrity = sceneWrite.verifyShardIntegrity();
  if (!integrity.ok) throw new Error(integrity.problems.join('\n'));
  const loaded = store.loadSceneShards();
  const dataDir = path.join(root, 'data');
  const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
  const retiredIds = sceneWrite.readRetiredSceneIds(dataDir);
  const blueprints = read('scene-blueprints.json');
  const snapshot = {
    scenes: loaded.scenes,
    tags: read('tags.json'),
    curation: read('curation.json'),
    blueprints: Array.isArray(blueprints) ? blueprints : blueprints.blueprints,
  };
  if (version !== sceneContentVersion(root)) throw new Error('读取期间内容发生变化，请重新读取');
  let nextSceneId = null;
  try { nextSceneId = sceneWrite.allocateSceneId(loaded.scenes.map(scene => scene.id), retiredIds); }
  catch (error) {
    if (![...loaded.scenes.map(scene => scene.id), ...retiredIds].some(id => /^sc\d+$/.test(id) && Number(id.slice(2)) >= 999)) throw error;
  }
  return { version, snapshot, nextSceneId, sceneCount: loaded.scenes.length, retiredCount: retiredIds.size };
}

module.exports = { sceneContentVersion, readSceneState };
