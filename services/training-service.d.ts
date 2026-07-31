import childProcess = require('child_process');
declare const JOB_IDS: readonly ["lora-nene-v18", "lora-natsume-v18", "voice-nene", "voice-natsume"];
type TrainingJobId = (typeof JOB_IDS)[number];
type JobKind = 'lora' | 'voice';
type JobStatus = 'idle' | 'running' | 'stopping' | 'completed' | 'failed' | 'stopped';
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
    configPath?: string;
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
/**
 * 浏览器可覆盖的训练参数白名单。
 * 只允许数值字段，且 key 必须命中白名单；未知 key / 越界 / 非数字一律拒绝。
 * 覆盖值由服务端写入一次性配置副本，浏览器始终无法直接传路径或命令。
 */
interface TrainingParamOverrides {
    epochs?: number;
    batch_size?: number;
    gradient_accumulation_steps?: number;
    lora_rank?: number;
    lora_alpha?: number;
    unet_learning_rate?: number;
    text_encoder_learning_rate?: number;
    text_encoder_stop_epoch?: number;
}
interface PublicJobConfig {
    id: TrainingJobId;
    kind: JobKind;
    available: boolean;
    fields: Record<string, number>;
    recommended: Record<string, number>;
}
declare function sanitizeOverrides(value: unknown): TrainingParamOverrides;
/**
 * 把白名单覆盖写进一次性配置副本，返回副本路径。
 * 原配置只读；副本落在 training_configs/.ui_plans/ 下，文件名带时间戳，
 * 避免与 OneTrainer 的 prevent_overwrites 冲突。
 */
declare function applyOverridesToConfig(configPath: string, overrides: TrainingParamOverrides, id: TrainingJobId, stamp?: () => number): string;
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
type SpawnFunction = (command: string, args: string[], options: childProcess.SpawnOptions) => ChildHandle;
declare class TrainingServiceError extends Error {
    readonly code: string;
    readonly status: number;
    readonly detail?: string;
    constructor(message: string, code: string, status: number, detail?: string);
}
declare function isJobId(value: unknown): value is TrainingJobId;
declare function defaultProgress(): TrainingProgress;
declare function normalizeLogChunk(value: Buffer | string): string;
declare function parseProgress(state: PersistedJobState, text: string, definition: JobDefinition, aiRoot: string): void;
declare function walkDataset(root: string): {
    images: number;
    captions: number;
    bytes: number;
    categories: Record<string, number>;
};
declare function findV18Config(configDirectory: string, character: 'nene' | 'natsume'): string;
declare function createTrainingService(options: TrainingServiceOptions): {
    overview: () => Record<string, unknown>;
    listDatasets: () => {
        datasets: DatasetSummary[];
    };
    listJobs: () => {
        jobs: PublicJob[];
    };
    getDatasetPreview: (datasetId: string, variant?: "signature" | "adult") => DatasetPreviewFile;
    getJob: (value: unknown) => PublicJob;
    getJobConfig: (value: unknown) => PublicJobConfig;
    getLogs: (value: unknown, cursorValue: unknown, versionValue: unknown) => {
        id: TrainingJobId;
        cursor: number;
        nextCursor: number;
        reset: boolean;
        version: number;
        text: string;
        lines: string[];
    };
    startJob: (value: unknown, overridesValue?: unknown) => PublicJob;
    stopJob: (value: unknown) => PublicJob;
    close: () => void;
    isKnownJobId: typeof isJobId;
    inspectJob: (value: unknown) => JobInspection;
};
declare const _default: {
    JOB_IDS: readonly ["lora-nene-v18", "lora-natsume-v18", "voice-nene", "voice-natsume"];
    TrainingServiceError: typeof TrainingServiceError;
    createTrainingService: typeof createTrainingService;
    _test: {
        defaultProgress: typeof defaultProgress;
        findV18Config: typeof findV18Config;
        normalizeLogChunk: typeof normalizeLogChunk;
        parseProgress: typeof parseProgress;
        walkDataset: typeof walkDataset;
        sanitizeOverrides: typeof sanitizeOverrides;
        applyOverridesToConfig: typeof applyOverridesToConfig;
    };
};
export = _default;
