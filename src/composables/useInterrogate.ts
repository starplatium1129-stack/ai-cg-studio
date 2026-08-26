import { ref } from 'vue'

export type InterrogateMode = 'tag' | 'caption'
export interface InterrogateResult {
  engine: string
  mode: InterrogateMode
  threshold: number
  tags: string[]
  scores: Record<string, number>
  caption: string
  warning?: string
}

const API = '/api/interrogate'
const MAX_BYTES = 12 * 1024 * 1024

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

export function useInterrogate() {
  const busy = ref(false)
  const error = ref<string | null>(null)
  const lastResult = ref<InterrogateResult | null>(null)

  async function interrogate(file: File, mode: InterrogateMode = 'tag', threshold = 0.35): Promise<InterrogateResult | null> {
    if (!file) throw new Error('请选择图片')
    if (file.size > MAX_BYTES) throw new Error('图片超过 12MB 限制')
    if (!file.type.startsWith('image/')) throw new Error('仅支持图片文件')
    busy.value = true
    error.value = null
    try {
      const dataUrl = await fileToDataUrl(file)
      // 后端接受 base64 或 dataURL，传 dataURL 更省一次前缀判断
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mode: mode, threshold: threshold })
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: InterrogateResult; error?: string; message?: string } | null
      if (!res.ok || !json || json.ok !== true) {
        const msg = (json && (json.error || json.message)) || '反推失败：' + res.status
        throw new Error(msg)
      }
      const data = json.data as InterrogateResult
      lastResult.value = data
      return data
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = message || '反推失败'
      throw e
    } finally {
      busy.value = false
    }
  }

  return { busy, error, lastResult, interrogate }
}
