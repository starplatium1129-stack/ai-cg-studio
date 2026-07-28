import type { IncomingMessage, ClientRequest } from 'http';
declare const VOICES: readonly ["nene", "natsume"];
declare const EMOTIONS: readonly ["neutral", "gentle", "happy", "shy", "serious", "sad"];
type VoiceId = (typeof VOICES)[number];
type VoiceEmotion = (typeof EMOTIONS)[number];
type VoiceConsistency = 'locked' | 'adaptive';
interface VoiceEmotionReference {
    refAudioPath?: string;
    promptText?: string;
    promptLang?: string;
}
interface VoiceProfile {
    refAudioPath?: string;
    promptText?: string;
    promptLang?: string;
    textLang?: string;
    gptWeightsPath?: string;
    sovitsWeightsPath?: string;
    seed?: number;
    topK?: number;
    topP?: number;
    temperature?: number;
    references?: Partial<Record<VoiceEmotion, VoiceEmotionReference>>;
}
interface VoiceTtsInput {
    voice?: string;
    text?: string;
    language?: string;
    emotion?: string;
    referenceEmotion?: string;
    consistency?: string;
    speed?: number;
}
interface TtsPayload {
    text: string;
    text_lang: string;
    ref_audio_path: string;
    prompt_lang: string;
    prompt_text: string;
    text_split_method: string;
    batch_size: number;
    split_bucket: boolean;
    speed_factor: number;
    seed: number;
    top_k: number;
    top_p: number;
    temperature: number;
    parallel_infer: boolean;
    media_type: string;
    streaming_mode: boolean;
}
interface ValidatedTtsInput {
    voice: VoiceId;
    profile: VoiceProfile;
    consistency: VoiceConsistency;
    referenceEmotion: string;
    payload: TtsPayload;
}
interface ValidationError {
    error: string;
    status: number;
    value?: undefined;
}
interface ValidationSuccess {
    error?: undefined;
    status?: undefined;
    value: ValidatedTtsInput;
}
type ValidationResult = ValidationError | ValidationSuccess;
interface StreamResponseMeta {
    response: IncomingMessage;
    request: ClientRequest;
    contentType: string;
    queueWaitMs: number;
}
interface StreamOptions {
    signal?: AbortSignal;
    onResponse?: (meta: StreamResponseMeta) => void | Promise<void>;
}
interface TtsServiceOptions {
    host: string;
    profiles?: Record<string, VoiceProfile | undefined>;
}
interface QueueWaitResult {
    queueWaitMs: number;
}
interface PrepareResult {
    voice: string;
    queueWaitMs: number;
}
interface TtsStatus {
    online: boolean;
    engine: string;
    voices: Record<string, boolean>;
    activeVoice: string;
    queue: {
        name: string;
        active: number;
        pending: number;
    };
}
declare function normalizeSpeechText(value: unknown, language: string): string;
declare function validateInput(input: VoiceTtsInput | null | undefined, profiles: Record<string, VoiceProfile | undefined>): ValidationResult;
declare function createTtsService(options: TtsServiceOptions): {
    status: (signal?: AbortSignal) => Promise<TtsStatus>;
    prepare: (voice: string, signal?: AbortSignal) => Promise<PrepareResult>;
    stream: (input: VoiceTtsInput, optionsForStream?: StreamOptions) => Promise<QueueWaitResult>;
    validate: (input: VoiceTtsInput) => ValidationResult;
    queueStatus: () => {
        name: string;
        active: number;
        pending: number;
    };
};
declare const _default: {
    createTtsService: typeof createTtsService;
    validateInput: typeof validateInput;
    normalizeSpeechText: typeof normalizeSpeechText;
    VOICES: readonly ["nene", "natsume"];
    LANGUAGES: readonly ["ja", "zh"];
    EMOTIONS: readonly ["neutral", "gentle", "happy", "shy", "serious", "sad"];
};
export = _default;
