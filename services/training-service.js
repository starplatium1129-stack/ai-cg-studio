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
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const JOB_IDS = ['lora-nene-v18', 'lora-natsume-v18', 'voice-nene', 'voice-natsume'];
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const LOG_MAX_BYTES_DEFAULT = 1024 * 1024;
const LOG_READ_MAX_BYTES = 64 * 1024;
const LOG_FLUSH_DEBOUNCE_MS = 50; // 日志合并落盘的最小间隔
const LOG_FORCE_FLUSH_BYTES = 64 * 1024; // 缓冲超过该值不等 debounce 立即落盘
const LOG_SIZE_CHECK_BYTES = 256 * 1024; // 累计写入超过该值做一次截尾尺寸检查
const STATE_FILE_NAME = 'jobs.json';
const ANSI_RE = /\u001b\][0-?]*[ -/]*[@-~]|\u001b\[[0-?]*[ -/]*[@-~]/g;
const VOICE_DATASET_VERSION = 'datasets-v16';
const VOICE_EXPERIMENT_SUFFIX = 'voice-v16';
const OVERRIDE_RULES = {
    epochs: { min: 1, max: 500, integer: true },
    batch_size: { min: 1, max: 16, integer: true },
    gradient_accumulation_steps: { min: 1, max: 8, integer: true },
    lora_rank: { min: 4, max: 128, integer: true },
    lora_alpha: { min: 4, max: 128, integer: true },
    unet_learning_rate: { min: 1e-7, max: 1e-3 },
    text_encoder_learning_rate: { min: 1e-7, max: 1e-3 },
    text_encoder_stop_epoch: { min: 0, max: 500, integer: true },
};
function sanitizeOverrides(value) {
    if (value === undefined || value === null)
        return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new TrainingServiceError('训练参数格式不正确', 'INVALID_OVERRIDES', 400);
    }
    const overrides = {};
    for (const [key, raw] of Object.entries(value)) {
        const rule = OVERRIDE_RULES[key];
        if (!rule) {
            throw new TrainingServiceError(`不支持的训练参数: ${key}`, 'UNKNOWN_OVERRIDE', 400);
        }
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
            throw new TrainingServiceError(`参数 ${key} 必须是数字`, 'INVALID_OVERRIDE', 400);
        }
        if (rule.integer && !Number.isInteger(raw)) {
            throw new TrainingServiceError(`参数 ${key} 必须是整数`, 'INVALID_OVERRIDE', 400);
        }
        if (raw < rule.min || raw > rule.max) {
            throw new TrainingServiceError(`参数 ${key} 超出允许范围 ${rule.min}–${rule.max}`, 'OVERRIDE_OUT_OF_RANGE', 400);
        }
        overrides[key] = raw;
    }
    return overrides;
}
function asFiniteNumber(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function readJsonObject(filePath) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
/**
 * 把白名单覆盖写进一次性配置副本，返回副本路径。
 * 原配置只读；副本落在 training_configs/.ui_plans/ 下，文件名带时间戳，
 * 避免与 OneTrainer 的 prevent_overwrites 冲突。
 */
function applyOverridesToConfig(configPath, overrides, id, stamp = Date.now) {
    if (Object.keys(overrides).length === 0)
        return configPath;
    const config = readJsonObject(configPath);
    if (Object.keys(config).length === 0) {
        throw new TrainingServiceError('无法读取训练配置，不能应用参数覆盖', 'CONFIG_UNREADABLE', 409);
    }
    if (overrides.epochs !== undefined)
        config.epochs = overrides.epochs;
    if (overrides.batch_size !== undefined)
        config.batch_size = overrides.batch_size;
    if (overrides.gradient_accumulation_steps !== undefined) {
        config.gradient_accumulation_steps = overrides.gradient_accumulation_steps;
    }
    if (overrides.lora_rank !== undefined)
        config.lora_rank = overrides.lora_rank;
    if (overrides.lora_alpha !== undefined)
        config.lora_alpha = overrides.lora_alpha;
    if (overrides.unet_learning_rate !== undefined) {
        config.unet = { ...asObject(config.unet), learning_rate: overrides.unet_learning_rate };
    }
    if (overrides.text_encoder_learning_rate !== undefined || overrides.text_encoder_stop_epoch !== undefined) {
        const textEncoder = asObject(config.text_encoder);
        if (overrides.text_encoder_learning_rate !== undefined) {
            textEncoder.learning_rate = overrides.text_encoder_learning_rate;
        }
        if (overrides.text_encoder_stop_epoch !== undefined) {
            textEncoder.stop_training_after = overrides.text_encoder_stop_epoch;
        }
        config.text_encoder = textEncoder;
    }
    const uiPlansDir = path.join(path.dirname(configPath), '.ui_plans');
    ensureDirectory(uiPlansDir);
    const stampText = new Date(stamp()).toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(uiPlansDir, `${path.basename(configPath, '.json')}.ui_${stampText}.json`);
    // 2026-08-16 审计：覆盖副本原为直接 writeFileSync 非原子写，写入途中崩溃会留下
    // 半写副本，OneTrainer 据此读到损坏配置。统一走 writeJsonAtomic（temp+rename）。
    writeJsonAtomic(outPath, config);
    return outPath;
}
class TrainingServiceError extends Error {
    code;
    status;
    detail;
    constructor(message, code, status, detail) {
        super(message);
        this.name = 'TrainingServiceError';
        this.code = code;
        this.status = status;
        this.detail = detail;
    }
}
const DEFINITIONS = [
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
const DATASET_PREVIEWS = {
    'lora-nene-v18': {
        relativePath: path.join('Reviews', 'ModelEvaluations', 'nene_v18_wd14_gate_2026-07-30', 'final', 'blinded_sheets', 'witch-canonical-full-body_seed-1038976852.jpg'),
        label: '宁宁魔女服训练样本审核表',
        blurred: false,
    },
    'lora-natsume-v18': {
        relativePath: path.join('Reviews', 'ModelEvaluations', 'natsume_v18_wd14_gate_2026-07-30', 'final', 'blinded_sheets', 'qipao-canonical-full-body_seed-1038976852.jpg'),
        label: '夏目旗袍服训练样本审核表',
        blurred: false,
    },
};
const DATASET_ADULT_PREVIEWS = {
    'lora-nene-v18': {
        relativePath: path.join('Reviews', 'ModelEvaluations', 'nene_v18_wd14_gate_2026-07-30', 'final', 'blinded_sheets', 'r18-solo-body-identity_seed-1038976852.jpg'),
        label: '宁宁 R18 分层样本（默认模糊）',
        blurred: true,
    },
    'lora-natsume-v18': {
        relativePath: path.join('Reviews', 'ModelEvaluations', 'natsume_v18_wd14_gate_2026-07-30', 'final', 'blinded_sheets', 'r18-solo-body-identity_seed-1038976852.jpg'),
        label: '夏目 R18 分层样本（默认模糊）',
        blurred: true,
    },
};
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isJobId(value) {
    return typeof value === 'string' && JOB_IDS.includes(value);
}
function definitionFor(id) {
    return DEFINITIONS.find((item) => item.id === id);
}
function ensureDirectory(directory) {
    fs.mkdirSync(directory, { recursive: true });
}
function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
}
function writeJsonAtomic(file, value) {
    ensureDirectory(path.dirname(file));
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
        fs.renameSync(temporary, file);
    }
    catch (error) {
        try {
            if (fs.existsSync(temporary))
                fs.unlinkSync(temporary);
        }
        catch {
            // Keep the original write error as the useful failure.
        }
        throw error;
    }
}
function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}
function defaultProgress() {
    return { stage: '待开始', message: '', percent: 0 };
}
function defaultState(id) {
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
function normalizeProgress(value) {
    if (!isRecord(value))
        return defaultProgress();
    const progress = {
        stage: typeof value.stage === 'string' ? value.stage.slice(0, 80) : '待开始',
        message: typeof value.message === 'string' ? value.message.slice(0, 240) : '',
        percent: clampPercent(finiteNumber(value.percent, 0)),
    };
    for (const key of ['epoch', 'epochs', 'step', 'steps']) {
        const number = Number(value[key]);
        if (Number.isFinite(number) && number >= 0)
            progress[key] = Math.round(number);
    }
    const loss = Number(value.loss);
    if (Number.isFinite(loss))
        progress.loss = loss;
    return progress;
}
function normalizeState(id, value) {
    const fallback = defaultState(id);
    if (!isRecord(value))
        return fallback;
    const allowedStatuses = ['idle', 'running', 'stopping', 'completed', 'failed', 'stopped'];
    const status = allowedStatuses.includes(String(value.status))
        ? String(value.status)
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
function stripAnsi(value) {
    return value.replace(ANSI_RE, '').replace(/\u0000/g, '');
}
function normalizeLogChunk(value) {
    return stripAnsi(Buffer.isBuffer(value) ? value.toString('utf8') : String(value))
        .replace(/\r(?!\n)/g, '\n');
}
function tailMessage(value) {
    const lines = value
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
    return lines.length ? lines[lines.length - 1].slice(0, 240) : '';
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function redactWorkspacePath(value, aiRoot) {
    const normalizedRoot = path.resolve(aiRoot).replace(/[\\/]+$/, '');
    const expression = new RegExp(escapeRegExp(normalizedRoot).replace(/\\/g, '[\\\\/]'), 'gi');
    return value.replace(expression, '[AI]');
}
function parseProgress(state, text, definition, aiRoot) {
    const clean = stripAnsi(text);
    const message = tailMessage(clean);
    if (message)
        state.progress.message = redactWorkspacePath(message, aiRoot);
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
        if (step[4] != null)
            state.progress.loss = Number(step[4]);
        if (definition.kind === 'lora') {
            state.progress.stage = 'LoRA 训练';
            const epochNumber = state.progress.epoch || 0;
            const epochs = state.progress.epochs || 0;
            const stepPercent = Number(step[2]) / Math.max(1, Number(step[3]));
            state.progress.percent = clampPercent(epochs ? ((Math.max(0, epochNumber - 1) + stepPercent) / epochs) * 100 : stepPercent * 100);
        }
    }
    if (definition.kind === 'voice') {
        if (/1-get-text|2-get-hubert|2-get-sv|3-get-semantic/i.test(clean)) {
            state.progress.stage = '准备语音数据';
            state.progress.percent = Math.max(state.progress.percent, 20);
        }
        else if (/s2_train|train-sovits/i.test(clean)) {
            state.progress.stage = 'SoVITS 训练';
            state.progress.percent = Math.max(state.progress.percent, 50);
        }
        else if (/s1_train|train-gpt/i.test(clean)) {
            state.progress.stage = 'GPT 训练';
            state.progress.percent = Math.max(state.progress.percent, 75);
        }
        else if (/evaluation|evaluate|评测/i.test(clean)) {
            state.progress.stage = '语音评测';
            state.progress.percent = Math.max(state.progress.percent, 90);
        }
    }
}
function walkDataset(root) {
    const result = { images: 0, captions: 0, bytes: 0, categories: {} };
    if (!fs.existsSync(root))
        return result;
    const stack = [{ directory: root, category: '' }];
    let visited = 0;
    while (stack.length && visited < 20000) {
        const current = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(current.directory, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            visited += 1;
            if (visited >= 20000)
                break;
            const absolute = path.join(current.directory, entry.name);
            if (entry.isDirectory()) {
                stack.push({
                    directory: absolute,
                    category: current.category || entry.name,
                });
                continue;
            }
            if (!entry.isFile())
                continue;
            const extension = path.extname(entry.name).toLowerCase();
            if (IMAGE_EXTENSIONS.has(extension)) {
                result.images += 1;
                try {
                    result.bytes += fs.statSync(absolute).size;
                }
                catch {
                    // A file can disappear while the directory is being inspected.
                }
                const category = current.category || 'root';
                result.categories[category] = (result.categories[category] || 0) + 1;
            }
            else if (extension === '.txt') {
                result.captions += 1;
            }
        }
    }
    return result;
}
const CHARACTER_DATASET_DIRS = {
    nene: 'Ayachi_Nene',
    natsume: 'Shiki_Natsume',
};
const DEFAULT_DATASETS = {
    nene: 'V18_WD14_Curated',
    natsume: 'V17_WD14_Curated',
};
/** 枚举角色目录下可作为训练数据集的子目录（排除隐藏目录），浏览器不传路径，只传这里的 id。 */
function listDatasetCandidates(aiRoot, character) {
    const root = path.join(aiRoot, 'Datasets', 'Characters', CHARACTER_DATASET_DIRS[character]);
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    }
    catch {
        return [];
    }
    return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => ({ id: entry.name, name: entry.name }))
        .sort((a, b) => a.id.localeCompare(b.id));
}
function defaultDatasetFor(aiRoot, character) {
    const candidates = listDatasetCandidates(aiRoot, character);
    const preferred = DEFAULT_DATASETS[character];
    if (preferred && candidates.some((item) => item.id === preferred))
        return preferred;
    return candidates[0]?.id ?? '';
}
function isKnownDataset(aiRoot, character, datasetId) {
    return listDatasetCandidates(aiRoot, character).some((item) => item.id === datasetId);
}
function countLines(file) {
    try {
        const text = fs.readFileSync(file, 'utf8');
        return text.split(/\r?\n/).filter((line) => line.trim()).length;
    }
    catch {
        return 0;
    }
}
function countFiles(directory, extension) {
    if (!fs.existsSync(directory))
        return 0;
    try {
        return fs.readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === extension)
            .length;
    }
    catch {
        return 0;
    }
}
function findV18Config(configDirectory, character) {
    const name = character === 'nene'
        ? 'ayachi_nene_v18_wd14_curated.json'
        : 'shiki_natsume_v18_wd14_balanced_r18.json';
    const file = path.join(configDirectory, name);
    return fs.existsSync(file) ? file : '';
}
function defaultKillProcess(pid, child, platform) {
    if (platform === 'win32') {
        // 2026-08-16 审计：taskkill 由同步 execFileSync 改为异步 spawn（stdio ignore，
        // 无管道捕获/背压）——同步版本会阻塞网关事件循环直到整棵进程树回收完毕
        // （卡死进程时尤其明显），异步化后停止训练不再卡住同进程的聊天/TTS。
        // managed child 的状态回收仍由 close 事件驱动，与原有容错语义一致。
        try {
            const killer = childProcess.spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
                windowsHide: true,
                shell: false,
                stdio: 'ignore',
            });
            killer.unref?.();
            return;
        }
        catch {
            // The process may have exited between the status check and taskkill.
        }
    }
    if (child?.kill) {
        child.kill('SIGTERM');
        return;
    }
    try {
        process.kill(pid, 'SIGTERM');
    }
    catch {
        // Treat an already exited process as stopped.
    }
}
function processAlive(pid) {
    if (!pid)
        return false;
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        const code = isRecord(error) ? error.code : undefined;
        return code === 'EPERM';
    }
}
function createTrainingService(options) {
    const aiRoot = path.resolve(options.aiRoot);
    const runtimeRoot = path.resolve(options.runtimeRoot);
    const trainingRoot = path.join(runtimeRoot, 'training');
    const logRoot = path.join(trainingRoot, 'logs');
    const stateFile = path.join(trainingRoot, STATE_FILE_NAME);
    const now = options.now || (() => Date.now());
    const platform = options.platform || process.platform;
    const logMaxBytes = Math.max(64 * 1024, Math.round(options.logMaxBytes || LOG_MAX_BYTES_DEFAULT));
    const spawn = options.spawn || ((command, args, spawnOptions) => childProcess.spawn(command, args, spawnOptions));
    const killProcess = options.killProcess || ((pid, child) => defaultKillProcess(pid, child, platform));
    const isAlive = options.isProcessAlive || processAlive;
    const states = new Map();
    const children = new Map();
    const parserBuffers = new Map();
    const persistTimers = new Map();
    const logSinks = new Map();
    ensureDirectory(trainingRoot);
    ensureDirectory(logRoot);
    const saved = readJson(stateFile);
    const savedJobs = isRecord(saved) && isRecord(saved.jobs) ? saved.jobs : {};
    for (const id of JOB_IDS) {
        const state = normalizeState(id, savedJobs[id]);
        if ((state.status === 'running' || state.status === 'stopping') && !isAlive(state.pid)) {
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
    function stateFor(id) {
        return states.get(id);
    }
    function reconcileOrphanedJobs() {
        let changed = false;
        for (const id of JOB_IDS) {
            const state = stateFor(id);
            if ((state.status !== 'running' && state.status !== 'stopping')
                || children.has(id)
                || isAlive(state.pid))
                continue;
            state.status = state.stopRequested ? 'stopped' : 'failed';
            state.finishedAt = now();
            state.error = state.stopRequested ? '' : '训练网关重启后未发现训练进程';
            state.progress = {
                ...state.progress,
                stage: state.stopRequested ? '已停止' : '进程已丢失',
                message: state.error || '训练已停止',
                percent: state.stopRequested ? state.progress.percent : Math.min(99, state.progress.percent),
            };
            state.stopRequested = false;
            changed = true;
        }
        if (changed)
            saveStates();
        return changed;
    }
    const orphanReconcileTimer = setInterval(() => {
        try {
            reconcileOrphanedJobs();
        }
        catch { /* 查询失败不应中断训练服务轮询 */ }
    }, 5000);
    orphanReconcileTimer.unref?.();
    function saveStates() {
        writeJsonAtomic(stateFile, { version: 1, jobs: Object.fromEntries(states) });
    }
    function schedulePersist(id) {
        if (persistTimers.has(id))
            return;
        const timer = setTimeout(() => {
            persistTimers.delete(id);
            try {
                saveStates();
            }
            catch (error) {
                console.error('  ❌ 保存训练状态失败:', error instanceof Error ? error.message : error);
            }
        }, 250);
        timer.unref?.();
        persistTimers.set(id, timer);
    }
    function logFileFor(id) {
        return path.join(logRoot, `${id}.log`);
    }
    /**
     * 2026-08-16 审计：日志热路径原为每 chunk 同步 appendFileSync + statSync + readSync +
     * writeFileSync（截尾）——训练进程输出密集时每个 chunk 都要阻塞事件循环 4 次磁盘调用。
     * 改为内存缓冲 + debounce 合并的异步批量写；截尾（超过 logMaxBytes 保留最近 75%）
     * 也在 flush 周期内异步完成，不再触碰热路径。
     */
    function createLogSink(id) {
        const file = logFileFor(id);
        let buffer = '';
        let scheduled = false;
        let flushing = null;
        let lastFlushAt = 0;
        let bytesSinceSizeCheck = LOG_SIZE_CHECK_BYTES; // 首次落盘即做一次尺寸检查
        let errorReported = false;
        let timer = null;
        let immediate = null;
        async function maybeTruncate() {
            let stat = null;
            try {
                stat = await fs.promises.stat(file);
            }
            catch {
                return;
            }
            if (!stat || stat.size <= logMaxBytes)
                return;
            const keepBytes = Math.floor(logMaxBytes * 0.75);
            const start = Math.max(0, stat.size - keepBytes);
            const length = stat.size - start;
            let handle;
            try {
                handle = await fs.promises.open(file, 'r');
            }
            catch {
                return;
            }
            let tail;
            try {
                const { buffer: readBuffer, bytesRead } = await handle.read(Buffer.alloc(length), 0, length, start);
                const slice = readBuffer.subarray(0, bytesRead);
                const firstBreak = slice.indexOf(0x0a);
                tail = firstBreak >= 0 ? slice.subarray(firstBreak + 1) : slice;
            }
            finally {
                await handle.close();
            }
            try {
                await fs.promises.writeFile(file, tail);
            }
            catch {
                return;
            }
            const state = stateFor(id);
            state.logVersion += 1;
            if (state.status === 'running' || state.status === 'stopping') {
                state.progress.message = '日志已滚动保留最近内容';
            }
        }
        async function doFlush() {
            const text = buffer;
            buffer = '';
            if (!text)
                return;
            try {
                await fs.promises.appendFile(file, text, 'utf8');
                lastFlushAt = Date.now();
                bytesSinceSizeCheck += text.length;
                if (bytesSinceSizeCheck >= LOG_SIZE_CHECK_BYTES) {
                    bytesSinceSizeCheck = 0;
                    await maybeTruncate();
                }
            }
            catch (error) {
                // 热路径绝不因写日志失败崩溃；丢的只是本次缓冲（错误只上报一次防刷屏）。
                if (!errorReported) {
                    errorReported = true;
                    console.error(`  ❌ 训练日志写入失败（${id}）:`, error instanceof Error ? error.message : error);
                }
            }
        }
        function flush() {
            if (flushing)
                return flushing;
            flushing = doFlush().finally(function () { flushing = null; });
            return flushing;
        }
        function scheduleFlush() {
            if (scheduled || !buffer)
                return;
            scheduled = true;
            const delay = Math.max(0, LOG_FLUSH_DEBOUNCE_MS - (Date.now() - lastFlushAt));
            if (buffer.length >= LOG_FORCE_FLUSH_BYTES || delay === 0) {
                immediate = setImmediate(function () {
                    immediate = null;
                    scheduled = false;
                    void flush();
                });
                immediate.unref?.();
                return;
            }
            timer = setTimeout(function () {
                timer = null;
                scheduled = false;
                void flush();
            }, delay);
            timer.unref?.();
        }
        return {
            append: function (text) {
                if (!text)
                    return;
                buffer += text;
                scheduleFlush();
            },
            flush: flush,
            drainSync: function () {
                if (!buffer)
                    return;
                const text = buffer;
                buffer = '';
                try {
                    fs.appendFileSync(file, text, 'utf8');
                }
                catch (error) {
                    console.error(`  ❌ 训练日志落盘失败（${id}）:`, error instanceof Error ? error.message : error);
                }
            },
            dispose: function () {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                if (immediate) {
                    clearImmediate(immediate);
                    immediate = null;
                }
                scheduled = false;
            },
        };
    }
    function logSinkFor(id) {
        let sink = logSinks.get(id);
        if (!sink) {
            sink = createLogSink(id);
            logSinks.set(id, sink);
        }
        return sink;
    }
    function inspectJob(id, datasetId) {
        const definition = definitionFor(id);
        const oneTrainerRoot = path.join(aiRoot, 'OneTrainer');
        const voiceRoot = path.join(aiRoot, 'Voice');
        const pythonOneTrainer = path.join(oneTrainerRoot, 'venv', 'Scripts', 'python.exe');
        const oneTrainerScript = path.join(oneTrainerRoot, 'scripts', 'train.py');
        const voicePython = path.join(aiRoot, 'GPT-SoVITS-env', 'python.exe');
        const voiceScript = path.join(voiceRoot, 'tools', 'train_gpt_sovits_character.py');
        const missing = [];
        let datasetPath = '';
        let executablePath = '';
        let scriptPath = '';
        let cwd = '';
        let args = [];
        let configName = '';
        let loraConfigPath = '';
        let resolvedDatasetId = '';
        if (definition.kind === 'lora') {
            const selectedDataset = typeof datasetId === 'string' && datasetId
                && isKnownDataset(aiRoot, definition.character, datasetId)
                ? datasetId
                : defaultDatasetFor(aiRoot, definition.character);
            resolvedDatasetId = selectedDataset;
            datasetPath = path.join(aiRoot, 'Datasets', 'Characters', CHARACTER_DATASET_DIRS[definition.character], selectedDataset);
            executablePath = pythonOneTrainer;
            scriptPath = oneTrainerScript;
            cwd = oneTrainerRoot;
            const configPath = findV18Config(path.join(oneTrainerRoot, 'training_configs'), definition.character);
            loraConfigPath = configPath;
            configName = configPath ? path.basename(configPath) : '';
            args = configPath ? ['--config-path', configPath] : [];
            if (!fs.existsSync(pythonOneTrainer))
                missing.push('OneTrainer Python 环境未安装');
            if (!fs.existsSync(oneTrainerScript))
                missing.push('OneTrainer CLI 尚未安装');
            if (!configPath)
                missing.push('v18 训练配置尚未准备');
            const dataset = walkDataset(datasetPath);
            if (!fs.existsSync(datasetPath) || dataset.images === 0)
                missing.push('所选图片数据集尚未准备');
        }
        else {
            datasetPath = path.join(voiceRoot, VOICE_DATASET_VERSION, definition.character);
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
            if (!fs.existsSync(voicePython))
                missing.push('GPT-SoVITS Python 环境未安装');
            if (!fs.existsSync(voiceScript))
                missing.push('语音训练脚本尚未安装');
            if (!fs.existsSync(datasetPath))
                missing.push('角色语音数据集尚未准备');
            if (!fs.existsSync(path.join(datasetPath, 'train.list')))
                missing.push('语音训练清单尚未准备');
            if (!fs.existsSync(path.join(datasetPath, 'eval.list')))
                missing.push('语音留出评测清单尚未准备');
            if (!fs.existsSync(path.join(datasetPath, 'test.list')))
                missing.push('语音封闭测试清单尚未准备');
            if (!fs.existsSync(path.join(datasetPath, 'wavs')))
                missing.push('语音 wav 目录尚未准备');
            if (!fs.existsSync(path.join(aiRoot, 'GPT-SoVITS')))
                missing.push('GPT-SoVITS 代码目录未找到');
        }
        return {
            definition,
            ready: missing.length === 0,
            missing,
            configName: configName || undefined,
            configPath: loraConfigPath,
            datasetPath,
            datasetId: resolvedDatasetId || undefined,
            executablePath,
            scriptPath,
            cwd,
            args,
        };
    }
    function getJobConfig(value) {
        const id = assertKnownId(value);
        const inspection = inspectJob(id);
        const empty = { id, kind: inspection.definition.kind, available: false, fields: {}, recommended: {} };
        if (inspection.definition.kind !== 'lora' || !inspection.configPath)
            return empty;
        const config = readJsonObject(inspection.configPath);
        if (Object.keys(config).length === 0)
            return empty;
        const unet = asObject(config.unet);
        const textEncoder = asObject(config.text_encoder);
        const fields = {
            epochs: asFiniteNumber(config.epochs),
            batch_size: asFiniteNumber(config.batch_size),
            gradient_accumulation_steps: asFiniteNumber(config.gradient_accumulation_steps, 1),
            lora_rank: asFiniteNumber(config.lora_rank),
            lora_alpha: asFiniteNumber(config.lora_alpha),
            unet_learning_rate: asFiniteNumber(unet.learning_rate),
            text_encoder_learning_rate: asFiniteNumber(textEncoder.learning_rate),
            text_encoder_stop_epoch: asFiniteNumber(textEncoder.stop_training_after),
        };
        return { id, kind: 'lora', available: true, fields, recommended: { ...fields } };
    }
    function datasetOptionsFor(definition) {
        if (definition.kind !== 'lora')
            return [];
        return listDatasetCandidates(aiRoot, definition.character).map((candidate) => {
            const root = path.join(aiRoot, 'Datasets', 'Characters', CHARACTER_DATASET_DIRS[definition.character], candidate.id);
            const scanned = walkDataset(root);
            return {
                id: candidate.id,
                name: candidate.name,
                images: scanned.images,
                captions: scanned.captions,
                bytes: scanned.bytes,
                categories: scanned.categories,
                ready: scanned.images > 0,
            };
        });
    }
    function publicJob(id) {
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
            datasetOptions: datasetOptionsFor(inspection.definition),
            selectedDataset: inspection.datasetId,
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
    function previewSummary(datasetId, definitions = DATASET_PREVIEWS) {
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
    function getDatasetPreview(datasetId, variant = 'signature') {
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
    function datasetSummary(definition) {
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
    function listDatasets() {
        return { datasets: DEFINITIONS.map(datasetSummary) };
    }
    function listJobs() {
        reconcileOrphanedJobs();
        return { jobs: JOB_IDS.map(publicJob) };
    }
    function getJob(value) {
        const id = assertKnownId(value);
        reconcileOrphanedJobs();
        return publicJob(id);
    }
    function overview() {
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
    function assertKnownId(value) {
        if (!isJobId(value)) {
            throw new TrainingServiceError('不支持的训练任务', 'UNKNOWN_JOB', 404);
        }
        return value;
    }
    function assertNoActiveJob() {
        reconcileOrphanedJobs();
        const active = JOB_IDS.map((id) => stateFor(id))
            .find((state) => state.status === 'running' || state.status === 'stopping');
        if (active) {
            const definition = definitionFor(active.id);
            throw new TrainingServiceError(`“${definition.label}”仍在进行，请等待当前任务完成`, 'TRAINING_BUSY', 409);
        }
    }
    function startJob(value, overridesValue, datasetValue) {
        const id = assertKnownId(value);
        const overrides = sanitizeOverrides(overridesValue);
        const definition = definitionFor(id);
        const datasetId = datasetValue === undefined || datasetValue === null
            ? undefined
            : typeof datasetValue === 'string' && isKnownDataset(aiRoot, definition.character, datasetValue)
                ? datasetValue
                : (() => {
                    throw new TrainingServiceError('未知的数据集，请从候选列表中选择', 'UNKNOWN_DATASET', 400, typeof datasetValue === 'string' ? datasetValue : String(datasetValue));
                })();
        assertNoActiveJob();
        const inspection = inspectJob(id, datasetId);
        if (!inspection.ready) {
            throw new TrainingServiceError(`${inspection.definition.label} 尚未就绪`, 'NOT_READY', 409, inspection.missing.join('；'));
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
        let child;
        try {
            let commandArgs;
            if (inspection.definition.kind === 'lora') {
                const configPath = inspection.configPath
                    ? applyOverridesToConfig(inspection.configPath, overrides, id, now)
                    : '';
                commandArgs = configPath
                    ? [inspection.scriptPath, '--config-path', configPath]
                    : [inspection.scriptPath];
            }
            else {
                commandArgs = inspection.args;
            }
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
        }
        catch (error) {
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
        const consume = (chunk) => {
            const text = normalizeLogChunk(chunk);
            if (!text)
                return;
            const trimmed = text.length > 128 * 1024 ? text.slice(-128 * 1024) : text;
            // 2026-08-16 审计：只做内存追加，落盘由 LogSink 合并为异步批量写
            // （截尾在 flush 周期内异步完成，热路径不再有任何同步磁盘 I/O）。
            logSinkFor(id).append(trimmed);
            const parserText = `${parserBuffers.get(id) || ''}${trimmed}`.slice(-16 * 1024);
            parserBuffers.set(id, parserText);
            parseProgress(state, parserText, inspection.definition, aiRoot);
            const timestamp = now();
            if (timestamp - persistAt >= 1000) {
                persistAt = timestamp;
                schedulePersist(id);
            }
        };
        child.stdout?.on('data', consume);
        child.stderr?.on('data', consume);
        child.once('error', (...args) => {
            if (settled)
                return;
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
        child.once('close', (...args) => {
            if (settled)
                return;
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
            }
            else if (state.status === 'stopped') {
                state.error = '';
                state.progress = {
                    ...state.progress,
                    stage: '已停止',
                    message: '训练已停止',
                };
            }
            else {
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
    function stopJob(value) {
        const id = assertKnownId(value);
        reconcileOrphanedJobs();
        const state = stateFor(id);
        if (state.status !== 'running' && state.status !== 'stopping') {
            throw new TrainingServiceError('当前没有正在运行的训练任务', 'NOT_RUNNING', 409);
        }
        if (state.status === 'stopping')
            return publicJob(id);
        state.stopRequested = true;
        state.status = 'stopping';
        state.progress = { ...state.progress, stage: '正在停止', message: '正在终止训练进程' };
        saveStates();
        const child = children.get(id);
        try {
            if (state.pid)
                killProcess(state.pid, child);
            else if (child?.kill)
                child.kill('SIGTERM');
            else
                throw new Error('训练进程 PID 不可用');
        }
        catch (error) {
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
    async function getLogs(value, cursorValue, versionValue) {
        const id = assertKnownId(value);
        const state = stateFor(id);
        // 2026-08-16 审计：读前先把该任务的待写缓冲落盘——写路径已异步化，
        // 不 flush 会读到落后的内容（轮询时丢尾巴）。
        const sink = logSinks.get(id);
        if (sink)
            await sink.flush();
        const file = logFileFor(id);
        let size = 0;
        try {
            size = (await fs.promises.stat(file)).size;
        }
        catch {
            return { id, cursor: 0, nextCursor: 0, reset: false, version: state.logVersion, text: '', lines: [] };
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
        let bytesRead = 0;
        if (length) {
            let handle;
            try {
                handle = await fs.promises.open(file, 'r');
            }
            catch {
                return { id, cursor, nextCursor: cursor, reset, version: state.logVersion, text: '', lines: [] };
            }
            try {
                const result = await handle.read(Buffer.alloc(length), 0, length, cursor);
                bytesRead = result.bytesRead;
                text = result.buffer.subarray(0, bytesRead).toString('utf8');
            }
            finally {
                await handle.close();
            }
        }
        return {
            id,
            cursor,
            nextCursor: cursor + bytesRead,
            reset,
            version: state.logVersion,
            text,
            lines: text.split(/\r?\n/).filter(Boolean),
        };
    }
    function close() {
        clearInterval(orphanReconcileTimer);
        for (const timer of persistTimers.values())
            clearTimeout(timer);
        persistTimers.clear();
        // 2026-08-16 用户决策：优雅关闭网关 = 终止训练（不做「跨重启存活」——
        // 网关退出会关闭子进程 stdout 管道读端，存活训练下次打印大概率 BrokenPipeError
        // 崩溃，等于半死状态；终止是唯一确定语义）。defaultKillProcess 的 taskkill 是
        // 异步 spawn + unref，网关进程退出后仍会落地，不会留孤儿 GPU 进程；子进程
        // close 事件驱动的状态回收（stopped/failed + saveStates）照常进行。
        for (const [id, child] of children) {
            children.delete(id);
            const state = states.get(id);
            if (state && state.pid) {
                try {
                    killProcess(state.pid, child);
                }
                catch { /* 进程可能已退出 */ }
            }
        }
        // 关闭前同步落盘剩余日志缓冲（关停路径的一次性同步写可接受，保证不丢尾巴）。
        for (const sink of logSinks.values()) {
            sink.dispose();
            sink.drainSync();
        }
        logSinks.clear();
        try {
            saveStates();
        }
        catch (error) {
            console.error('  ❌ 保存训练状态失败:', error instanceof Error ? error.message : error);
        }
    }
    return {
        overview,
        listDatasets,
        listJobs,
        getDatasetPreview,
        getJob,
        getJobConfig,
        getLogs,
        startJob,
        stopJob,
        close,
        isKnownJobId: isJobId,
        inspectJob: (value) => inspectJob(assertKnownId(value)),
    };
}
module.exports = {
    JOB_IDS,
    TrainingServiceError,
    createTrainingService,
    _test: {
        defaultProgress,
        findV18Config,
        normalizeLogChunk,
        parseProgress,
        walkDataset,
        sanitizeOverrides,
        applyOverridesToConfig,
        listDatasetCandidates,
        defaultDatasetFor,
    },
};
