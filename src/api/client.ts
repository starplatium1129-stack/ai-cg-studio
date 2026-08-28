export type ApiClientErrorKind =
  | 'http'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'invalid-response'

export type ApiResponseObject = Record<string, unknown>

export interface ApiClientErrorOptions {
  kind: ApiClientErrorKind
  status?: number
  code?: string
  detail?: string
  retryAfterSeconds?: number
  responseBody?: ApiResponseObject | null
}

export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind
  readonly status: number
  readonly code: string | undefined
  readonly detail: string | undefined
  readonly retryAfterSeconds: number | undefined
  readonly responseBody: ApiResponseObject | null

  constructor(message: string, options: ApiClientErrorOptions) {
    super(message)
    this.name = 'ApiClientError'
    this.kind = options.kind
    this.status = options.status ?? 0
    this.code = options.code
    this.detail = options.detail
    this.retryAfterSeconds = options.retryAfterSeconds
    this.responseBody = options.responseBody ?? null
  }
}

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'signal'> {
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  validate?: (value: ApiResponseObject) => boolean
  /** GET 响应内存缓存时长（毫秒）。默认不缓存（任务态端点必须直连）；
   * 仅准静态配置类端点显式声明。任何写请求成功后自动失效同 URL 缓存。 */
  cacheTtlMs?: number
}

export interface ApiClient {
  request<T extends object>(url: string, options?: ApiRequestOptions): Promise<T>
}

const DEFAULT_TIMEOUT_MS = 30_000

function isResponseObject(value: unknown): value is ApiResponseObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: ApiResponseObject, key: string): string | undefined {
  const field = value[key]
  return typeof field === 'string' && field.trim() ? field.trim() : undefined
}

function retryAfter(value: ApiResponseObject, response: Response): number | undefined {
  const bodyValue = value.retryAfterSeconds
  if (typeof bodyValue === 'number' && Number.isFinite(bodyValue) && bodyValue >= 0) return bodyValue

  const header = response.headers.get('retry-after')?.trim()
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const date = Date.parse(header)
  if (!Number.isFinite(date)) return undefined
  return Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

function invalidResponse(
  status: number,
  detail: string,
  responseBody: ApiResponseObject | null = null,
): ApiClientError {
  return new ApiClientError(`服务器返回了无效响应：${detail}`, {
    kind: 'invalid-response',
    status,
    detail,
    responseBody,
  })
}

function httpFailure(response: Response, body: ApiResponseObject): ApiClientError {
  const detail = stringField(body, 'detail')
  const primary = stringField(body, 'error') || `请求失败（HTTP ${response.status}）`
  return new ApiClientError(detail && detail !== primary ? `${primary}：${detail}` : primary, {
    kind: 'http',
    status: response.status,
    code: stringField(body, 'code'),
    detail,
    retryAfterSeconds: retryAfter(body, response),
    responseBody: body,
  })
}

function explicitFailure(response: Response, body: ApiResponseObject): ApiClientError {
  const detail = stringField(body, 'detail')
  const primary = stringField(body, 'error') || '请求返回了失败状态'
  return new ApiClientError(detail && detail !== primary ? `${primary}：${detail}` : primary, {
    kind: 'http',
    status: response.status,
    code: stringField(body, 'code'),
    detail,
    retryAfterSeconds: retryAfter(body, response),
    responseBody: body,
  })
}

function errorDetail(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return error.message
  const detail = String(error ?? '').trim()
  return detail || undefined
}

const defaultFetch: FetchImplementation = (input, init) => globalThis.fetch(input, init)

const GET_METHOD = 'GET'

/** GET 请求并发去重与显式 TTL 缓存（2026-08-28 审计 P1-8）。
 * inflight：同 URL GET 并发时共享一次底层请求；搭车者的 abort/timeout 只作用于自己。
 * 缓存：仅显式传 cacheTtlMs 的 GET 走内存 TTL 缓存；写请求成功即失效同 URL 缓存。 */
interface CacheEntry {
  value: ApiResponseObject
  expiresAt: number
}

function requestKey(url: string, method: string): string {
  return `${method} ${url}`
}

export function createApiClient(fetchImplementation: FetchImplementation = defaultFetch): ApiClient {
  const responseCache = new Map<string, CacheEntry>()
  const inflight = new Map<string, Promise<ApiResponseObject>>()

  /** 搭车等待：共享响应与调用方自己的 abort/timeout 竞速，返回浅拷贝防跨消费者污染。 */
  async function awaitShared<T extends object>(
    shared: Promise<ApiResponseObject>,
    callerSignal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<T> {
    let abortListener: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const guard = new Promise<never>((_, reject) => {
      if (callerSignal?.aborted) {
        reject(new ApiClientError('请求已取消', { kind: 'aborted' }))
        return
      }
      if (callerSignal) {
        abortListener = () => reject(new ApiClientError('请求已取消', { kind: 'aborted' }))
        callerSignal.addEventListener('abort', abortListener, { once: true })
      }
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timer = setTimeout(() => {
          reject(
            new ApiClientError(`请求超时（${Math.ceil(timeoutMs / 1000)} 秒）`, { kind: 'timeout' }),
          )
        }, timeoutMs)
      }
    })
    try {
      const value = await Promise.race([shared, guard])
      return { ...value } as T
    } catch (error) {
      if (error instanceof ApiClientError) throw error
      // 发起者取消连带取消共享请求时，原生 AbortError 归一为 aborted；
      // 其余保持 network 语义，与发起者路径一致
      if ((error as Error)?.name === 'AbortError') {
        throw new ApiClientError('请求已取消', { kind: 'aborted', detail: errorDetail(error) })
      }
      throw new ApiClientError('网络请求失败', { kind: 'network', detail: errorDetail(error) })
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      if (callerSignal && abortListener) callerSignal.removeEventListener('abort', abortListener)
    }
  }

  return {
    async request<T extends object>(url: string, options: ApiRequestOptions = {}): Promise<T> {
      const callerSignal = options.signal
      if (callerSignal?.aborted) {
        throw new ApiClientError('请求已取消', { kind: 'aborted' })
      }

      const headers = new Headers(options.headers)
      const hasBody = options.body !== undefined
      const method = (options.method ?? GET_METHOD).toUpperCase()
      const isCacheableGet = method === GET_METHOD && !hasBody

      if (isCacheableGet) {
        const cached = responseCache.get(url)
        if (cached && cached.expiresAt > Date.now()) {
          return { ...cached.value } as T
        }
        if (cached) responseCache.delete(url)

        const pending = inflight.get(requestKey(url, method))
        if (pending) {
          return awaitShared<T>(pending, callerSignal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
        }
      }

      let serializedBody: string | undefined
      if (hasBody) {
        try {
          serializedBody = JSON.stringify(options.body)
        } catch (error) {
          throw new ApiClientError('请求数据无法序列化', {
            kind: 'network',
            detail: errorDetail(error),
          })
        }
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
      }

      const controller = new AbortController()
      let abortSource: 'caller' | 'timeout' | null = null
      let timeoutId: ReturnType<typeof setTimeout> | undefined

      const abortFromCaller = () => {
        if (abortSource !== null) return
        abortSource = 'caller'
        controller.abort()
      }
      if (callerSignal) callerSignal.addEventListener('abort', abortFromCaller, { once: true })

      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          if (abortSource !== null) return
          abortSource = 'timeout'
          controller.abort()
        }, timeoutMs)
      }

      const {
        body: _body,
        signal: _signal,
        timeoutMs: _timeoutMs,
        cacheTtlMs: _cacheTtlMs,
        validate,
        ...requestInit
      } = options

      // 发起前先占位 inflight：并发到达的 GET 在底层 fetch 未完成前即可搭车。
      // 失败的请求同样从 inflight 移除（finally），同 URL 后续请求重新发起。
      const key = requestKey(url, method)
      const shared: Promise<ApiResponseObject> = (async () => {
        try {
          const response = await fetchImplementation(url, {
            ...requestInit,
            headers,
            body: serializedBody,
            signal: controller.signal,
          })

          let text: string
          try {
            text = await response.text()
          } catch (error) {
            if (abortSource !== null) throw error
            throw invalidResponse(response.status, '响应正文未能完整读取')
          }
          if (!text.trim()) throw invalidResponse(response.status, '响应正文为空')

          let parsed: unknown
          try {
            parsed = JSON.parse(text)
          } catch {
            throw invalidResponse(response.status, '响应正文不是完整、有效的 JSON')
          }
          if (!isResponseObject(parsed)) {
            throw invalidResponse(response.status, 'JSON 顶层必须是对象')
          }

          if (!response.ok) throw httpFailure(response, parsed)
          if (parsed.ok === false) {
            throw explicitFailure(response, parsed)
          }
          if (validate && !validate(parsed)) {
            throw invalidResponse(response.status, '响应对象不符合预期格式', parsed)
          }
          return parsed
        } finally {
          inflight.delete(key)
        }
      })()
      if (isCacheableGet) inflight.set(key, shared)

      try {
        const parsed = await shared
        const cacheTtlMs = options.cacheTtlMs
        if (isCacheableGet) {
          if (typeof cacheTtlMs === 'number' && Number.isFinite(cacheTtlMs) && cacheTtlMs > 0) {
            responseCache.set(url, { value: parsed, expiresAt: Date.now() + cacheTtlMs })
          }
        } else {
          // 写请求成功即失效同 URL 缓存，防止 saveHostConfig 之后再读到旧配置
          responseCache.delete(url)
        }
        return parsed as T
      } catch (error) {
        if (error instanceof ApiClientError) throw error
        if (abortSource === 'caller') {
          throw new ApiClientError('请求已取消', { kind: 'aborted', detail: errorDetail(error) })
        }
        if (abortSource === 'timeout') {
          throw new ApiClientError(`请求超时（${Math.ceil(timeoutMs / 1000)} 秒）`, {
            kind: 'timeout',
            detail: errorDetail(error),
          })
        }
        throw new ApiClientError('网络请求失败', {
          kind: 'network',
          detail: errorDetail(error),
        })
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        if (callerSignal) callerSignal.removeEventListener('abort', abortFromCaller)
      }
    },
  }
}

export const apiClient = createApiClient()
