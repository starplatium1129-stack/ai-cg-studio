import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import {
  cancelVideoBatch,
  concatVideoBatch,
  createVideoBatch,
  fetchVideoBatch,
  retryVideoShot,
  type VideoBatch,
  type VideoQuality,
} from '@/api/videoApi'
import type { ShotDraft } from './shotListTypes'
import type { ShotCastRef } from './useReferenceCards'

export interface ShotBatchMachineDeps {
  shots: Ref<ShotDraft[]>
  identityCard: Ref<string>
  aspectRatio: Ref<VideoBatch['aspectRatio']>
  quality: Ref<VideoQuality>
  steps: Ref<4 | 8>
  linkLastFrame: Ref<boolean>
  /** 镜头 → Ref2VA 参考图文件名数组（useReferenceCards.shotReferences）。 */
  shotReferences: (shot: ShotCastRef) => string[] | undefined
  h3Ready: ComputedRef<boolean>
  /** ComfyUI 在线（props.status.online）。 */
  online: ComputedRef<boolean>
  /** 宿主持有的用户可见错误通道（提交/轮询/重抽失败回写）。 */
  batchError: Ref<string>
}

/**
 * 分镜编辑器·批量提交状态机（2026-08-22 自 ShotListEditor 下沉）。
 *
 * 持有整批任务（VideoBatch）生命周期：提交（逐镜组装载荷，身份锚点前置）、
 * 3s 轮询（running/paused 才续订）、取消、单镜/整批重抽、拼接成片。
 * 卸载时自动停轮询；镜头草稿编辑与 AI 整理仍归宿主。
 */
export function useShotBatchMachine(deps: ShotBatchMachineDeps) {
  const { shots, identityCard, aspectRatio, quality, steps, linkLastFrame, shotReferences, h3Ready, online, batchError } = deps

  const batch = ref<VideoBatch | null>(null)
  const submitting = ref(false)
  const cancelling = ref(false)
  const concating = ref(false)
  let pollTimer = 0
  let disposed = false

  const batchActive = computed(() => batch.value?.status === 'running')
  const canSubmit = computed(() =>
    shots.value.length > 0
    && shots.value.every((shot) => shot.prompt.trim().length >= 8 && shot.prompt.trim().length <= 4000)
    && !submitting.value
    && !batchActive.value
    && online.value)
  const canConcat = computed(() =>
    batch.value !== null
    && (batch.value.progress.succeeded >= 2)
    && !batch.value.concatAvailable
    && batch.value.status === 'done')
  const progressPercent = computed(() => {
    const total = batch.value?.progress.total ?? 0
    if (!total) return 0
    const done = batch.value?.progress.succeeded ?? 0
    const failed = batch.value?.progress.failed ?? 0
    return Math.min(100, Math.round(((done + failed) / total) * 100))
  })

  function serverShot(index: number) {
    return batch.value?.shots[index] ?? null
  }

  function parsedSeed(shot: ShotDraft): number | undefined {
    if (!shot.seedText.trim()) return undefined
    const value = Number(shot.seedText)
    return Number.isSafeInteger(value) && value >= 0 && value <= 0x7fffffff ? value : undefined
  }

  async function submitBatch() {
    if (!canSubmit.value || !h3Ready.value) return
    submitting.value = true
    batchError.value = ''
    try {
      const response = await createVideoBatch({
        modelId: 'minimax-h3',
        aspectRatio: aspectRatio.value,
        quality: quality.value,
        steps: steps.value,
        linkLastFrame: linkLastFrame.value,
        shots: shots.value.map((shot) => {
          const prompt = [identityCard.value.trim(), shot.prompt.trim()].filter(Boolean).join('\n')
          return {
            prompt,
            dialogue: shot.dialogue.trim() || undefined,
            shotSize: shot.shotSize || undefined,
            camera: shot.camera,
            motion: shot.motion,
            duration: shot.duration,
            seed: parsedSeed(shot),
            image: shot.imageName || undefined,
            references: shotReferences(shot),
          }
        }),
      })
      batch.value = response.batch
      schedulePoll()
    } catch (error) {
      batchError.value = error instanceof Error ? error.message : '批量提交失败'
    } finally {
      submitting.value = false
    }
  }

  async function pollBatch() {
    if (!batch.value || disposed) return
    try {
      const response = await fetchVideoBatch(batch.value.id)
      batch.value = response.batch
    } catch (error) {
      batchError.value = error instanceof Error ? error.message : '批量状态读取失败'
    } finally {
      schedulePoll()
    }
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer)
    if (!batch.value || disposed) return
    if (batch.value.status !== 'running' && batch.value.status !== 'paused') return
    pollTimer = window.setTimeout(() => { void pollBatch() }, 3000)
  }

  async function cancelBatch() {
    if (!batch.value || cancelling.value) return
    cancelling.value = true
    try {
      const response = await cancelVideoBatch(batch.value.id)
      batch.value = response.batch
    } catch (error) {
      batchError.value = error instanceof Error ? error.message : '整批取消失败'
    } finally {
      cancelling.value = false
    }
  }

  async function retryShotAt(index: number) {
    if (!batch.value) return
    try {
      const response = await retryVideoShot(batch.value.id, index + 1)
      batch.value = response.batch
      schedulePoll()
    } catch (error) {
      batchError.value = error instanceof Error ? error.message : '重抽失败'
    }
  }

  async function retryAllFailed() {
    if (!batch.value) return
    for (let index = 0; index < batch.value.shots.length; index += 1) {
      const shot = batch.value.shots[index]
      if (shot.status === 'failed' || shot.status === 'cancelled') {
        try {
          const response = await retryVideoShot(batch.value.id, index + 1)
          batch.value = response.batch
        } catch (error) {
          batchError.value = error instanceof Error ? error.message : '重抽失败'
          return
        }
      }
    }
    schedulePoll()
  }

  async function concatBatch() {
    if (!batch.value || concating.value) return
    concating.value = true
    try {
      const response = await concatVideoBatch(batch.value.id)
      batch.value = response.batch
    } catch (error) {
      batchError.value = error instanceof Error ? error.message : '拼接失败'
    } finally {
      concating.value = false
    }
  }

  onBeforeUnmount(() => {
    disposed = true
    window.clearTimeout(pollTimer)
  })

  return {
    batch,
    submitting,
    cancelling,
    concating,
    batchActive,
    canSubmit,
    canConcat,
    progressPercent,
    serverShot,
    submitBatch,
    cancelBatch,
    retryShotAt,
    retryAllFailed,
    concatBatch,
  }
}
