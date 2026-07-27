export function escapeHtml(value: unknown): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function inferEmotion(text: string, character = ''): string {
  if (/害羞|脸红|不好意思|才不是|笨蛋/.test(text)) return 'shy'
  if (/开心|高兴|太好了|哈哈|笑|期待|终于/.test(text)) return 'happy'
  if (/难过|寂寞|想念|对不起|抱歉|失落/.test(text)) return 'sad'
  if (/认真|必须|小心|危险|不许|别逞强|注意/.test(text)) return 'serious'
  if (/温柔|谢谢|陪着|安心|辛苦|休息|没关系/.test(text)) return 'gentle'
  if (character === 'nene' && /那个|其实|愿意|可以吗/.test(text)) return 'shy'
  if (character === 'natsume' && /真是的|算了|我在|放心/.test(text)) return 'gentle'
  return 'neutral'
}

export function fixWavHeader(buffer: ArrayBuffer): ArrayBuffer {
  try {
    const view = new DataView(buffer)
    if (buffer.byteLength < 44) return buffer
    if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) return buffer
    view.setUint32(4, buffer.byteLength - 8, true)
    let position = 12
    while (position + 8 <= buffer.byteLength) {
      const tag = view.getUint32(position, false)
      const size = view.getUint32(position + 4, true)
      if (tag === 0x64617461) { view.setUint32(position + 4, buffer.byteLength - position - 8, true); break }
      if (size > buffer.byteLength || position + 8 + size > buffer.byteLength + 1) break
      position += 8 + size + (size % 2)
    }
  } catch {}
  return buffer
}

export class SentenceBuffer {
  minimumLength: number
  maximumLength: number
  immediateFirst: boolean
  buffer = ''
  short = ''
  emitted = 0

  constructor(options: { minimumLength?: number; maximumLength?: number; immediateFirst?: boolean } = {}) {
    this.minimumLength = options.minimumLength ?? 4
    this.maximumLength = options.maximumLength ?? 100
    this.immediateFirst = Boolean(options.immediateFirst)
  }

  reset() { this.buffer = ''; this.short = ''; this.emitted = 0 }

  push(fragment: string, flush = false): string[] {
    this.buffer += String(fragment || '')
    const complete: string[] = []
    let start = 0
    for (let i = 0; i < this.buffer.length; i++) {
      const boundary = /[。！？!?；;\n]/.test(this.buffer[i])
      const forced = i - start + 1 >= this.maximumLength && /[，、,\s]/.test(this.buffer[i])
      if (!boundary && !forced) continue
      const s = this.buffer.slice(start, i + 1).trim()
      if (s) complete.push(s)
      start = i + 1
    }
    this.buffer = this.buffer.slice(start)
    if (this.buffer.length >= this.maximumLength) {
      complete.push(this.buffer.slice(0, this.maximumLength).trim())
      this.buffer = this.buffer.slice(this.maximumLength)
    }
    if (flush && this.buffer.trim()) { complete.push(this.buffer.trim()); this.buffer = '' }
    const output: string[] = []
    complete.forEach((sentence, idx) => {
      let val = this.short + sentence; this.short = ''
      const isLast = idx === complete.length - 1
      const allowShort = this.immediateFirst && this.emitted === 0
      if (!flush && isLast && !allowShort && val.length < this.minimumLength) { this.short = val }
      else { output.push(val); this.emitted++ }
    })
    if (flush && this.short) { output.push(this.short); this.emitted++; this.short = '' }
    return output.filter(Boolean)
  }
}

async function errorFromResponse(response: Response, fallback: string): Promise<Error> {
  const text = await response.text()
  try {
    const data = JSON.parse(text)
    const error = Object.assign(new Error(data.error || fallback), { detail: data.detail || '' })
    return error
  } catch {
    return new Error(text.trim() || fallback)
  }
}

export async function parseNdjsonResponse(response: Response, onEvent: (e: unknown) => Promise<void> | void): Promise<void> {
  if (!response.ok) throw await errorFromResponse(response, '聊天请求失败')
  if (!response.body || typeof response.body.getReader !== 'function') throw new Error('当前浏览器不支持流式聊天')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const consume = async (line: string) => {
    if (!line.trim()) return
    let event: unknown
    try { event = JSON.parse(line) } catch { throw new Error('聊天流返回了无效数据') }
    if ((event as any).type === 'error') throw new Error((event as any).error || '聊天流中断')
    await onEvent(event)
  }
  while (true) {
    const result = await reader.read()
    buffer += decoder.decode(result.value || new Uint8Array(), { stream: !result.done })
    const lines = buffer.split('\n'); buffer = lines.pop()!
    for (const line of lines) await consume(line)
    if (result.done) break
  }
  buffer += decoder.decode()
  if (buffer.trim()) await consume(buffer)
}

export function isAbortError(error: unknown): boolean {
  return Boolean(error && ((error as any).name === 'AbortError' || (error as any).code === 'ABORT_ERR'))
}

export async function responseError(response: Response, fallback: string): Promise<Error> {
  return errorFromResponse(response, fallback)
}
