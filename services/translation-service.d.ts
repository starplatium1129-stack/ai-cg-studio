interface TranslationServiceOptions {
    url: string;
    python: string;
    script: string;
    port: number | string;
    logFile: string;
}
interface TranslationResult {
    translation: string;
    error?: string;
    [key: string]: unknown;
}
interface QueueStatusView {
    name: string;
    active: number;
    pending: number;
}
interface TranslationStatus {
    ready: boolean;
    managed: boolean;
    queue: QueueStatusView;
    cached: number;
}
declare function createTranslationService(options: TranslationServiceOptions): {
    translate: (text: string, signal?: AbortSignal) => Promise<TranslationResult>;
    prepare: (signal?: AbortSignal) => Promise<boolean>;
    ping: (signal?: AbortSignal | null, timeoutMs?: number) => Promise<boolean>;
    close: () => void;
    status: () => TranslationStatus;
};
declare const _default: {
    createTranslationService: typeof createTranslationService;
};
export = _default;
