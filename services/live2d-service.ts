'use strict';

import * as fs from 'fs';
import * as path from 'path';

interface Live2dFileReferences {
  Moc?: string;
  Physics?: string;
  Pose?: string;
  DisplayInfo?: string;
  Textures?: string[];
  Expressions?: Array<{ File?: string } | null | undefined>;
  Motions?: Record<string, Array<{ File?: string; Sound?: string } | null | undefined> | undefined>;
}

interface Live2dManifest {
  FileReferences?: Live2dFileReferences;
}

interface ModelInspection {
  available: boolean;
  modelUrl: string;
  source: string;
  missing: string[];
  canvas?: { width: number; height: number };
}

interface Live2dServiceOptions {
  rootDir: string;
  characters?: string[];
}

interface Live2dStatus {
  available: boolean;
  characters: string[];
  models: Record<string, ModelInspection>;
}

function safeReference(modelDir: string, reference: string): string {
  if (!reference || typeof reference !== 'string') return '';
  const resolved = path.resolve(modelDir, reference);
  const root = path.resolve(modelDir) + path.sep;
  return resolved.startsWith(root) ? resolved : '';
}

function collectReferences(manifest: Live2dManifest | null | undefined): string[] {
  const refs: string[] = [];
  const files = (manifest && manifest.FileReferences) || {};
  (['Moc', 'Physics', 'Pose', 'DisplayInfo'] as const).forEach(function (key) {
    const value = files[key];
    if (value) refs.push(value);
  });
  (files.Textures || []).forEach(function (item) {
    refs.push(item);
  });
  (files.Expressions || []).forEach(function (item) {
    if (item && item.File) refs.push(item.File);
  });
  Object.keys(files.Motions || {}).forEach(function (group) {
    const motions = (files.Motions && files.Motions[group]) || [];
    motions.forEach(function (item) {
      if (item && item.File) refs.push(item.File);
      if (item && item.Sound) refs.push(item.Sound);
    });
  });
  return refs;
}

function inspectModel(rootDir: string, character: string): ModelInspection {
  const modelDir = path.join(rootDir, character);
  const manifestName = character + '.model3.json';
  const manifestPath = path.join(modelDir, manifestName);
  const result: ModelInspection = {
    available: false,
    modelUrl: '',
    source: 'missing',
    missing: []
  };
  if (!fs.existsSync(manifestPath)) return result;

  let manifest: Live2dManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Live2dManifest;
  } catch {
    result.source = 'invalid-manifest';
    result.missing = [manifestName];
    return result;
  }

  collectReferences(manifest).forEach(function (reference) {
    const target = safeReference(modelDir, reference);
    if (!target || !fs.existsSync(target)) result.missing.push(reference);
  });
  result.available = result.missing.length === 0;
  result.modelUrl = result.available
    ? '/assets/live2d-current/' + encodeURIComponent(character) + '/' + manifestName
    : '';
  result.source = result.available ? 'project-local' : 'incomplete-model';
  result.canvas = { width: 420, height: 610 };
  return result;
}

function createLive2dService(options: Live2dServiceOptions) {
  const rootDir = options.rootDir;
  const characters = options.characters || ['nene', 'natsume'];

  function status(): Live2dStatus {
    const models: Record<string, ModelInspection> = {};
    characters.forEach(function (character) {
      models[character] = inspectModel(rootDir, character);
    });
    const availableCharacters = characters.filter(function (character) {
      return models[character].available;
    });
    return {
      available: availableCharacters.length > 0,
      characters: availableCharacters,
      models: models
    };
  }

  return { status: status };
}

export = {
  createLive2dService: createLive2dService,
  inspectModel: inspectModel,
  collectReferences: collectReferences
};
