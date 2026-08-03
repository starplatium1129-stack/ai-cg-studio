import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

/**
 * 桌宠本地工具执行器（纯 Node，无 Electron 依赖，可直接单测）。
 *
 * 安全边界：
 * - 所有路径解析后必须落在 AI 工作区（workspaceRoot）内（Windows 大小写不敏感）。
 * - 命令以参数数组 execFile 执行，不经过 shell —— 没有 `;`/`|`/`&&` 注入面。
 * - 读 256KB / 写 64KB / 命令 30s 超时 + 8KB 输出上限。
 */

export interface ToolContext {
  workspaceRoot: string
}

export interface ToolResult {
  ok: boolean
  output: string
  /** read_image 工具：图片的 data URL（base64），供多模态消息回传视觉模型 */
  imageDataUrl?: string
}

const MAX_READ_BYTES = 1024 * 1024
const MAX_WRITE_BYTES = 512 * 1024
const MAX_COMMAND_OUTPUT = 64 * 1024
const COMMAND_TIMEOUT_MS = 120_000
const MAX_DISPLAY_CHARS = 500_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_MAGIC: Array<{ magic: number[]; mime: string }> = [
  { magic: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { magic: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { magic: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },
  { magic: [0x47, 0x49, 0x46], mime: 'image/gif' },
]

function sniffImageMime(buffer: Buffer): string | null {
  for (const candidate of IMAGE_MAGIC) {
    if (candidate.magic.every((byte, index) => buffer[index] === byte)) return candidate.mime
  }
  return null
}

export function isPathInsideWorkspace(workspaceRoot: string, candidate: string): boolean {
  const root = path.resolve(workspaceRoot)
  const resolved = path.resolve(candidate)
  const rootKey = root.toLowerCase()
  const resolvedKey = resolved.toLowerCase()
  if (resolvedKey === rootKey) return true
  return resolvedKey.startsWith(rootKey + path.sep.toLowerCase())
}

export function resolveWorkspacePath(workspaceRoot: string, relative: string): string {
  const root = path.resolve(workspaceRoot)
  const clean = String(relative || '').trim().replace(/\\/g, '/')
  if (!clean || clean === '.') return root
  if (clean.startsWith('/') || /^[a-zA-Z]:/.test(clean)) {
    throw new Error('只接受工作区内的相对路径')
  }
  if (clean.split('/').some(part => part === '..')) {
    throw new Error('路径不能包含 ..')
  }
  const resolved = path.resolve(root, clean)
  if (!isPathInsideWorkspace(root, resolved)) {
    throw new Error('路径超出 AI 工作区范围')
  }
  return resolved
}

function formatEntryName(entry: fs.Dirent): string {
  return entry.isDirectory() ? entry.name + '/' : entry.name
}

export async function runTool(context: ToolContext, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const root = path.resolve(context.workspaceRoot || '.')
  const fail = (error: unknown): ToolResult => ({
    ok: false,
    output: String(error instanceof Error ? error.message : error).slice(0, 2000),
  })
  try {
    switch (name) {
      case 'list_files': {
        const dir = resolveWorkspacePath(root, String(args.path ?? ''))
        let entries: fs.Dirent[]
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true })
        } catch (error) {
          return fail(new Error(`目录不存在或不可读：${String(error instanceof Error ? error.message : error)}`))
        }
        const rows = entries
          .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
          .slice(0, 200)
          .map(entry => {
            let extra = ''
            if (!entry.isDirectory()) {
              try {
                const stat = fs.statSync(path.join(dir, entry.name))
                extra = ` (${stat.size} B)`
              } catch { /* 忽略瞬时不可读 */ }
            }
            return formatEntryName(entry) + extra
          })
        const count = entries.length > 200 ? `（前 200 项，共 ${entries.length} 项）` : `共 ${entries.length} 项`
        return { ok: true, output: `[${dir}]\n${rows.join('\n') || '(空目录)'}\n${count}` }
      }
      case 'read_file': {
        const file = resolveWorkspacePath(root, String(args.path ?? ''))
        const stat = await fs.promises.stat(file).catch((error: unknown) => {
          throw new Error(`文件不存在：${String(error instanceof Error ? error.message : error)}`)
        })
        if (!stat.isFile()) throw new Error('目标不是文件')
        if (stat.size > MAX_READ_BYTES) throw new Error(`文件超过 ${MAX_READ_BYTES / 1024}KB 读取上限`)
        const buffer = await fs.promises.readFile(file)
        if (buffer.includes(0)) throw new Error('看起来是二进制文件，不读取')
        let text = buffer.toString('utf8')
        if (text.length > MAX_DISPLAY_CHARS) text = text.slice(0, MAX_DISPLAY_CHARS) + '\n…（内容已截断）'
        return { ok: true, output: text }
      }
      case 'write_file': {
        const file = resolveWorkspacePath(root, String(args.path ?? ''))
        const content = String(args.content ?? '')
        if (content.length > MAX_WRITE_BYTES) throw new Error(`内容超过 ${MAX_WRITE_BYTES / 1024}KB 写入上限`)
        await fs.promises.mkdir(path.dirname(file), { recursive: true })
        const temporary = `${file}.${process.pid}.tool.tmp`
        await fs.promises.writeFile(temporary, content, 'utf8')
        await fs.promises.rename(temporary, file)
        return { ok: true, output: `已写入 ${path.relative(root, file) || path.basename(file)}（${content.length} 字符）` }
      }
      case 'run_command': {
        const command = String(args.command ?? '').trim()
        const rawArgs = Array.isArray(args.args) ? args.args.map(String) : []
        if (!command) throw new Error('缺少命令')
        if (command.length > 256) throw new Error('命令名过长')
        if (rawArgs.length > 16) throw new Error('参数过多')
        if (rawArgs.some(arg => arg.length > 256)) throw new Error('参数过长')
        const output = await new Promise<string>((resolve, reject) => {
          const child = execFile(
            command,
            rawArgs,
            {
              cwd: root,
              timeout: COMMAND_TIMEOUT_MS,
              maxBuffer: MAX_COMMAND_OUTPUT,
              windowsHide: true,
              env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
            },
            (error, stdout, stderr) => {
              const combined = `${stdout || ''}${stderr || ''}`.trim()
              if (error && !combined) {
                reject(new Error(`命令执行失败：${error.message}`))
                return
              }
              resolve(combined || `（命令已执行，无输出）`)
            },
          )
          child.stdin?.end()
        })
        return { ok: true, output: output.slice(0, MAX_COMMAND_OUTPUT) }
      }
      case 'read_image': {
        const file = resolveWorkspacePath(root, String(args.path ?? ''))
        const stat = await fs.promises.stat(file).catch((error: unknown) => {
          throw new Error(`文件不存在：${String(error instanceof Error ? error.message : error)}`)
        })
        if (!stat.isFile()) throw new Error('目标不是文件')
        if (stat.size > MAX_IMAGE_BYTES) throw new Error(`图片超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB 上限`)
        const buffer = await fs.promises.readFile(file)
        const mime = sniffImageMime(buffer)
        if (!mime) throw new Error('不支持的文件格式（仅 PNG / JPEG / WebP / GIF）')
        const imageDataUrl = `data:${mime};base64,${buffer.toString('base64')}`
        return {
          ok: true,
          output: `已读取图片 ${path.relative(root, file) || path.basename(file)}（${stat.size} B，${mime.replace('image/', '')}）`,
          imageDataUrl,
        }
      }
      case 'get_workspace_info': {
        const exists = fs.existsSync(root)
        return { ok: true, output: JSON.stringify({ workspaceRoot: root, exists, os: process.platform }) }
      }
      default:
        throw new Error(`未知工具：${name}`)
    }
  } catch (error) {
    return fail(error)
  }
}
