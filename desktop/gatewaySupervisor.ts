import http from 'node:http'
import net from 'node:net'

export const DESKTOP_GATEWAY_PROTOCOL = 1

export interface GatewayHealth {
  ok: boolean
  app: string
  desktopProtocol: number
}

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
  /** 转发网关子进程输出（诊断日志用）；chunk 可能是半个多字节字符 */
  onOutput?: (stream: 'stdout' | 'stderr', text: string) => void
}

export function gatewayUrl(host = '127.0.0.1', port = 3000): string {
  return `http://${host}:${port}`
}

export function readGatewayHealth(baseUrl: string, timeoutMs = 1200): Promise<GatewayHealth | null> {
  return new Promise(resolve => {
    let settled = false
    const finish = (health: GatewayHealth | null) => {
      if (settled) return
      settled = true
      resolve(health)
    }
    const request = http.get(`${baseUrl}/api/health`, response => {
      if (response.statusCode !== 200) {
        response.resume()
        finish(null)
        return
      }
      const chunks: Buffer[] = []
      let length = 0
      response.on('data', (chunk: Buffer) => {
        length += chunk.length
        if (length > 64 * 1024) {
          request.destroy()
          finish(null)
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        try {
          const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (!value || typeof value !== 'object') return finish(null)
          const health = value as Record<string, unknown>
          finish({
            ok: health.ok === true,
            app: typeof health.app === 'string' ? health.app : '',
            desktopProtocol: Number(health.desktopProtocol) || 0,
          })
        } catch {
          finish(null)
        }
      })
      response.once('aborted', () => finish(null))
      response.once('error', () => finish(null))
    })
    request.setTimeout(timeoutMs, () => {
      request.destroy()
      finish(null)
    })
    request.once('error', () => finish(null))
  })
}

export async function isGatewayHealthy(baseUrl: string, timeoutMs = 1200): Promise<boolean> {
  return (await readGatewayHealth(baseUrl, timeoutMs))?.ok === true
}

export function isDesktopGatewayCompatible(health: GatewayHealth | null): boolean {
  return health?.ok === true
    && health.app === 'ai-cg-studio'
    && health.desktopProtocol === DESKTOP_GATEWAY_PROTOCOL
}

export function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer()
    let settled = false
    const finish = (available: boolean) => {
      if (settled) return
      settled = true
      resolve(available)
    }
    server.unref()
    server.once('error', () => finish(false))
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => finish(true))
    })
  })
}

export async function findAvailablePort(host: string, startPort: number, attempts = 32): Promise<number> {
  const firstPort = startPort >= 1024 && startPort <= 65_535 ? startPort : 3000
  for (let offset = 0; offset < attempts; offset += 1) {
    const candidate = firstPort + offset
    const port = candidate <= 65_535 ? candidate : 3000 + (candidate - 65_536)
    if (await isPortAvailable(host, port)) return port
  }
  throw new Error(`No available desktop gateway port from ${firstPort}`)
}

export class GatewaySupervisor {
  private readonly options: Required<Pick<GatewaySupervisorOptions, 'host' | 'port' | 'waitMs'>> & GatewaySupervisorOptions
  private activePort: number
  private child: GatewayChild | null = null
  private owned = false
  private exited = false
  private stopping = false
  private starting: Promise<string> | null = null

  constructor(options: GatewaySupervisorOptions) {
    this.options = {
      host: options.host || '127.0.0.1',
      port: options.port || 3000,
      waitMs: options.waitMs || 20_000,
      ...options,
    }
    this.activePort = this.options.port
  }

  get baseUrl(): string {
    return gatewayUrl(this.options.host, this.activePort)
  }

  get ownsGateway(): boolean {
    return this.owned
  }

  get port(): number {
    return this.activePort
  }

  async isHealthy(): Promise<boolean> {
    return isDesktopGatewayCompatible(await readGatewayHealth(this.baseUrl))
  }

  async start(): Promise<string> {
    if (this.starting) return this.starting
    this.stopping = false
    const operation = this.startInternal()
    this.starting = operation
    try {
      return await operation
    } finally {
      if (this.starting === operation) this.starting = null
    }
  }

  private async startInternal(): Promise<string> {
    if (this.stopping) throw new Error('Gateway start cancelled')
    const existingHealth = await readGatewayHealth(this.baseUrl)
    if (this.stopping) throw new Error('Gateway start cancelled')
    if (isDesktopGatewayCompatible(existingHealth)) return this.baseUrl

    if (!(await isPortAvailable(this.options.host, this.activePort))) {
      this.activePort = await findAvailablePort(this.options.host, this.options.port + 1)
    }

    if (this.stopping) throw new Error('Gateway start cancelled')

    this.exited = false
    this.child = this.options.fork(this.options.serverPath, [], {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        ...this.options.env,
        HOST: this.options.host,
        PORT: String(this.activePort),
        DISABLE_TUNNEL: '1',
      },
      stdio: 'pipe',
    })
    this.owned = true
    const child = this.child
    const forwardOutput = (stream: 'stdout' | 'stderr', chunk: Buffer) => {
      this.options.onOutput?.(stream, chunk.toString('utf8'))
    }
    child.stdout?.on('data', chunk => forwardOutput('stdout', chunk as Buffer))
    child.stderr?.on('data', chunk => forwardOutput('stderr', chunk as Buffer))
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
      if (this.exited || this.stopping) break
      const health = await readGatewayHealth(this.baseUrl)
      if (this.stopping) break
      if (isDesktopGatewayCompatible(health)) return this.baseUrl
      await new Promise(resolve => setTimeout(resolve, 250))
    }

    await this.stop()
    throw new Error(`Gateway did not become healthy at ${this.baseUrl}`)
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (!this.child || !this.owned) return
    const child = this.child
    this.child = null
    this.owned = false
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
