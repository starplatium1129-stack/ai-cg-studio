const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const dataDir = path.join(root, 'data');
const shardsDir = path.join(dataDir, 'scenes');
const manifestPath = path.join(shardsDir, 'manifest.json');
const aggregatePath = path.join(dataDir, 'scenes.json');
const browserShardPath = {
  nene: path.join(dataDir, 'scenes-nene.json'),
  natsume: path.join(dataDir, 'scenes-natsume.json'),
  shared: path.join(dataDir, 'scenes-shared.json')
};
const corePath = path.join(dataDir, 'scenes-core.json');
const indexPath = path.join(dataDir, 'scenes-index.json');

function readJson(source) {
  return JSON.parse(fs.readFileSync(source, 'utf8'));
}

function jsonText(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function writeTextAtomic(source, content) {
  const temporary = path.join(path.dirname(source), `.${path.basename(source)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, source);
  } catch (error) {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (cleanupError) {}
    throw error;
  }
}

function sceneNumber(scene) {
  const match = String(scene && scene.id || '').match(/^sc(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortScenes(scenes) {
  return [...scenes].sort((left, right) => sceneNumber(left) - sceneNumber(right));
}

function readManifest() {
  const manifest = readJson(manifestPath);
  if (!manifest || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('data/scenes/manifest.json must define a non-empty files array');
  }
  return manifest;
}

function loadSceneShards() {
  const manifest = readManifest();
  const sources = manifest.files.map((entry) => {
    const source = path.join(shardsDir, entry.file);
    const scenes = readJson(source);
    if (!Array.isArray(scenes)) throw new Error(entry.file + ' root must be an array');
    return { entry, source, scenes };
  });
  return { manifest, sources, scenes: sortScenes(sources.flatMap((item) => item.scenes)) };
}

function targetFile(scene) {
  if (scene.char === 'triad') return 'shared.json';
  const suffix = /After_Story/i.test(String(scene.category || '')) ? 'after-story' : 'core';
  if (scene.char === 'nene' || scene.char === 'natsume') return scene.char + '-' + suffix + '.json';
  throw new Error((scene.id || 'unknown scene') + ': cannot choose shard for char=' + scene.char);
}

function writeSceneShards(scenes) {
  const manifest = readManifest();
  const groups = new Map(manifest.files.map((entry) => [entry.file, []]));
  for (const scene of sortScenes(scenes)) {
    const file = targetFile(scene);
    if (!groups.has(file)) throw new Error('manifest does not declare shard ' + file);
    groups.get(file).push(scene);
  }
  for (const [file, items] of groups) {
    writeTextAtomic(path.join(shardsDir, file), jsonText(items));
  }
}

function readCuration() {
  try {
    const curation = readJson(path.join(dataDir, 'curation.json'));
    return curation && typeof curation === 'object' ? curation : {};
  } catch (error) {
    return {};
  }
}

function tierIds(curation, key) {
  const ids = curation && Array.isArray(curation[key]) ? curation[key] : [];
  return ids.filter((id) => typeof id === 'string').slice(0, 2000);
}

function groupBrowserShards(scenes) {
  const groups = { nene: [], natsume: [], shared: [] };
  const seen = new Set();
  for (const scene of sortScenes(scenes)) {
    if (!scene || !scene.id) continue;
    const char = scene.char === 'natsume' ? 'natsume' : (scene.char === 'triad' ? 'shared' : 'nene');
    if (seen.has(scene.id)) continue;
    seen.add(scene.id);
    groups[char].push(scene);
  }
  return groups;
}

function writeBrowserShards(scenes) {
  const groups = groupBrowserShards(scenes);
  for (const char of Object.keys(groups)) {
    writeTextAtomic(browserShardPath[char], jsonText(groups[char]));
  }
  return groups;
}

function writeCoreAndIndex(scenes, curation, groups) {
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const coreIds = tierIds(curation, 'personaCoreSceneIds').filter((id) => byId.has(id));
  writeTextAtomic(corePath, jsonText(coreIds.map((id) => byId.get(id))));

  const index = {
    version: 1,
    total: scenes.length,
    shards: {
      nene: { file: 'scenes-nene.json', count: groups.nene.length },
      natsume: { file: 'scenes-natsume.json', count: groups.natsume.length },
      shared: { file: 'scenes-shared.json', count: groups.shared.length }
    },
    tiers: {
      core: coreIds
    },
    orderedIds: sortScenes(scenes).map((scene) => scene.id)
  };
  writeTextAtomic(indexPath, jsonText(index));
}

function writeAggregate(scenes) {
  const sorted = sortScenes(scenes);
  writeTextAtomic(aggregatePath, jsonText(sorted));
  const groups = writeBrowserShards(sorted);
  writeCoreAndIndex(sorted, readCuration(), groups);
}

function writeSceneSet(scenes) {
  writeSceneShards(scenes);
  writeAggregate(scenes);
}

function aggregateIsCurrent(scenes) {
  const sorted = sortScenes(scenes);
  if (!fs.existsSync(aggregatePath)) return false;
  if (fs.readFileSync(aggregatePath, 'utf8') !== jsonText(sorted)) return false;
  const expected = groupBrowserShards(sorted);
  for (const char of Object.keys(expected)) {
    if (fs.readFileSync(browserShardPath[char], 'utf8') !== jsonText(expected[char])) return false;
  }
  // 校验 core / index 时先写入内存版本再比较磁盘，避免 --check 污染文件
  const byId = new Map(sorted.map((scene) => [scene.id, scene]));
  const curation = readCuration();
  const coreIds = tierIds(curation, 'personaCoreSceneIds').filter((id) => byId.has(id));
  if (fs.readFileSync(corePath, 'utf8') !== jsonText(coreIds.map((id) => byId.get(id)))) return false;
  const index = {
    version: 1,
    total: sorted.length,
    shards: {
      nene: { file: 'scenes-nene.json', count: expected.nene.length },
      natsume: { file: 'scenes-natsume.json', count: expected.natsume.length },
      shared: { file: 'scenes-shared.json', count: expected.shared.length }
    },
    tiers: { core: coreIds },
    orderedIds: sorted.map((scene) => scene.id)
  };
  return fs.readFileSync(indexPath, 'utf8') === jsonText(index);
}

module.exports = {
  aggregatePath,
  browserShardPath,
  corePath,
  indexPath,
  jsonText,
  loadSceneShards,
  readJson,
  sortScenes,
  writeAggregate,
  writeSceneSet,
  writeSceneShards,
  aggregateIsCurrent
};
