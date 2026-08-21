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

// 检查结果缓存：桌面壳每 5s 轮询 /api/health（server.js），每次都会对每个角色
// 重读解析 model3.json 并逐个 existsSync 全部引用文件（宁宁约 10 个）。模型文件
// 运行期不变，按 manifest 的 (mtimeMs,size) 失效 + 短 TTL 兜底（修复缺失资源后
// 一个轮询周期内可见）（2026-08-21 性能审计 #5）。
interface InspectCacheEntry {
  mtimeMs: number;
  size: number;
  at: number;
  result: ModelInspection;
}

const INSPECT_CACHE_TTL_MS = 4000;
const INSPECT_CACHE_LIMIT = 16;
const inspectCache = new Map<string, InspectCacheEntry>();

function readManifestStat(manifestPath: string): fs.Stats | null {
  try {
    return fs.statSync(manifestPath);
  } catch {
    return null;
  }
}

function inspectModel(rootDir: string, character: string): ModelInspection {
  const modelDir = path.join(rootDir, character);
  const manifestName = character + '.model3.json';
  const manifestPath = path.join(modelDir, manifestName);
  const stat = readManifestStat(manifestPath);
  if (!stat) {
    return { available:false, modelUrl:'', source:'missing', missing:[] };
  }

  const now = Date.now();
  const cached = inspectCache.get(manifestPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size
    && now - cached.at < INSPECT_CACHE_TTL_MS) {
    // 浅拷贝防调用方改写共享对象
    return Object.assign({}, cached.result);
  }

  const result: ModelInspection = {
    available: false,
    modelUrl: '',
    source: 'missing',
    missing: []
  };

  let manifest: Live2dManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Live2dManifest;
  } catch {
    result.source = 'invalid-manifest';
    result.missing = [manifestName];
    if (inspectCache.size >= INSPECT_CACHE_LIMIT) inspectCache.clear();
    inspectCache.set(manifestPath, { mtimeMs:stat.mtimeMs, size:stat.size, at:now, result });
    return Object.assign({}, result);
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
  if (inspectCache.size >= INSPECT_CACHE_LIMIT) inspectCache.clear();
  inspectCache.set(manifestPath, { mtimeMs:stat.mtimeMs, size:stat.size, at:now, result });
  return Object.assign({}, result);
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
