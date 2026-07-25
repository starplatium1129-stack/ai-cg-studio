const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const dataDir = path.join(root, 'data');
const shardsDir = path.join(dataDir, 'scenes');
const manifestPath = path.join(shardsDir, 'manifest.json');
const aggregatePath = path.join(dataDir, 'scenes.json');

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

function writeAggregate(scenes) {
  writeTextAtomic(aggregatePath, jsonText(sortScenes(scenes)));
}

function writeSceneSet(scenes) {
  writeSceneShards(scenes);
  writeAggregate(scenes);
}

function aggregateIsCurrent(scenes) {
  if (!fs.existsSync(aggregatePath)) return false;
  return fs.readFileSync(aggregatePath, 'utf8') === jsonText(sortScenes(scenes));
}

module.exports = {
  aggregatePath,
  jsonText,
  loadSceneShards,
  readJson,
  sortScenes,
  writeAggregate,
  writeSceneSet,
  writeSceneShards,
  aggregateIsCurrent
};
