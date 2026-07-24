'use strict';

var fs = require('fs');
var path = require('path');

function safeReference(modelDir, reference) {
  if (!reference || typeof reference !== 'string') return '';
  var resolved = path.resolve(modelDir, reference);
  var root = path.resolve(modelDir) + path.sep;
  return resolved.startsWith(root) ? resolved : '';
}

function collectReferences(manifest) {
  var refs = [];
  var files = manifest && manifest.FileReferences || {};
  ['Moc', 'Physics', 'Pose', 'DisplayInfo'].forEach(function (key) {
    if (files[key]) refs.push(files[key]);
  });
  (files.Textures || []).forEach(function (item) { refs.push(item); });
  (files.Expressions || []).forEach(function (item) { if (item && item.File) refs.push(item.File); });
  Object.keys(files.Motions || {}).forEach(function (group) {
    (files.Motions[group] || []).forEach(function (item) {
      if (item && item.File) refs.push(item.File);
      if (item && item.Sound) refs.push(item.Sound);
    });
  });
  return refs;
}

function inspectModel(rootDir, character) {
  var modelDir = path.join(rootDir, character);
  var manifestName = character + '.model3.json';
  var manifestPath = path.join(modelDir, manifestName);
  var result = {
    available:false,
    modelUrl:'',
    source:'missing',
    missing:[]
  };
  if (!fs.existsSync(manifestPath)) return result;

  var manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    result.source = 'invalid-manifest';
    result.missing = [manifestName];
    return result;
  }

  collectReferences(manifest).forEach(function (reference) {
    var target = safeReference(modelDir, reference);
    if (!target || !fs.existsSync(target)) result.missing.push(reference);
  });
  result.available = result.missing.length === 0;
  result.modelUrl = result.available ? '/assets/live2d/' + encodeURIComponent(character) + '/' + manifestName : '';
  result.source = result.available ? 'project-local' : 'incomplete-model';
  result.canvas = { width:420, height:610 };
  return result;
}

function createLive2dService(options) {
  var rootDir = options.rootDir;
  var characters = options.characters || ['nene', 'natsume'];

  function status() {
    var models = {};
    characters.forEach(function (character) {
      models[character] = inspectModel(rootDir, character);
    });
    var availableCharacters = characters.filter(function (character) { return models[character].available; });
    return {
      available:availableCharacters.length > 0,
      characters:availableCharacters,
      models:models
    };
  }

  return { status:status };
}

module.exports = {
  createLive2dService:createLive2dService,
  inspectModel:inspectModel,
  collectReferences:collectReferences
};
