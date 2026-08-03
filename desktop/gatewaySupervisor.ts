import http from 'node:http'

export interface GatewayChild {
  once(event: 'exit', listener: (code: number) => void): this
  kill(): void
  stdout?: NodeJS.ReadableStream | null
  stderr?: NodeJS.ReadableStream | null
}

export interface GatewayForkOptions {
  cwd: string
  env: NodeJS.ProcessEnv
  stdio: 'pipe'
}

export type GatewayFork = (
  modulePath: string,
  args: string[],
  options: GatewayForkOptions,
) => GatewayChild

export interface GatewaySupervisorOptions {
  host?: string
  port?: number
  cwd: string
  serverPath: string
  env?: NodeJS.ProcessEnv
  fork: GatewayFork
  waitMs?: number
  onExit?: (code: number) => void
}

export function gatewayUrl(host = '127.0.0.1', port = 3000): string {
  return `http://${host}:${port}`
}

export function isGatewayHealthy(baseUrl: string, timeoutMs = 1200): Promise<boolean> {
  return new Promise(resolve => {
    const request = http.get(`${baseUrl}/api/health`, response => {
      response.resume()
      resolve(response.statusCode === 200)
    })
    request.setTimeout(timeoutMs, () => {
      request.destroy()
      resolve(false)
    })
    request.once('error', () => resolve(false))
  })
}

export class GatewaySupervisor {
  readonly baseUrl: string
  private readonly options: Required<Pick<GatewaySupervisorOptions, 'host' | 'port' | 'waitMs'>> & GatewaySupervisorOptions
  private child: GatewayChild | null = null
  private owned = false
  private exited = false
  private stopping = false

  constructor(options: GatewaySupervisorOptions) {
    this.options = {
      host: options.host || '127.0.0.1',
      port: options.port || 3000,
      waitMs: options.waitMs || 20_000,
      ...options,
    }
    this.baseUrl = gatewayUrl(this.options.host, this.options.port)
  }

  get ownsGateway(): boolean {
    return this.owned
  }

  async start(): Promise<string> {
    if (await isGatewayHealthy(this.baseUrl)) return this.baseUrl

    this.exited = false
    this.stopping = false
    this.child = this.options.fork(this.options.serverPath, [], {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        ...this.options.env,
        HOST: this.options.host,
        PORT: String(this.options.port),
        DISABLE_TUNNEL: '1',
      },
      stdio: 'pipe',
    })
    this.owned = true
    const child = this.child
    child.stdout?.resume()
    child.stderr?.resume()
    child.once('exit', code => {
      const unexpected = !this.stopping
      this.exited = true
      this.stopping = false
      if (this.child === child) {
        this.child = null
        this.owned = false
      }
      if (unexpected) this.options.onExit?.(code)
    })

    const startedAt = Date.now()
    while (Date.now() - startedAt < this.options.waitMs) {
      if (this.exited) break
      if (await isGatewayHealthy(this.baseUrl)) return this.baseUrl
      await new Promise(resolve => setTimeout(resolve, 250))
    }

    await this.stop()
    throw new Error(`Gateway did not become healthy at ${this.baseUrl}`)
  }

  async stop(): Promise<void> {
    if (!this.child || !this.owned) return
    const child = this.child
    this.child = null
    this.owned = false
    this.stopping = true
    await new Promise<void>(resolve => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      child.once('exit', finish)
      child.kill()
      setTimeout(finish, 2000)
    })
    this.stopping = false
  }
}
