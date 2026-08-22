import { ref } from 'vue'
import { apiClient } from '@/api/client'
import { uploadVideoImage } from '@/api/videoApi'
import type { ShotDraft } from './shotListTypes'

/**
 * useShotFirstFrames —— 分镜「一键首帧」：逐镜走 Krea2 增强链路出图（2026-08-23）。
 *
 * 剧本引擎在每镜带 firstFramePrompt（蓝图英文散文 + 景别构图句）；本组合式逐镜
 * 提交 /api/creative/jobs → 轮询 → 取结果图 → base64 上传为视频首帧受控文件 →
 * 回填 imageName/imageUrl。身份一致性不靠首帧（同蓝图四镜本就同场景），由分镜
 * Ref2VA 参考卡锁定。单镜失败不打断整批（与批量出片一致），重按只补缺。
 */

// Krea2 尺寸白名单按画幅映射：视频首帧构图与成片画幅一致。
const KREA2_SIZE_BY_ASPECT = {
  landscape: { width: 1536, height: 1024 },
  portrait: { width: 1024, height: 1536 },
  square: { width: 1024, height: 1024 },
} as const

type VideoAspect = keyof typeof KREA2_SIZE_BY_ASPECT

interface CreativeJobBody {
  ok: true
  job: { id: string; status: string; resultAvailable?: boolean; resultUrl?: string | null }
}

function isCreativeJobBody(value: Record<string, unknown>): value is Record<string, unknown> & CreativeJobBody {
  const job = value.job as Record<string, unknown> | undefined
  return value.ok === true && !!job && typeof job.id === 'string' && typeof job.status === 'string'
}

async function pollCreativeJob(id: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (Date.now() > deadline) throw new Error('首帧出图超时')
    const res = await apiClient.request<CreativeJobBody>(`/api/creative/jobs/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      timeoutMs: 12_000,
      validate: isCreativeJobBody,
    })
    if (res.job.status === 'failed') throw new Error('首帧出图失败')
    if (res.job.status === 'succeeded' && res.job.resultUrl) return res.job.resultUrl
    await new Promise(resolve => setTimeout(resolve, 2500))
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const comma = text.indexOf(',')
      if (comma < 0) reject(new Error('图片编码失败'))
      else resolve(text.slice(comma + 1))
    }
    reader.onerror = () => reject(new Error('图片编码失败'))
    reader.readAsDataURL(blob)
  })
}

export function useShotFirstFrames(options: { onError: (message: string) => void }) {
  const firstFrameBusy = ref(false)
  const firstFrameProgress = ref('')

  async function generateFirstFrames(shots: ShotDraft[], aspect: VideoAspect) {
    if (firstFrameBusy.value) return
    const pending = shots
      .map((shot, index) => ({ shot, index }))
      .filter(item => item.shot.firstFramePrompt && !item.shot.imageName)
    if (!pending.length) {
      options.onError('没有待生成首帧的镜头：先用「生成剧本」带出首帧提示词，已有首帧的镜头自动跳过')
      return
    }
    firstFrameBusy.value = true
    let failed = 0
    try {
      for (let i = 0; i < pending.length; i += 1) {
        const { shot } = pending[i]
        firstFrameProgress.value = `${i + 1}/${pending.length}`
        try {
          const size = KREA2_SIZE_BY_ASPECT[aspect]
          const submit = await apiClient.request<CreativeJobBody>('/api/creative/jobs', {
            method: 'POST',
            body: { prompt: shot.firstFramePrompt, modelId: 'krea2-turbo-fp8', ...size },
            timeoutMs: 30_000,
            validate: isCreativeJobBody,
          })
          const resultUrl = await pollCreativeJob(submit.job.id, 240_000)
          const blob = await (await fetch(resultUrl)).blob()
          const upload = await uploadVideoImage(await blobToBase64(blob))
          if (shot.imageUrl) URL.revokeObjectURL(shot.imageUrl)
          shot.imageName = upload.name
          shot.imageUrl = URL.createObjectURL(blob)
        } catch {
          failed += 1
        }
      }
      options.onError(failed ? `${failed} 个镜头首帧生成失败，重按「一键首帧」只补缺` : '')
    } finally {
      firstFrameBusy.value = false
      firstFrameProgress.value = ''
    }
  }

  return { firstFrameBusy, firstFrameProgress, generateFirstFrames }
}
