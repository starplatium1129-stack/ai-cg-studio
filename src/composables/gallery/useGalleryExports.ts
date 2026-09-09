import { imgGet } from '@/composables/useImageStore'
import { buildArtworkFileName } from '@/utils/artworkFileName'
import { formatA1111Parameters,injectPngMetadata } from '@/utils/pngMetadata'
import type { useGalleryWorkspace } from './useGalleryWorkspace'
type Context = Pick<ReturnType<typeof useGalleryWorkspace>, "current" | "stamp" | "sceneTitle" | "characterName" | "showToast" | "cardUrls" | "viewerUrl" | "thumbUrls">
export function useGalleryExports({ current, stamp, sceneTitle, characterName, showToast, cardUrls, viewerUrl, thumbUrls }: Context): { downloadCurrent: () => Promise<void> } {
async function downloadCurrent() {
  const item = current.value
  if (!item) return
  // 2026-09-01 文件名去重：旧方案「标题-seed」同场景同 seed 会撞名，
  // 新方案带上时间戳与 id 尾号（见 utils/artworkFileName.ts）。
  // artworkTimestamp 会给老记录兜底（字符串时间 / 纯数字 id），拿不到才是真没有。
  const ts = stamp(item)
  const fileName = buildArtworkFileName({
    title: sceneTitle(item.scene, item),
    character: item.character ? characterName(item.character, item) : undefined,
    timestamp: ts > 0 ? ts : undefined,
    seed: item.seed,
    id: item.id,
    ext: 'png',
  })

  const metaText = formatA1111Parameters({
    prompt: item.prompt ? String(item.prompt) : undefined,
    negative: item.negative ? String(item.negative) : undefined,
    steps: item.steps ? Number(item.steps) : undefined,
    sampler: item.sampler ? String(item.sampler) : undefined,
    cfg: item.cfg ? Number(item.cfg) : undefined,
    seed: item.seed !== undefined && item.seed !== null ? item.seed : undefined,
    size: item.size ? String(item.size) : undefined,
    model: item.model ? String(item.model) : undefined,
    character: item.character ? String(item.character) : undefined,
  })

  let rawBlob: Blob | null = null
  if (item.image_id || item.id) {
    try {
      rawBlob = await imgGet(String(item.image_id || item.id))
    } catch { /* fallback below */ }
  }

  let finalBuffer: Uint8Array | null = null
  if (rawBlob) {
    try {
      const buffer = await rawBlob.arrayBuffer()
      finalBuffer = injectPngMetadata(buffer, metaText)
    } catch {
      finalBuffer = new Uint8Array(await rawBlob.arrayBuffer())
    }
  }

  // 桌面版：原生保存对话框，可自由选择保存位置
  if (window.companionDesktop && finalBuffer) {
    try {
      const result = await window.companionDesktop.saveImage({ data: finalBuffer, name: fileName })
      if (result.saved) showToast(`已保存到 ${result.filePath || '所选位置'}`)
      return
    } catch { /* 落到浏览器下载兜底 */ }
  }

  let url = ''
  if (finalBuffer) {
    const pngBlob = new Blob([new Uint8Array(finalBuffer.buffer as ArrayBuffer)], { type: 'image/png' })
    url = URL.createObjectURL(pngBlob)
  } else {
    url = cardUrls[item.id] || viewerUrl.value || thumbUrls[item.id] || ''
  }

  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  showToast('已下载原图（已嵌入完整 A1111/ComfyUI 咒文元数据）')
  if (finalBuffer) setTimeout(() => URL.revokeObjectURL(url), 2000)
}
return { downloadCurrent }
}
