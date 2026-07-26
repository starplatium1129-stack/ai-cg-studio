interface OllamaModelDetails {
    parameter_size?: string;
    quantization_level?: string;
}
interface OllamaModelItem {
    name?: string;
    model?: string;
    size?: number;
    capabilities?: string[];
    details?: OllamaModelDetails;
}
interface PublicModel {
    name: string;
    size: number;
    parameters: string;
    quantization: string;
}
interface ChatMessage {
    role: string;
    content: string;
}
interface StreamChatInput {
    model?: string;
    messages: ChatMessage[];
    signal?: AbortSignal;
}
interface StreamCallbacks {
    onStart?: (meta: {
        model: string;
        queueWaitMs: number;
    }) => void | Promise<void>;
    onToken?: (content: string) => void | Promise<void>;
    onDone?: () => void | Promise<void>;
}
interface StreamChatResult {
    model: string;
    queueWaitMs: number;
}
interface OllamaServiceOptions {
    host: string;
    model?: string;
    keepAlive?: string;
    numPredict?: number;
    numContext?: number;
}
interface QueueStatusView {
    name: string;
    active: number;
    pending: number;
}
interface OllamaStatusOnline {
    online: true;
    model: string;
    models: PublicModel[];
    queue: QueueStatusView;
    activeModel: string;
    error?: undefined;
}
interface OllamaStatusOffline {
    online: false;
    model: string;
    models: PublicModel[];
    queue: QueueStatusView;
    activeModel: string;
    error: string;
}
type OllamaStatus = OllamaStatusOnline | OllamaStatusOffline;
declare function modelName(item: OllamaModelItem | null | undefined): string;
declare function publicModel(item: OllamaModelItem): PublicModel;
declare function createOllamaService(options: OllamaServiceOptions): {
    listModels: (signal?: AbortSignal) => Promise<OllamaModelItem[]>;
    preferredModel: (models: OllamaModelItem[]) => string;
    status: (signal?: AbortSignal) => Promise<OllamaStatus>;
    streamChat: (input: StreamChatInput, callbacks?: StreamCallbacks) => Promise<StreamChatResult>;
    queueStatus: () => QueueStatusView;
};
declare const _default: {
    createOllamaService: typeof createOllamaService;
    modelName: typeof modelName;
    publicModel: typeof publicModel;
};
export = _default;
