import fs from 'node:fs'
import path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface FileLoggerOptions {
  filePath: string
  /** 单文件轮转阈值（字节），默认 512KB */
  maxBytes?: number
  /** 保留的轮转文件份数，默认 3 */
  maxFiles?: number
  /** 最低输出级别，默认 info */
  level?: LogLevel
}

export interface FileLogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
  log(level: LogLevel, message: string): void
  /** 同步刷盘（appendFileSync 本身即时写，保留以对齐接口） */
  flush(): void
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function formatLine(level: LogLevel, message: string): string {
  const iso = new Date().toISOString()
  return `${iso} [${level.toUpperCase()}] ${message.replace(/\s*\n/g, ' ').slice(0, 4000)}\n`
}

/**
 * 主进程文件日志：同步追加写入 + 按大小轮转。
 * 所有写入失败都静默降级（日志不能反过来让桌面壳崩溃）。
 */
export function createFileLogger(options: FileLoggerOptions): FileLogger {
  const maxBytes = Math.max(16 * 1024, Math.min(Math.round(options.maxBytes || 512 * 1024), 16 * 1024 * 1024))
  const maxFiles = Math.max(1, Math.min(Math.round(options.maxFiles || 3), 16))
  const minLevel = LEVEL_ORDER[options.level || 'info']

  function rotate(): void {
    try {
      const oldest = `${options.filePath}.${maxFiles}`
      if (fs.existsSync(oldest)) fs.rmSync(oldest)
      for (let index = maxFiles - 1; index >= 1; index -= 1) {
        const from = `${options.filePath}.${index}`
        if (fs.existsSync(from)) fs.renameSync(from, `${options.filePath}.${index + 1}`)
      }
      if (fs.existsSync(options.filePath)) fs.renameSync(options.filePath, `${options.filePath}.1`)
    } catch {
      // 轮转失败不阻塞写入；下次写入会再尝试
    }
  }

  function write(level: LogLevel, message: string): void {
    if (LEVEL_ORDER[level] < minLevel) return
    try {
      fs.mkdirSync(path.dirname(options.filePath), { recursive: true })
      const stats = fs.existsSync(options.filePath) ? fs.statSync(options.filePath) : null
      if (stats && stats.size > maxBytes) rotate()
      fs.appendFileSync(options.filePath, formatLine(level, message), 'utf8')
    } catch {
      // 静默：磁盘不可写时桌面功能优先于诊断日志
    }
  }

  return {
    debug: message => write('debug', message),
    info: message => write('info', message),
    warn: message => write('warn', message),
    error: message => write('error', message),
    log: (level, message) => write(level, message),
    flush: () => {
      // appendFileSync 同步写入后即落盘；此处保留接口供测试与退出前调用
    },
  }
}
