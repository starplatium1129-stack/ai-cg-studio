'use strict';

/**
 * Local character-training job manager.
 *
 * This service deliberately exposes a very small, fixed command surface.  The
 * browser can select one of the four known jobs, but it can never provide a
 * path, executable, script name, or argv.  All mutable state lives under the
 * gateway runtime directory so a page refresh (or a gateway restart) does not
 * make a running job disappear from the UI.
 */

import fs = require('fs');
import path = require('path');
import childProcess = require('child_process');

const JOB_IDS = ['lora-nene-v18', 'lora-natsume-v18', 'voice-nene', 'voice-natsume'] as const;
type TrainingJobId = (typeof JOB_IDS)[number];
type JobKind = 'lora' | 'voice';
type JobStatus = 'idle' | 'running' | 'stopping' | 'completed' | 'failed' | 'stopped';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const LOG_MAX_BYTES_DEFAULT = 1024 * 1024;
const LOG_READ_MAX_BYTES = 64 * 1024;
const STATE_FILE_NAME = 'jobs.json';
const ANSI_RE = /\u001b\][0-?]*[ -/]*[@-~]|\u001b\[[0-?]*[ -/]*[@-~]/g;
const VOICE_DATASET_VERSION = 'datasets-v16';
const VOICE_EXPERIMENT_SUFFIX = 'voice-v16';

interface TrainingProgress {
  stage: string;
  message: string;
  percent: number;
  epoch?: number;
  epochs?: number;
  step?: number;
  steps?: number;
  loss?: number;
}

interface PersistedJobState {
  id: TrainingJobId;
  status: JobStatus;
  pid: number;
  startedAt: number;
  finishedAt: number;
  exitCode: number | null;
  error: string;
  stopRequested: boolean;
  runCount: number;
  logVersion: number;
  progress: TrainingProgress;
}

interface JobDefinition {
  id: TrainingJobId;
  kind: JobKind;
  character: 'nene' | 'natsume';
  label: string;
  datasetId: string;
}

interface DatasetSummary {
  id: string;
  kind: JobKind;
  character: 'nene' | 'natsume';
  version: string;
  ready: boolean;
  images: number;
  captions: number;
  bytes: number;
  categories: Record<string, number>;
  trainSamples?: number;
  evalSamples?: number;
  testSamples?: number;
  wavs?: number;
  missing: string[];
  preview: {
    available: boolean;
    label: string;
    blurred: boolean;
  };
  adultPreview: {
    available: boolean;
    label: string;
    blurred: boolean;
  };
}

interface DatasetPreviewFile {
  filePath: string;
  contentType: 'image/jpeg';
  label: string;
  blurred: boolean;
}

interface JobInspection {
  definition: JobDefinition;
  ready: boolean;
  missing: string[];
  configName?: string;
  datasetPath: string;
  executablePath: string;
  scriptPath: string;
  cwd: string;
  args: string[];
}

interface PublicJob {
  id: TrainingJobId;
  kind: JobKind;
  character: 'nene' | 'natsume';
  label: string;
  datasetId: string;
  ready: boolean;
  missing: string[];
  configName?: string;
  status: JobStatus;
  pid: number;
  startedAt: number;
  finishedAt: number;
  exitCode: number | null;
  error: string;
  runCount: number;
  logVersion: number;
  progress: TrainingProgress;
}

interface TrainingServiceOptions {
  aiRoot: string;
  runtimeRoot: string;
  spawn?: SpawnFunction;
  killProcess?: (pid: number, child?: ChildHandle) => void;
  now?: () => number;
  platform?: NodeJS.Platform;
  logMaxBytes?: number;
}

interface ChildStream {
  on(event: 'data', listener: (chunk: Buffer | string) => void): unknown;
}

interface ChildHandle {
  pid?: number;
  stdout?: ChildStream | null;
  stderr?: ChildStream | null;
  once(event: 'error' | 'close', listener: (...args: unknown[]) => void): unknown;
  kill?: (signal?: NodeJS.Signals | number) => boolean;
}

type SpawnFunction = (
  command: string,
  args: string[],
  options: childProcess.SpawnOptions,
) => ChildHandle;

class TrainingServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, code: string, status: number, detail?: string) {
    super(message);
    this.name = 'TrainingServiceError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const DEFINITIONS: readonly JobDefinition[] = [
  {
    id: 'lora-nene-v18',
    kind: 'lora',
    character: 'nene',
    label: '宁宁 LoRA v18',
    datasetId: 'lora-nene-v18',
  },
  {
    id: 'lora-natsume-v18',
    kind: 'lora',
    character: 'natsume',
    label: '夏目 LoRA v18',
    datasetId: 'lora-natsume-v18',
  },
  {
    id: 'voice-nene',
    kind: 'voice',
    character: 'nene',
    label: '宁宁角色语音',
    datasetId: 'voice-nene',
  },
  {
    id: 'voice-natsume',
    kind: 'voice',
    character: 'natsume',
    label: '夏目角色语音',
    datasetId: 'voice-natsume',
  },
];

const DATASET_PREVIEWS: Readonly<Record<string, {
  relativePath: string;
  label: string;
  blurred: boolean;
}>> = {
  'lora-nene-v18': {
    relativePath: path.join(
      'Reviews',
      'ModelEvaluations',
      'nene_v18_wd14_gate_2026-07-30',
      'final',
      'blinded_sheets',
      'witch-canonical-full-body_seed-1038976852.jpg',
    ),
    label: '宁宁魔女服训练样本审核表',
    blurred: false,
  },
  'lora-natsume-v18': {
    relativePath: path.join(
      'Reviews',
      'ModelEvaluations',
      'natsume_v18_wd14_gate_2026-07-30',
      'final',
      'blinded_sheets',
      'qipao-canonical-full-body_seed-1038976852.jpg',
    ),
    label: '夏目旗袍服训练样本审核表',
    blurred: false,
  },
};

const DATASET_ADULT_PREVIEWS: Readonly<Record<string, {
  relativePath: string;
  label: string;
  blurred: boolean;
}>> = {
  'lora-nene-v18': {
    relativePath: path.join(
      'Reviews',
      'ModelEvaluations',
      'nene_v18_wd14_gate_2026-07-30',
      'final',
      'blinded_sheets',
      'r18-solo-body-identity_seed-1038976852.jpg',
    ),
    label: '宁宁 R18 分层样本（默认模糊）',
    blurred: true,
  },
  'lora-natsume-v18': {
    relativePath: path.join(
      'Reviews',
      'ModelEvaluations',
      'natsume_v18_wd14_gate_2026-07-30',
      'final',
      'blinded_sheets',
      'r18-solo-body-identity_seed-1038976852.jpg',
    ),
    label: '夏目 R18 分层样本（默认模糊）',
    blurred: true,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJobId(value: unknown): value is TrainingJobId {
  return typeof value === 'string' && (JOB_IDS as readonly string[]).includes(value);
}

function definitionFor(id: TrainingJobId): JobDefinition {
  return DEFINITIONS.find((item) => item.id === id)!;
}

function ensureDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true });
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  ensureDirectory(path.dirname(file));
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, file);
  } catch (error) {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      // Keep the original write error as the useful failure.
    }
    throw error;
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function defaultProgress(): TrainingProgress {
  return { stage: '待开始', message: '', percent: 0 };
}

function defaultState(id: TrainingJobId): PersistedJobState {
  return {
    id,
    status: 'idle',
    pid: 0,
    startedAt: 0,
    finishedAt: 0,
    exitCode: null,
    error: '',
    stopRequested: false,
    runCount: 0,
    logVersion: 0,
    progress: defaultProgress(),
  };
}

function normalizeProgress(value: unknown): TrainingProgress {
  if (!isRecord(value)) return defaultProgress();
  const progress: TrainingProgress = {
    stage: typeof value.stage === 'string' ? value.stage.slice(0, 80) : '待开始',
    message: typeof value.message === 'string' ? value.message.slice(0, 240) : '',
    percent: clampPercent(finiteNumber(value.percent, 0)),
  };
  for (const key of ['epoch', 'epochs', 'step', 'steps'] as const) {
    const number = Number(value[key]);
    if (Number.isFinite(number) && number >= 0) progress[key] = Math.round(number);
  }
  const loss = Number(value.loss);
  if (Number.isFinite(loss)) progress.loss = loss;
  return progress;
}

function normalizeState(id: TrainingJobId, value: unknown): PersistedJobState {
  const fallback = defaultState(id);
  if (!isRecord(value)) return fallback;
  const allowedStatuses: JobStatus[] = ['idle', 'running', 'stopping', 'completed', 'failed', 'stopped'];
  const status = allowedStatuses.includes(String(value.status) as JobStatus)
    ? (String(value.status) as JobStatus)
    : fallback.status;
  return {
    id,
    status,
    pid: Math.max(0, Math.round(finiteNumber(value.pid, 0))),
    startedAt: Math.max(0, Math.round(finiteNumber(value.startedAt, 0))),
    finishedAt: Math.max(0, Math.round(finiteNumber(value.finishedAt, 0))),
    exitCode: value.exitCode == null ? null : Math.round(finiteNumber(value.exitCode, 1)),
    error: typeof value.error === 'string' ? value.error.slice(0, 1000) : '',
    stopRequested: value.stopRequested === true,
    runCount: Math.max(0, Math.round(finiteNumber(value.runCount, 0))),
    logVersion: Math.max(0, Math.round(finiteNumber(value.logVersion, 0))),
    progress: normalizeProgress(value.progress),
  };
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_RE, '').replace(/\u0000/g, '');
}

function normalizeLogChunk(value: Buffer | string): string {
  return stripAnsi(Buffer.isBuffer(value) ? value.toString('utf8') : String(value))
    .replace(/\r(?!\n)/g, '\n');
}

function tailMessage(value: string): string {
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines[lines.length - 1].slice(0, 240) : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactWorkspacePath(value: string, aiRoot: string): string {
  const normalizedRoot = path.resolve(aiRoot).replace(/[\\/]+$/, '');
  const expression = new RegExp(escapeRegExp(normalizedRoot).replace(/\\/g, '[\\\\/]'), 'gi');
  return value.replace(expression, '[AI]');
}

function parseProgress(
  state: PersistedJobState,
  text: string,
  definition: JobDefinition,
  aiRoot: string,
): void {
  const clean = stripAnsi(text);
  const message = tailMessage(clean);
  if (message) state.progress.message = redactWorkspacePath(message, aiRoot);

  const epochMatches = [...clean.matchAll(/epoch:\s*(\d+)%.*?\|\s*(\d+)\s*\/\s*(\d+)/gi)];
  const stepMatches = [...clean.matchAll(/step:\s*(\d+)%.*?\|\s*(\d+)\s*\/\s*(\d+).*?(?:loss=([0-9.e+-]+))?/gi)];
  const epoch = epochMatches[epochMatches.length - 1];
  const step = stepMatches[stepMatches.length - 1];
  if (epoch) {
    state.progress.epoch = Number(epoch[2]);
    state.progress.epochs = Number(epoch[3]);
    state.progress.stage = 'LoRA 训练';
    state.progress.percent = clampPercent((state.progress.epoch / Math.max(1, state.progress.epochs)) * 100);
  }
  if (step) {
    state.progress.step = Number(step[2]);
    state.progress.steps = Number(step[3]);
    if (step[4] != null) state.progress.loss = Number(step[4]);
    if (definition.kind === 'lora') {
      state.progress.stage = 'LoRA 训练';
      const epochNumber = state.progress.epoch || 0;
      const epochs = state.progress.epochs || 0;
      const stepPercent = Number(step[2]) / Math.max(1, Number(step[3]));
      state.progress.percent = clampPercent(
        epochs ? ((Math.max(0, epochNumber - 1) + stepPercent) / epochs) * 100 : stepPercent * 100,
      );
    }
  }

  if (definition.kind === 'voice') {
    if (/1-get-text|2-get-hubert|2-get-sv|3-get-semantic/i.test(clean)) {
      state.progress.stage = '准备语音数据';
      state.progress.percent = Math.max(state.progress.percent, 20);
    } else if (/s2_train|train-sovits/i.test(clean)) {
      state.progress.stage = 'SoVITS 训练';
      state.progress.percent = Math.max(state.progress.percent, 50);
    } else if (/s1_train|train-gpt/i.test(clean)) {
      state.progress.stage = 'GPT 训练';
      state.progress.percent = Math.max(state.progress.percent, 75);
    } else if (/evaluation|evaluate|评测/i.test(clean)) {
      state.progress.stage = '语音评测';
      state.progress.percent = Math.max(state.progress.percent, 90);
    }
  }
}

function walkDataset(root: string): {
  images: number;
  captions: number;
  bytes: number;
  categories: Record<string, number>;
} {
  const result = { images: 0, captions: 0, bytes: 0, categories: {} as Record<string, number> };
  if (!fs.existsSync(root)) return result;
  const stack: Array<{ directory: string; category: string }> = [{ directory: root, category: '' }];
  let visited = 0;
  while (stack.length && visited < 20000) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      visited += 1;
      if (visited >= 20000) break;
      const absolute = path.join(current.directory, entry.name);
      if (entry.isDirectory()) {
        stack.push({
          directory: absolute,
          category: current.category || entry.name,
        });
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(extension)) {
        result.images += 1;
        try {
          result.bytes += fs.statSync(absolute).size;
        } catch {
          // A file can disappear while the directory is being inspected.
        }
        const category = current.category || 'root';
        result.categories[category] = (result.categories[category] || 0) + 1;
      } else if (extension === '.txt') {
        result.captions += 1;
      }
    }
  }
  return result;
}

function countLines(file: string): number {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text.split(/\r?\n/).filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

function countFiles(directory: string, extension: string): number {
  if (!fs.existsSync(directory)) return 0;
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === extension)
      .length;
  } catch {
    return 0;
  }
}

function findV18Config(configDirectory: string, character: 'nene' | 'natsume'): string {
  const name = character === 'nene'
    ? 'ayachi_nene_v18_wd14_curated.json'
    : 'shiki_natsume_v18_wd14_balanced_r18.json';
  const file = path.join(configDirectory, name);
  return fs.existsSync(file) ? file : '';
}

function defaultKillProcess(
  pid: number,
  child: ChildHandle | undefined,
  platform: NodeJS.Platform,
): void {
  if (platform === 'win32') {
    try {
      childProcess.execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
        windowsHide: true,
        shell: false,
        stdio: 'ignore',
      });
      return;
    } catch {
      // The process may have exited between the status check and taskkill.
    }
  }
  if (child?.kill) {
    child.kill(platform === 'win32' ? 'SIGTERM' : 'SIGTERM');
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Treat an already exited process as stopped.
  }
}

function processAlive(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    return code === 'EPERM';
  }
}

function createTrainingService(options: TrainingServiceOptions) {
  const aiRoot = path.resolve(options.aiRoot);
  const runtimeRoot = path.resolve(options.runtimeRoot);
  const trainingRoot = path.join(runtimeRoot, 'training');
  const logRoot = path.join(trainingRoot, 'logs');
  const stateFile = path.join(trainingRoot, STATE_FILE_NAME);
  const now = options.now || (() => Date.now());
  const platform = options.platform || process.platform;
  const logMaxBytes = Math.max(64 * 1024, Math.round(options.logMaxBytes || LOG_MAX_BYTES_DEFAULT));
  const spawn: SpawnFunction = options.spawn || ((command, args, spawnOptions) =>
    childProcess.spawn(command, args, spawnOptions) as unknown as ChildHandle);
  const killProcess = options.killProcess || ((pid, child) => defaultKillProcess(pid, child, platform));
  const states = new Map<TrainingJobId, PersistedJobState>();
  const children = new Map<TrainingJobId, ChildHandle>();
  const parserBuffers = new Map<TrainingJobId, string>();
  const persistTimers = new Map<TrainingJobId, ReturnType<typeof setTimeout>>();

  ensureDirectory(trainingRoot);
  ensureDirectory(logRoot);

  const saved = readJson(stateFile);
  const savedJobs = isRecord(saved) && isRecord(saved.jobs) ? saved.jobs : {};
  for (const id of JOB_IDS) {
    const state = normalizeState(id, savedJobs[id]);
    if ((state.status === 'running' || state.status === 'stopping') && !processAlive(state.pid)) {
      state.status = state.stopRequested ? 'stopped' : 'failed';
      state.finishedAt = now();
      state.error = state.stopRequested ? '' : '网关重启后未发现训练进程';
      state.progress.stage = state.stopRequested ? '已停止' : '进程已丢失';
      state.progress.message = state.error;
      state.stopRequested = false;
    }
    states.set(id, state);
  }
  writeJsonAtomic(stateFile, { version: 1, jobs: Object.fromEntries(states) });

  function stateFor(id: TrainingJobId): PersistedJobState {
    return states.get(id)!;
  }

  function saveStates(): void {
    writeJsonAtomic(stateFile, { version: 1, jobs: Object.fromEntries(states) });
  }

  function schedulePersist(id: TrainingJobId): void {
    if (persistTimers.has(id)) return;
    const timer = setTimeout(() => {
      persistTimers.delete(id);
      try {
        saveStates();
      } catch (error) {
        console.error('  ❌ 保存训练状态失败:', error instanceof Error ? error.message : error);
      }
    }, 250);
    timer.unref?.();
    persistTimers.set(id, timer);
  }

  function logFileFor(id: TrainingJobId): string {
    return path.join(logRoot, `${id}.log`);
  }

  function appendBoundedLog(id: TrainingJobId, value: string): boolean {
    if (!value) return false;
    const file = logFileFor(id);
    ensureDirectory(path.dirname(file));
    fs.appendFileSync(file, value, 'utf8');
    let size = 0;
    try {
      size = fs.statSync(file).size;
    } catch {
      return false;
    }
    if (size <= logMaxBytes) return false;
    const keepBytes = Math.floor(logMaxBytes * 0.75);
    const start = Math.max(0, size - keepBytes);
    const fd = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(size - start);
    try {
      fs.readSync(fd, buffer, 0, buffer.length, start);
    } finally {
      fs.closeSync(fd);
    }
    const firstBreak = buffer.indexOf(0x0a);
    const tail = firstBreak >= 0 ? buffer.subarray(firstBreak + 1) : buffer;
    fs.writeFileSync(file, tail);
    stateFor(id).logVersion += 1;
    return true;
  }

  function inspectJob(id: TrainingJobId): JobInspection {
    const definition = definitionFor(id);
    const oneTrainerRoot = path.join(aiRoot, 'OneTrainer');
    const voiceRoot = path.join(aiRoot, 'Voice');
    const pythonOneTrainer = path.join(oneTrainerRoot, 'venv', 'Scripts', 'python.exe');
    const oneTrainerScript = path.join(oneTrainerRoot, 'scripts', 'train.py');
    const voicePython = path.join(aiRoot, 'GPT-SoVITS-env', 'python.exe');
    const voiceScript = path.join(voiceRoot, 'tools', 'train_gpt_sovits_character.py');
    const missing: string[] = [];
    let datasetPath = '';
    let executablePath = '';
    let scriptPath = '';
    let cwd = '';
    let args: string[] = [];
    let configName = '';

    if (definition.kind === 'lora') {
      datasetPath = definition.character === 'nene'
        ? path.join(aiRoot, 'Datasets', 'Characters', 'Ayachi_Nene', 'V18_WD14_Curated')
        : path.join(aiRoot, 'Datasets', 'Characters', 'Shiki_Natsume', 'V17_WD14_Curated');
      executablePath = pythonOneTrainer;
      scriptPath = oneTrainerScript;
      cwd = oneTrainerRoot;
      const configPath = findV18Config(path.join(oneTrainerRoot, 'training_configs'), definition.character);
      configName = configPath ? path.basename(configPath) : '';
      args = configPath ? ['--config-path', configPath] : [];
      if (!fs.existsSync(pythonOneTrainer)) missing.push('OneTrainer Python 环境未安装');
      if (!fs.existsSync(oneTrainerScript)) missing.push('OneTrainer CLI 尚未安装');
      if (!configPath) missing.push('v18 训练配置尚未准备');
      const dataset = walkDataset(datasetPath);
      if (!fs.existsSync(datasetPath) || dataset.images === 0) missing.push('v18 图片数据集尚未准备');
    } else {
      datasetPath = path.join(
        voiceRoot,
        VOICE_DATASET_VERSION,
        definition.character,
      );
      executablePath = voicePython;
      scriptPath = voiceScript;
      cwd = voiceRoot;
      const version = definition.character === 'nene' ? 'v2ProPlus' : 'v2Pro';
      const datasetRoot = path.dirname(datasetPath);
      args = [
        scriptPath,
        '--character',
        definition.character,
        '--version',
        version,
        '--dataset-root',
        datasetRoot,
        '--experiment-suffix',
        VOICE_EXPERIMENT_SUFFIX,
      ];
      if (!fs.existsSync(voicePython)) missing.push('GPT-SoVITS Python 环境未安装');
      if (!fs.existsSync(voiceScript)) missing.push('语音训练脚本尚未安装');
      if (!fs.existsSync(datasetPath)) missing.push('角色语音数据集尚未准备');
      if (!fs.existsSync(path.join(datasetPath, 'train.list'))) missing.push('语音训练清单尚未准备');
      if (!fs.existsSync(path.join(datasetPath, 'eval.list'))) missing.push('语音留出评测清单尚未准备');
      if (!fs.existsSync(path.join(datasetPath, 'test.list'))) missing.push('语音封闭测试清单尚未准备');
      if (!fs.existsSync(path.join(datasetPath, 'wavs'))) missing.push('语音 wav 目录尚未准备');
      if (!fs.existsSync(path.join(aiRoot, 'GPT-SoVITS'))) missing.push('GPT-SoVITS 代码目录未找到');
    }

    return {
      definition,
      ready: missing.length === 0,
      missing,
      configName: configName || undefined,
      datasetPath,
      executablePath,
      scriptPath,
      cwd,
      args,
    };
  }

  function publicJob(id: TrainingJobId): PublicJob {
    const state = stateFor(id);
    const inspection = inspectJob(id);
    return {
      id,
      kind: inspection.definition.kind,
      character: inspection.definition.character,
      label: inspection.definition.label,
      datasetId: inspection.definition.datasetId,
      ready: inspection.ready,
      missing: inspection.missing,
      configName: inspection.configName,
      status: state.status,
      pid: state.pid,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      exitCode: state.exitCode,
      error: state.error,
      runCount: state.runCount,
      logVersion: state.logVersion,
      progress: { ...state.progress },
    };
  }

  function previewSummary(
    datasetId: string,
    definitions: typeof DATASET_PREVIEWS = DATASET_PREVIEWS,
  ): DatasetSummary['preview'] {
    const preview = definitions[datasetId];
    if (!preview) {
      return { available: false, label: '', blurred: false };
    }
    const filePath = path.resolve(aiRoot, preview.relativePath);
    const relative = path.relative(aiRoot, filePath);
    const contained = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
    return {
      available: contained && fs.existsSync(filePath),
      label: preview.label,
      blurred: preview.blurred,
    };
  }

  function getDatasetPreview(datasetId: string, variant: 'signature' | 'adult' = 'signature'): DatasetPreviewFile {
    const definitions = variant === 'adult' ? DATASET_ADULT_PREVIEWS : DATASET_PREVIEWS;
    const preview = definitions[datasetId];
    if (!preview) {
      throw new TrainingServiceError('该数据集没有图像审核样张', 'PREVIEW_UNAVAILABLE', 404);
    }
    const filePath = path.resolve(aiRoot, preview.relativePath);
    const relative = path.relative(aiRoot, filePath);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new TrainingServiceError('审核样张路径不安全', 'PREVIEW_PATH_INVALID', 500);
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new TrainingServiceError('图像审核样张尚未生成', 'PREVIEW_NOT_READY', 404);
    }
    return {
      filePath,
      contentType: 'image/jpeg',
      label: preview.label,
      blurred: preview.blurred,
    };
  }

  function datasetSummary(definition: JobDefinition): DatasetSummary {
    const inspection = inspectJob(definition.id);
    if (definition.kind === 'lora') {
      const scanned = walkDataset(inspection.datasetPath);
      return {
        id: definition.datasetId,
        kind: 'lora',
        character: definition.character,
        version: 'v18',
        ready: scanned.images > 0 && fs.existsSync(inspection.datasetPath),
        images: scanned.images,
        captions: scanned.captions,
        bytes: scanned.bytes,
        categories: scanned.categories,
        missing: inspection.missing.filter((item) => /数据集|图片/.test(item)),
        preview: previewSummary(definition.datasetId),
        adultPreview: previewSummary(definition.datasetId, DATASET_ADULT_PREVIEWS),
      };
    }
    const wavRoot = path.join(inspection.datasetPath, 'wavs');
    const trainList = path.join(inspection.datasetPath, 'train.list');
    const evalList = path.join(inspection.datasetPath, 'eval.list');
    const testList = path.join(inspection.datasetPath, 'test.list');
    const wavs = countFiles(wavRoot, '.wav');
    return {
      id: definition.datasetId,
      kind: 'voice',
      character: definition.character,
      version: VOICE_DATASET_VERSION,
      ready: wavs > 0
        && fs.existsSync(trainList)
        && fs.existsSync(evalList)
        && fs.existsSync(testList),
      images: 0,
      captions: 0,
      bytes: 0,
      categories: {},
      trainSamples: countLines(trainList),
      evalSamples: countLines(evalList),
      testSamples: countLines(testList),
      wavs,
      missing: inspection.missing.filter((item) => /语音数据集|训练清单|wav/.test(item)),
      preview: previewSummary(definition.datasetId),
      adultPreview: previewSummary(definition.datasetId, DATASET_ADULT_PREVIEWS),
    };
  }

  function listDatasets(): { datasets: DatasetSummary[] } {
    return { datasets: DEFINITIONS.map(datasetSummary) };
  }

  function listJobs(): { jobs: PublicJob[] } {
    return { jobs: JOB_IDS.map(publicJob) };
  }

  function overview(): Record<string, unknown> {
    const listed = listJobs().jobs;
    return {
      workspace: {
        available: fs.existsSync(aiRoot),
        name: 'AI',
      },
      activeJobId: listed.find((job) => job.status === 'running' || job.status === 'stopping')?.id || null,
      readyJobs: listed.filter((job) => job.ready).map((job) => job.id),
      datasets: listDatasets().datasets,
      jobs: listed,
    };
  }

  function assertKnownId(value: unknown): TrainingJobId {
    if (!isJobId(value)) {
      throw new TrainingServiceError('不支持的训练任务', 'UNKNOWN_JOB', 404);
    }
    return value;
  }

  function assertNoActiveJob(): void {
    const active = JOB_IDS.map((id) => stateFor(id))
      .find((state) => state.status === 'running' || state.status === 'stopping');
    if (active) {
      const definition = definitionFor(active.id);
      throw new TrainingServiceError(
        `“${definition.label}”仍在进行，请等待当前任务完成`,
        'TRAINING_BUSY',
        409,
      );
    }
  }

  function startJob(value: unknown): PublicJob {
    const id = assertKnownId(value);
    assertNoActiveJob();
    const inspection = inspectJob(id);
    if (!inspection.ready) {
      throw new TrainingServiceError(
        `${inspection.definition.label} 尚未就绪`,
        'NOT_READY',
        409,
        inspection.missing.join('；'),
      );
    }

    const state = stateFor(id);
    const startedAt = now();
    state.status = 'running';
    state.pid = 0;
    state.startedAt = startedAt;
    state.finishedAt = 0;
    state.exitCode = null;
    state.error = '';
    state.stopRequested = false;
    state.runCount += 1;
    state.progress = {
      stage: inspection.definition.kind === 'lora' ? '准备 LoRA 训练' : '准备语音训练',
      message: '任务已提交，正在启动本机训练进程',
      percent: 0,
    };
    const logFile = logFileFor(id);
    ensureDirectory(path.dirname(logFile));
    fs.writeFileSync(logFile, `[${new Date(startedAt).toISOString()}] ${inspection.definition.label} 已提交\n`, 'utf8');
    state.logVersion += 1;
    saveStates();

    let child: ChildHandle;
    try {
      const commandArgs = inspection.definition.kind === 'lora'
        ? [inspection.scriptPath, ...inspection.args]
        : inspection.args;
      child = spawn(inspection.executablePath, commandArgs, {
        cwd: inspection.cwd,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
        },
      });
    } catch (error) {
      state.status = 'failed';
      state.finishedAt = now();
      state.error = error instanceof Error ? error.message : String(error);
      state.progress = { stage: '启动失败', message: state.error, percent: 0 };
      saveStates();
      throw new TrainingServiceError('训练进程启动失败', 'START_FAILED', 503, state.error);
    }

    children.set(id, child);
    state.pid = Math.max(0, Math.round(Number(child.pid) || 0));
    let settled = false;
    let persistAt = 0;
    const consume = (chunk: Buffer | string): void => {
      const text = normalizeLogChunk(chunk);
      if (!text) return;
      const trimmed = text.length > 128 * 1024 ? text.slice(-128 * 1024) : text;
      const trimmedLog = appendBoundedLog(id, trimmed);
      const parserText = `${parserBuffers.get(id) || ''}${trimmed}`.slice(-16 * 1024);
      parserBuffers.set(id, parserText);
      parseProgress(state, parserText, inspection.definition, aiRoot);
      if (trimmedLog) state.progress.message = '日志已滚动保留最近内容';
      const timestamp = now();
      if (timestamp - persistAt >= 1000) {
        persistAt = timestamp;
        schedulePersist(id);
      }
    };
    child.stdout?.on('data', consume);
    child.stderr?.on('data', consume);
    child.once('error', (...args: unknown[]) => {
      if (settled) return;
      settled = true;
      const error = args[0];
      state.status = state.stopRequested ? 'stopped' : 'failed';
      state.finishedAt = now();
      state.exitCode = null;
      state.error = state.stopRequested ? '' : error instanceof Error ? error.message : String(error);
      state.progress = {
        ...state.progress,
        stage: state.stopRequested ? '已停止' : '训练进程错误',
        message: state.error,
        percent: state.stopRequested ? state.progress.percent : Math.min(99, state.progress.percent),
      };
      state.stopRequested = false;
      children.delete(id);
      parserBuffers.delete(id);
      saveStates();
    });
    child.once('close', (...args: unknown[]) => {
      if (settled) return;
      settled = true;
      const code = Number(args[0]);
      state.exitCode = Number.isFinite(code) ? code : null;
      state.status = state.stopRequested ? 'stopped' : code === 0 ? 'completed' : 'failed';
      state.finishedAt = now();
      if (state.status === 'completed') {
        state.error = '';
        state.progress = {
          ...state.progress,
          stage: '已完成',
          message: '训练进程已完成',
          percent: 100,
        };
      } else if (state.status === 'stopped') {
        state.error = '';
        state.progress = {
          ...state.progress,
          stage: '已停止',
          message: '训练已停止',
        };
      } else {
        state.error = `训练进程退出（代码 ${state.exitCode == null ? '未知' : state.exitCode}）`;
        state.progress = {
          ...state.progress,
          stage: '训练失败',
          message: state.error,
        };
      }
      state.stopRequested = false;
      children.delete(id);
      parserBuffers.delete(id);
      saveStates();
    });
    return publicJob(id);
  }

  function stopJob(value: unknown): PublicJob {
    const id = assertKnownId(value);
    const state = stateFor(id);
    if (state.status !== 'running' && state.status !== 'stopping') {
      throw new TrainingServiceError('当前没有正在运行的训练任务', 'NOT_RUNNING', 409);
    }
    if (state.status === 'stopping') return publicJob(id);
    state.stopRequested = true;
    state.status = 'stopping';
    state.progress = { ...state.progress, stage: '正在停止', message: '正在终止训练进程' };
    saveStates();
    const child = children.get(id);
    try {
      if (state.pid) killProcess(state.pid, child);
      else if (child?.kill) child.kill('SIGTERM');
      else throw new Error('训练进程 PID 不可用');
    } catch (error) {
      state.stopRequested = false;
      state.status = 'running';
      state.error = error instanceof Error ? error.message : String(error);
      state.progress = { ...state.progress, stage: '停止失败', message: state.error };
      saveStates();
      throw new TrainingServiceError('停止训练失败', 'STOP_FAILED', 503, state.error);
    }
    if (!child) {
      state.status = 'stopped';
      state.finishedAt = now();
      state.stopRequested = false;
      state.progress = { ...state.progress, stage: '已停止', message: '训练已停止' };
      saveStates();
    }
    return publicJob(id);
  }

  function getLogs(value: unknown, cursorValue: unknown, versionValue: unknown): {
    id: TrainingJobId;
    cursor: number;
    nextCursor: number;
    reset: boolean;
    version: number;
    text: string;
    lines: string[];
  } {
    const id = assertKnownId(value);
    const state = stateFor(id);
    const file = logFileFor(id);
    if (!fs.existsSync(file)) {
      return { id, cursor: 0, nextCursor: 0, reset: false, version: state.logVersion, text: '', lines: [] };
    }
    let size = 0;
    try {
      size = fs.statSync(file).size;
    } catch {
      return { id, cursor: 0, nextCursor: 0, reset: true, version: state.logVersion, text: '', lines: [] };
    }
    let cursor = Number.isFinite(Number(cursorValue)) ? Math.max(0, Math.floor(Number(cursorValue))) : 0;
    const requestedVersion = Number.isFinite(Number(versionValue))
      ? Math.max(0, Math.floor(Number(versionValue)))
      : state.logVersion;
    let reset = requestedVersion !== state.logVersion || cursor > size;
    if (reset || size - cursor > LOG_READ_MAX_BYTES) {
      cursor = Math.max(0, size - LOG_READ_MAX_BYTES);
      reset = true;
    }
    const length = Math.max(0, Math.min(LOG_READ_MAX_BYTES, size - cursor));
    let text = '';
    if (length) {
      const fd = fs.openSync(file, 'r');
      const buffer = Buffer.alloc(length);
      try {
        fs.readSync(fd, buffer, 0, length, cursor);
      } finally {
        fs.closeSync(fd);
      }
      text = buffer.toString('utf8');
    }
    return {
      id,
      cursor,
      nextCursor: cursor + Buffer.byteLength(text),
      reset,
      version: state.logVersion,
      text,
      lines: text.split(/\r?\n/).filter(Boolean),
    };
  }

  function close(): void {
    for (const timer of persistTimers.values()) clearTimeout(timer);
    persistTimers.clear();
    try {
      saveStates();
    } catch (error) {
      console.error('  ❌ 保存训练状态失败:', error instanceof Error ? error.message : error);
    }
  }

  return {
    overview,
    listDatasets,
    listJobs,
    getDatasetPreview,
    getJob: (value: unknown): PublicJob => publicJob(assertKnownId(value)),
    getLogs,
    startJob,
    stopJob,
    close,
    isKnownJobId: isJobId,
    inspectJob: (value: unknown): JobInspection => inspectJob(assertKnownId(value)),
  };
}

export = {
  JOB_IDS,
  TrainingServiceError,
  createTrainingService,
  _test: {
    defaultProgress,
    findV18Config,
    normalizeLogChunk,
    parseProgress,
    walkDataset,
  },
};
