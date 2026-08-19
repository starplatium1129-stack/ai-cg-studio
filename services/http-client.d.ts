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
interface ProxyConfig {
    host: string;
    port: number;
    auth?: string;
}
/**
 * 解析代理环境变量（HTTP_PROXY/HTTPS_PROXY/ALL_PROXY，支持小写变体）。
 * 只接受 http:// 代理（常见本地 Clash/v2ray 场景），其它协议视为无效。
 */
declare function parseProxyEnv(value: string | undefined): ProxyConfig | null;
/**
 * NO_PROXY 匹配：条目支持精确 host、.example.com / *.example.com 通配子域、
 * host:port；"*" 表示全部绕过。本地回环地址无条件绕过。
 */
declare function matchesNoProxy(host: string, noProxy: string | undefined): boolean;
/** 按目标协议挑选代理；NO_PROXY 命中或未配置时返回 null（直连）。 */
declare function resolveProxy(target: URL): ProxyConfig | null;
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
    parseProxyEnv: typeof parseProxyEnv;
    matchesNoProxy: typeof matchesNoProxy;
    resolveProxy: typeof resolveProxy;
};
export = _default;
