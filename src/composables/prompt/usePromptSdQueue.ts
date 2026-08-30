import { ref, watch, type ComputedRef, type Ref } from 'vue'
import { usePromptBuilderStore, type HistoryEntry } from '@/stores/promptBuilderStore'
import type { DrawEngine } from '@/storage/settingsRepository'
import { writeQuickCreate } from '@/utils/quickCreate'
import { SD_QUEUE_SNAPSHOT_KEY } from '@/utils/storageKeys'
import { classifySDError, type SDErrorReport } from '@/utils/sdError'
import type { useAnimaSession } from '@/composables/generation/useAnimaSession'
import type { useSDGenerate } from '@/composables/generation/useSDGenerate'
import type { usePromptAssembly } from '@/composables/prompt/usePromptAssembly'
import { useSDQueue, type SDQueueJob } from '@/composables/generation/useSDQueue'

type PromptBuilderStore = ReturnType<typeof usePromptBuilderStore>
type AnimaSession = ReturnType<typeof useAnimaSession>
type PromptAssembly = ReturnType<typeof usePromptAssembly>

export interface PromptSdQueueDeps {
  pb: PromptBuilderStore
  sd: ReturnType<typeof useSDGenerate>
  sdSize: Ref<string>
  drawEngine: Ref<DrawEngine>
  /** 面板实时组装的提示词（studio 路径；批量/热门另有组装）。 */
  livePrompt: ComputedRef<string>
  negativePrompt: PromptAssembly['negativePrompt']
  effectiveScene: PromptAssembly['effectiveScene']
  loraSpecs: PromptAssembly['loraSpecs']
  modelProfile: PromptAssembly['modelProfile']
  animaState: AnimaSession['state']
  displayResultSeed: ComputedRef<number | null>
}

/**
 * 绘图页「SD 出图任务执行 + 队列」簇（2026-08-22 自 PromptBuilderView 下沉）。
 *
 * 一条执行路径三处消费：直出（callGenerate）、队列（useSDQueue 串行）、
 * 批量（usePromptBatchRunners 注入 runJob）。含：面板状态 → 任务快照
 * （captureJob）、直出高分自动挂双 ADetailer（runJob）、队列产出自动入册
 * 历史、错误分类报告（sdErrorReport）与 3-Seed 候选变体入队。
 * Anima/Krea 直出与错误恢复动作（runRecovery）仍归宿主视图。
 */
export function usePromptSdQueue(deps: PromptSdQueueDeps) {
  const { pb, sd, sdSize, drawEngine, livePrompt, negativePrompt, effectiveScene, loraSpecs, modelProfile, animaState, displayResultSeed } = deps

  const sdErrorReport = ref<SDErrorReport | null>(null)
  function dismissError() { sdErrorReport.value = null }

  /**
   * 队列快照持久化（2026-08-30 UX 审计 P0-5）。
   *
   * 队列此前只活在 PromptBuilderView 作用域：离开页面（onUnmounted→dispose→
   * cancel）或刷新，pending 队列整组蒸发且无任何解释。现在 pending 任务实时
   * 落 localStorage，回到绘图页时恢复（置暂停，不自动开跑）；在途任务不保
   * 留——它已被真实取消，恢复一个早已死掉的 jobId 只会误导。
   */
  function readQueueSnapshot(): SDQueueJob[] {
    try {
      const raw = localStorage.getItem(SD_QUEUE_SNAPSHOT_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((job): job is SDQueueJob =>
        Boolean(job) && typeof job === 'object' && typeof (job as SDQueueJob).id === 'string')
    } catch { return [] }
  }

  function persistQueueSnapshot(jobs: readonly SDQueueJob[]) {
    try {
      if (!jobs.length) { localStorage.removeItem(SD_QUEUE_SNAPSHOT_KEY); return }
      localStorage.setItem(SD_QUEUE_SNAPSHOT_KEY, JSON.stringify(jobs))
    } catch { /* 快照写失败不阻断出图主链路 */ }
  }

  // 注意：watch 的 getter 在建立依赖时就会被立即执行一次，restore 也是同步调用
  // ——两者都读 sdQueue，而 sdQueue 是下方 useSDQueue(...) 的 const 声明，必须
  // 等它初始化之后才能挂（否则命中 TDZ，整个导演台在 setup 阶段就抛错）。
  // 因此这两个调用放在文件末尾的「队列接线」处，不要因为读起来更顺就往上挪。

  /** 把当前导演台状态快照成一个队列任务 */
  function captureJob(): Omit<SDQueueJob, 'id'> | null {
    if (!livePrompt.value) return null
    const scene = effectiveScene.value
    const story = String(pb.story || '').trim()
    return {
      title: scene?.title || (story ? story.slice(0, 28) : (pb.char === 'natsume' ? '夏目构图' : '宁宁构图')),
      prompt: livePrompt.value,
      negative: negativePrompt.value,
      sceneId: pb.sceneId,
      sceneTitle: scene?.title || '',
      char: pb.char,
      story,
      size: sdSize.value,
      seed: pb.sdParams.seedLock && pb.sdParams.seed >= 0 ? pb.sdParams.seed : -1,
      cfg: pb.sdParams.cfg,
      steps: pb.sdParams.steps,
      sampler: pb.sdParams.sampler,
      scheduler: pb.sdParams.scheduler || '',
      checkpoint: pb.sdModelName || sd.checkpoint.value || '',
      lora: loraSpecs.value.map(spec => `${spec.name}:${spec.weight}`).join(', '),
      hiresFix: pb.sdParams.hiresFix,
      hiresScale: pb.sdParams.hiresScale,
      hiresUpscaler: pb.sdParams.hiresUpscaler,
      hiresSteps: pb.sdParams.hiresSteps,
      denoisingStrength: pb.sdParams.hiresDenoise,
      faceDetailer: pb.sdParams.faceDetailer,
    }
  }

  function historyGenerationFields(): Partial<HistoryEntry> {
    if (drawEngine.value !== 'sd') {
      const meta = animaState.value.result?.metadata || animaState.value.job
      if (!meta) return {}
      return {
        engine: meta.engine,
        profile: meta.profileId,
        model: meta.modelId,
        lora: meta.loraId,
        loraId: meta.loraId,
        loraStrength: meta.loraStrength,
        loras: meta.loras,
        styleLoraId: meta.styleLoraId ?? null,
        preview: meta.preview === true,
        cfg: meta.cfg,
        steps: meta.steps,
        sampler: meta.sampler,
        scheduler: meta.scheduler,
        size: `${meta.width}x${meta.height}`,
        // 2026-08-29：Anima/Krea 的 hires 实参回显（元数据仅有 fix/scale/denoise；
        // 无则显式 false，避免兜底到 SD 面板值）。
        hiresFix: meta.hiresFix === true,
        hiresScale: typeof meta.hiresScale === 'number' ? meta.hiresScale : undefined,
        hiresDenoise: typeof meta.hiresDenoise === 'number' ? meta.hiresDenoise : undefined,
      }
    }
    const model = pb.sdModelName || sd.checkpoint.value || ''
    const loras = sd.lastLoras.value
    return {
      engine: 'sd',
      provider: sd.provider.value || 'webui',
      profile: modelProfile.value?.id || '',
      model,
      loraId: loras[0]?.id || null,
      loraStrength: loras[0]?.strength ?? null,
      loras,
      cfg: pb.sdParams.cfg,
      steps: pb.sdParams.steps,
      sampler: pb.sdParams.sampler,
      scheduler: pb.sdParams.scheduler,
      size: sdSize.value,
      // 2026-08-29：SD 高清修复/脸部修复实参落库（作品册回显 hires 开关）。
      hiresFix: pb.sdParams.hiresFix,
      hiresScale: pb.sdParams.hiresScale,
      hiresUpscaler: pb.sdParams.hiresUpscaler,
      hiresSteps: pb.sdParams.hiresSteps,
      hiresDenoise: pb.sdParams.hiresDenoise,
      faceDetailer: pb.sdParams.faceDetailer,
    }
  }

  function buildSingleDetailerScripts(): Record<string, unknown> {
    return {
      ADetailer: {
        args: [
          true,
          false,
          {
            ad_model: 'face_yolov8s.pt',
            ad_prompt: 'detailed eyes, clean face, character-accurate facial features',
            ad_negative_prompt: 'deformed face, asymmetrical eyes, cross-eyed',
            ad_confidence: 0.35,
            ad_denoising_strength: 0.18,
            ad_inpaint_only_masked: true,
            ad_inpaint_only_masked_padding: 32,
            ad_use_inpaint_width_height: true,
            ad_inpaint_width: 768,
            ad_inpaint_height: 768,
            is_api: true,
          },
          {
            ad_model: 'hand_yolov8n.pt',
            ad_prompt: 'detailed hands, five fingers, natural fingers',
            ad_negative_prompt: 'extra fingers, missing fingers, fused fingers, malformed hands',
            ad_confidence: 0.3,
            ad_denoising_strength: 0.16,
            ad_inpaint_only_masked: true,
            ad_inpaint_only_masked_padding: 32,
            ad_use_inpaint_width_height: true,
            ad_inpaint_width: 768,
            ad_inpaint_height: 768,
            is_api: true,
          },
        ],
      },
    }
  }

  /** 执行一个任务（队列与直接出图共用同一条路径） */
  async function runJob(job: Omit<SDQueueJob, 'id'>, opts: { disableLora?: boolean } = {}) {
    const [w, h] = String(job.size).split('x').map(Number)
    let prompt = job.prompt
    if (opts.disableLora) prompt = prompt.replace(/<lora:[^>]+>\s*,?\s*/gi, '').trim().replace(/,\s*$/, '')
    const directHighResolution = !job.hiresFix && (w || 832) * (h || 1216) > 1_500_000
    const alwaysonScripts = job.faceDetailer && job.char !== 'triad' && directHighResolution
      ? buildSingleDetailerScripts()
      : undefined

    const url = await sd.generate({
      prompt,
      negative_prompt: job.negative,
      width: w || 832,
      height: h || 1216,
      cfg_scale: job.cfg,
      steps: job.steps,
      sampler_name: job.sampler,
      scheduler: job.scheduler || undefined,
      hr_fix: job.hiresFix,
      hr_scale: job.hiresScale,
      hr_upscaler: job.hiresUpscaler,
      hr_second_pass_steps: job.hiresSteps,
      denoising_strength: job.denoisingStrength,
      seed: job.seed,
      model: job.checkpoint || undefined,
      lora: job.lora,
      alwayson_scripts: alwaysonScripts,
    })

    if (displayResultSeed.value) pb.sdParams.seed = displayResultSeed.value
    if (url) {
      writeQuickCreate({
        checkpoint: job.checkpoint,
        sampler: job.sampler,
        scheduler: job.scheduler,
        cfg: job.cfg,
        steps: job.steps,
        size: job.size,
        hiresFix: job.hiresFix,
        hiresUpscaler: job.hiresUpscaler,
        hiresScale: job.hiresScale,
      })
    }
    return url
  }

  /**
   * 成片入册（直出 / 队列共用同一实现，2026-08-30 UX 审计 P0-8）。
   *
   * 此前只有队列与批量路径自动入册，直出成片要手点「保存快照」，忘点后
   * 切页即丢。抽出来后直出路径同样自动写历史，三条路径行为一致。
   */
  async function commitJobResult(job: Omit<SDQueueJob, 'id'>, url: string): Promise<HistoryEntry | null> {
    // url 是本地 blob URL，不会回 HTML 错误页，但可能已被 revoke 而拿到空 blob。
    // 空 blob 入册会在作品册里留下一条打不开的记录。
    const response = await fetch(url)
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !contentType.startsWith('image/')) throw new Error('成片响应不是图片')
    const blob = await response.blob()
    if (!blob.size) throw new Error('成片数据已失效')
    // 返回落库条目：直出路径用它把「舞台这张图 = 作品册哪一条」记下来，
    // 后续 inpaint 重绘才有对比锚点（2026-08-30 UX 审计 P1-14）。
    return await pb.commitHistoryEntry({
      blob, seed: sd.resultSeed.value ?? undefined,
      size: job.size, negative: job.negative, prompt: job.prompt,
      ...historyGenerationFields(),
      // 2026-08-29 修复：队列任务用入队时快照（job）覆盖当前面板状态——
      // 故事/场景在排队期间被改也不串味；hires 取任务实参而非面板现值。
      story: job.story,
      scene: job.sceneId ?? null,
      sceneTitle: job.sceneTitle || undefined,
      hiresFix: job.hiresFix,
      hiresScale: job.hiresScale,
      hiresUpscaler: job.hiresUpscaler,
      hiresSteps: job.hiresSteps,
      hiresDenoise: job.denoisingStrength,
      faceDetailer: job.faceDetailer,
    })
  }

  const sdQueue = useSDQueue({
    isBusy: () => sd.generating.value,
    onFlash: (m) => pb.flash(m),
    run: async (job) => {
      const url = await runJob(job)
      if (url) {
        sdErrorReport.value = null
        // 队列产出自动入册，避免跑完一批还要手点保存
        try {
          await commitJobResult(job, url)
        } catch (e) { console.warn('queue autosave failed', e) }
        return { status: 'success' as const }
      }
      const err = sd.errorMsg.value
      if (!err) return { status: 'cancelled' as const }
      sdErrorReport.value = classifySDError({ message: err })
      return { status: 'failure' as const, error: err }
    },
  })

  // ── 队列快照接线（声明顺序见上方 readQueueSnapshot 处的说明）──────────
  // 队列变化实时落盘；挂载时把上次离开/刷新残留的 pending 任务灌回队列并置
  // 暂停，让用户确认面板状态后再手动「继续」。
  watch(() => sdQueue.queue.value, jobs => persistQueueSnapshot(jobs), { deep: true })

  const restoredCount = sdQueue.restore(readQueueSnapshot())
  if (restoredCount > 0) {
    pb.flash(`已恢复 ${restoredCount} 个排队任务（已暂停，点「继续」逐张生成）`)
  }

  function enqueueCurrent() {
    if (drawEngine.value !== 'sd') { pb.flash(`${drawEngine.value === 'krea2' ? 'Krea 2' : 'Anima'} 引擎暂不支持队列，直接点击生成即可`); return }
    const job = captureJob()
    if (!job) { pb.flash('请先选择场景或填写故事'); return }
    sdQueue.enqueue(job)
  }

  /** 一键发起 3 个不同 Seed 的候选变体入队（Midjourney / Forge 候选挑优机制） */
  function enqueue3Variants() {
    if (drawEngine.value !== 'sd') { pb.flash(`${drawEngine.value === 'krea2' ? 'Krea 2' : 'Anima'} 引擎暂不支持批量队列`); return }
    const baseJob = captureJob()
    if (!baseJob) { pb.flash('请先选择场景或填写故事'); return }
    const baseSeed = baseJob.seed >= 0 ? baseJob.seed : Math.floor(Math.random() * 900000000)
    for (let i = 0; i < 3; i++) {
      const jobVariant = {
        ...baseJob,
        title: `${baseJob.title} (候选 ${i + 1}/3)`,
        seed: baseSeed + i * 1000 + (i > 0 ? Math.floor(Math.random() * 100) : 0),
      }
      sdQueue.enqueue(jobVariant)
    }
    pb.flash('已将 3 组不同 Seed 候选加入出图队列')
  }

  return {
    sdErrorReport,
    dismissError,
    captureJob,
    historyGenerationFields,
    runJob,
    commitJobResult,
    sdQueue,
    enqueueCurrent,
    enqueue3Variants,
  }
}
