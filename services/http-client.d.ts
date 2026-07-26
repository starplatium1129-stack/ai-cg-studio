import type { IncomingMessage, ClientRequest } from 'http';
interface UpstreamErrorOptions {
    code?: string;
    status?: number;
    detail?: string;
}
declare class UpstreamError extends Error {
    code: string;
    status: number;
    detail: string;
    constructor(message: string, options?: UpstreamErrorOptions);
}
interface AbortError extends Error {
    code: string;
}
interface RequestOptions {
    method?: string;
    headers?: Record<string, string | number | string[] | undefined>;
    json?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
    timeoutMessage?: string;
    limit?: number;
}
interface RequestResult {
    request: ClientRequest;
    response: IncomingMessage;
    url: string;
}
interface SuccessBody {
    body: Buffer;
    contentType: string;
}
declare function abortError(message?: string): AbortError;
declare function isAbortError(error: unknown): boolean;
declare function request(baseUrl: string, pathname: string, options?: RequestOptions): Promise<RequestResult>;
declare function readBody(response: IncomingMessage, limit?: number): Promise<Buffer>;
declare function readJson(baseUrl: string, pathname: string, options?: RequestOptions): Promise<unknown>;
declare function expectSuccess(baseUrl: string, pathname: string, options?: RequestOptions): Promise<SuccessBody>;
declare const _default: {
    UpstreamError: typeof UpstreamError;
    abortError: typeof abortError;
    isAbortError: typeof isAbortError;
    request: typeof request;
    readBody: typeof readBody;
    readJson: typeof readJson;
    expectSuccess: typeof expectSuccess;
};
export = _default;
