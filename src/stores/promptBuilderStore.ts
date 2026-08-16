import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { sceneLighting, sceneShot, sceneColorMood, sceneComposition, sceneRecommendedSize } from '@/utils/sceneInference'
import { resolveModelProfile, mutualGroupOf, membersOfMutualGroup, type LoraMeta, type ModelProfile } from '@/utils/promptPolicy'
import { imgPut, imgDelete } from '@/composables/useImageStore'
import { kvGet, kvSet } from '@/composables/useKVStore'
import { blobThumbDataUrl, thumbKey } from '@/utils/imageThumb'
import { useSceneStore } from '@/stores/sceneStore'
import { artworkRepository } from '@/storage/artworkRepository'
import {
  isSDParamKey,
  parsePresetCatalog,
  parseProjectOptions,
  parsePromptBuilderDraft,
  type ProjectOption,
  type PromptBuilderDraft,
  type PromptPreset,
  type SDParams,
} from '@/utils/promptBuilderPersistence'
import type { DrawSubject, PopularCharacter, SceneBlueprint } from '@/utils/popularContent'
import { normalizeArtistStyleIds } from '@/config/artistStyles'

// 与 useBackup.ts / GalleryView.vue 共用同一组键。改这里必须同步那两处。
const HISTORY_STORAGE_KEY = 'aics_pb_history'
const PROJECT_STORAGE_KEY = 'aics_pb_projects'

/** 历史条目 id：Date.now() + 同毫秒序号，避免并发入册/保存撞 id */
let historyIdLastMs = 0
let historyIdCounter = 0
function historyIdSeq(now: number): number {
  if (now !== historyIdLastMs) { historyIdLastMs = now; historyIdCounter = 0 }
  historyIdCounter += 1
  return now * 1000 + historyIdCounter
}

export type CharKey = 'nene' | 'natsume' | 'triad'
export type DrawEngine = 'sd' | 'anima' | 'krea2'

export interface Scene {
  id: string; title: string; story?: string; prompt?: string; tags?: string[]; visualDescription?: string
  char?: string; category?: string; season?: string; series?: string
  rating?: string; mature?: boolean; lora?: string; timeOfDay?: string
  lighting?: string; camera?: string; negative?: string
  [k: string]: unknown
}

export interface HistoryEntry {
  id: number; timestamp: number; character: CharKey
  scene: string | null; sceneTitle: string | null
  story: string; visualDescription?: string; prompt: string; negative: string; seed: number
  emotion: string[]; shot: string | null; lighting: string | null
  composition: string | null; colorMood: string | null
  manual_tags: string[]; lora: string | null
  cfg: number | string; steps: number | string; sampler: string
  scheduler: string; checkpoint: string; size: string
  engine?: DrawEngine; profile?: string; model?: string
  provider?: 'comfy' | 'webui'
  loraId?: string | null; loraStrength?: number | null
  loras?: ReadonlyArray<{ id: string; strength: number }>
  preview?: boolean
  /** 成片真实像素；size 只是保存时下拉框的值，作品册排版以这两个为准 */
  width: number | null; height: number | null
  rating: Record<string, number>; favorite: boolean; notes: string
  image_id: string; image_url: string; version: number
  parent_id: number | null; project: string; [k: string]: unknown
  /** 热门角色无 LoRA 创作模式（旧历史缺省 studio，向后兼容）。 */
  subject?: 'studio' | 'popular'
  characterId?: string
  outfitId?: string
  blueprintId?: string | null
  noLora?: boolean
  /** 生成时实际使用的 Krea Style LoRA id；旧历史缺省无 Style LoRA。 */
  styleLoraId?: string | null
  /** 专家模式选中的模型原生画师风格 id，最多两位。 */
  artistStyleIds?: string[]
}

export interface Selections {
  emotion: string[]; shot: string | null
  lighting: string | null; composition: string | null
}

export const SHOT_PROMPT: Record<string, string> = {
  close: 'close_up', medium: 'medium_shot', wide: 'wide_shot',
  pov: 'pov', low: 'low_angle', high: 'high_angle',
  side: 'side_view', turn: 'looking_back', over: 'selfie', detail: 'close_up_detail',
}

export const LIGHTING_PROMPT: Record<string, string> = {
  golden: 'golden hour', window: 'window light', back: 'backlit',
  moon: 'moonlight', lantern: 'lantern light', overcast: 'overcast',
}

export const COMPOSITION_PROMPT: Record<string, string> = {
  center: 'centered composition', rule3: 'rule of thirds',
  left: 'left composition', right: 'right composition',
  foreground: 'foreground framing', frame: 'framed composition', bywindow: 'by window',
}

export const PROMPT_MAP_EMOTION: Record<string, string> = {
  happy: 'bright_smile', shy: 'shy, blushing', miss: 'longing_look',
  expect: 'expectant, bright_eyes', nervous: 'nervous, blushing', gentle: 'gentle_expression',
  moved: 'teary_eyes', sad: 'sad', calm: 'calm', joyful: 'in_love, blush',
  relaxed: 'relaxed', serious: 'serious', love: 'in_love, blush',
  sleepy: 'sleepy', spoiled: 'pouting', wronged: 'teary_eyes, pout',
}

export const CHAR_PROMPT: Record<string, string> = {
  // 单女主壁纸构图默认锁定 solo；互动场景只保留局部手/手臂，避免不稳定的第二人物抢占画面。
  nene: '1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, pink_hair_ribbons',
  natsume: '1girl, solo, shiki_natsume, very_long_black_hair, golden_yellow_eyes, two_red_hairclips, mole_under_eye, no_hair_ribbon',
  triad: '2girls',
}

export const NEGATIVE_DEFAULT = 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, extra arms, extra legs, deformed, cropped, duplicate'

export const RECOMMENDED_TAGS = [
  'golden_hour', 'window_light', 'soft_shadows', 'cinematic_composition',
  'depth_of_field', 'hair_blowing', 'beautiful_detailed_eyes',
  'warm_atmosphere', 'soft_colors', 'pastel_tones', 'muted_tones',
]

export const usePromptBuilderStore = defineStore('promptBuilder', () => {
  // ── Core director state ─────────────────────────────────────────────────
  const story     = ref('')
  const visualDescription = ref('')
  const char      = ref<CharKey>('nene')
  /** 热门角色无 LoRA 创作模式与工作室角色互斥；studio 路径继续用 char。 */
  const subject   = ref<DrawSubject>({ kind: 'studio' })
  const isPopular = computed(() => subject.value.kind === 'popular')
  const colorMood = ref<string | null>(null)
  const concise   = ref(false)
  const sceneId   = ref<string | null>(null)
  const sceneBaseStory = ref('')
  const selections = reactive<Selections>({ emotion: [], shot: null, lighting: null, composition: null })
  const manualTags = ref<Set<string>>(new Set())
  const artistStyleIds = ref<string[]>([])
  const projectId  = ref('')

  // ── Loaded data ─────────────────────────────────────────────────────────
  const scenes       = ref<Scene[]>([])
  const curation     = ref<Record<string, unknown>>({})
  const loraMeta     = ref<LoraMeta[]>([])
  const presets      = ref<PromptPreset[]>([])
  const modelProfiles = ref<ModelProfile[]>([])
  const tags         = ref<Array<{ en: string; cn: string; cat: string }>>([])
  const characters   = ref<Array<{ id: string; lora?: { name: string; weight: number }; traits?: Array<{ tag: string; label: string; icon?: string }>; [k: string]: unknown }>>([])
  const popularCharacters = ref<PopularCharacter[]>([])
  const sceneBlueprints = ref<SceneBlueprint[]>([])
  const dataReady    = ref(false)

  // ── Runtime history ─────────────────────────────────────────────────────
  const history  = ref<HistoryEntry[]>([])
  const projects = ref<ProjectOption[]>([])

  // ── SD state ────────────────────────────────────────────────────────────
  // 生成生命周期状态（online/generating/progress/result/error）由 useSDGenerate
  // 与 Anima 会话组合函数拥有，store 只保留跨引擎的底模选择与种子记忆。
  const sdModelName   = ref('')
  const lastSeed      = ref<number | null>(null)

  // ── SD params (synced from UI) ──────────────────────────────────────────
  // 默认值对齐 data/presets.json 的 WAI Illustrious v17（本站 LoRA 的训练底模）
  // 实际值在 loadData 后由 applyModelProfile() 按当前 checkpoint 覆盖
  const sdParams = reactive<SDParams>({
    cfg: 6, steps: 30, sampler: 'Euler a', scheduler: '',
    size: '2:3', hiresFix: false, hiresScale: 1.5,
     hiresUpscaler: 'Auto', hiresSteps: 20, hiresDenoise: 0.4,
    faceDetailer: true,
    seedLock: false, seed: -1, quality: true, tail: true, negative: true,
    negativeCustom: '',
  })

  /** 用户是否手动改过某个参数（改过就不再被 profile 覆盖） */
  const sdParamsTouched = ref<Set<keyof SDParams>>(new Set())
  function markParamTouched(key: string) {
    if (isSDParamKey(key)) sdParamsTouched.value.add(key)
  }

  // ── Voice state ─────────────────────────────────────────────────────────
  // 配音状态（online/mode/caption/custom）由 VoiceStudio.vue 与 useVoice 拥有，
  // 这里不再重复存放，避免两份状态漂移。

  // ── UI state ────────────────────────────────────────────────────────────
  const focusMode     = ref(false)
  const directorMode  = ref<'basic' | 'pro'>('basic')
  const sceneSearch   = ref('')
  const sceneTheme    = ref('all')
  const sceneLibMode  = ref<'grid' | 'list'>('grid')
  const currentStep   = ref(1)
  // 本项目主要在本机自用，成人向场景默认参与检索；带图的场景卡仍由 SceneCard 做模糊揭示。
  const showMatureScenes = ref(true)
  const activeTab     = ref('tags')
  const toastMsg      = ref('')
  const lastRecommendedSize = ref('832x1216')

  // ── Derived ─────────────────────────────────────────────────────────────
  const activeScene = computed(() =>
    sceneId.value ? scenes.value.find(s => s.id === sceneId.value) ?? null : null
  )

  const charPrompt = computed(() => CHAR_PROMPT[char.value] ?? '')

  const loraLine = computed(() => {
    if (!characters.value.length) return ''
    const match = characters.value.find(c =>
      char.value === 'triad'
        ? c.lora?.name?.includes('ayachi') || c.lora?.name?.includes('shiki')
        : c.id.includes(char.value) || c.lora?.name?.toLowerCase().includes(char.value)
    )
    if (!match?.lora) return ''
    if (char.value === 'triad') {
      const both = characters.value.filter(c =>
        c.lora && (c.lora.name.includes('ayachi') || c.lora.name.includes('shiki'))
      )
      return both.map(c => `<${c.lora!.name}:${c.lora!.weight}>`).join(', ')
    }
    return `<${match.lora.name}:${match.lora.weight}>`
  })

  const emotionPrompt = computed(() =>
    selections.emotion.map(e => PROMPT_MAP_EMOTION[e] || e).filter(Boolean).join(', ')
  )

  const filteredScenes = computed(() => {
    let list = scenes.value
    if (!showMatureScenes.value) list = list.filter(s => !s.mature)
    if (char.value !== 'triad') {
      list = list.filter(s => !s.char || s.char === char.value || s.char === 'both')
    }
    if (sceneTheme.value && sceneTheme.value !== 'all') {
      list = list.filter(s => s.category === sceneTheme.value || (s.series && s.series.includes(sceneTheme.value)))
    }
    if (sceneSearch.value.trim()) {
      const kw = sceneSearch.value.trim().toLowerCase()
      list = list.filter(s =>
        s.title?.toLowerCase().includes(kw) ||
        s.story?.toLowerCase().includes(kw) ||
        s.tags?.some(t => t.toLowerCase().includes(kw))
      )
    }
    return list
  })

  // ── Mutations ───────────────────────────────────────────────────────────
  function setChar(c: CharKey) { char.value = c }
  function setStudioSubject() {
    if (subject.value.kind === 'studio') return
    subject.value = { kind: 'studio' }
  }
  function setPopularSubject(characterId: string, outfitId: string, blueprintId: string | null = null) {
    subject.value = { kind: 'popular', characterId, outfitId, blueprintId }
  }
  function setPopularBlueprint(blueprintId: string | null) {
    if (subject.value.kind !== 'popular') return
    subject.value = { kind: 'popular', characterId: subject.value.characterId, outfitId: subject.value.outfitId, blueprintId }
  }
  function setStory(t: string) { story.value = t }
  function toggleEmotion(id: string) {
    const i = selections.emotion.indexOf(id)
    if (i >= 0) selections.emotion.splice(i, 1); else selections.emotion.push(id)
  }
  function setShot(id: string | null)        { selections.shot = id }
  function setLighting(id: string | null)    { selections.lighting = id }
  function setComposition(id: string | null) { selections.composition = id }
  function setColorMood(id: string | null)   { colorMood.value = id }

  function toggleManualTag(tag: string) {
    const next = new Set(manualTags.value)
    if (next.has(tag)) { next.delete(tag); manualTags.value = next; return }
    // 词条目录级互斥：服装 / 时段 / 天气同组互斥，选新标签替换旧标签
    let replaced: string[] = []
    const group = mutualGroupOf(tag)
    if (group) {
      replaced = membersOfMutualGroup(group, [...next])
      replaced.forEach(t => next.delete(t))
    }
    next.add(tag)
    manualTags.value = next
    if (replaced.length) flash(`已用「${tag}」替换同组「${replaced.join('、')}」`)
  }
  function setArtistStyleIds(ids: string[]) { artistStyleIds.value = normalizeArtistStyleIds(ids) }

  function loadScene(scene: Scene) {
    sceneId.value       = scene.id
    sceneBaseStory.value = scene.story ?? ''
    story.value         = scene.story ?? story.value
    // Search metadata is not prompt input. Visual prose must be explicit.
    visualDescription.value = ''
    if (scene.char && scene.char !== 'both' && scene.char !== 'triad') {
      char.value = scene.char as CharKey
    }
    // 选场景是一次完整的导演决策复位：旧镜头/光照/构图/情调/情绪/手动词条/
    // 自定义负面/被触摸参数全部清空，再写入本场景的智能推断（含 null）。
    selections.emotion = []
    selections.shot = sceneShot(scene)
    selections.lighting = sceneLighting(scene)
    selections.composition = sceneComposition(scene)
    colorMood.value = sceneColorMood(scene)
    manualTags.value = new Set()
    sdParams.negativeCustom = ''
    sdParamsTouched.value = new Set()
    // 推荐尺寸（优先场景显式字段，供视图书写）
    lastRecommendedSize.value = sceneRecommendedSize(scene)
  }

  function clearScene(opts: { keepStory?: boolean } = {}) {
    sceneId.value = null; sceneBaseStory.value = ''; visualDescription.value = ''; manualTags.value = new Set()
    selections.emotion = []; selections.shot = null; selections.lighting = null
    selections.composition = null; colorMood.value = null
    if (!opts.keepStory) story.value = ''
  }

  function flash(msg: string, duration = 2500) {
    toastMsg.value = msg
    setTimeout(() => { if (toastMsg.value === msg) toastMsg.value = '' }, duration)
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  /**
   * 共享数据统一走 sceneStore（单例 + 一个版本号）。
   * 以前这里自己 fetch 六个文件，与其他 6 处视图重复请求 scenes.json。
   */
  async function loadData() {
    const store = useSceneStore()
    await store.load()

    scenes.value = store.scenes as typeof scenes.value
    curation.value = store.curation
    characters.value = store.characters as typeof characters.value
    loraMeta.value = store.loras as typeof loraMeta.value
    tags.value = store.tags as typeof tags.value
    popularCharacters.value = store.popularCharacters
    sceneBlueprints.value = store.sceneBlueprints

    const catalog = parsePresetCatalog(store.presets)
    presets.value = catalog.presets
    modelProfiles.value = catalog.modelProfiles

    // presets.json 载入后立刻按底模填充推荐参数
    applyModelProfile()
    dataReady.value = true
  }

  /**
   * 按当前 checkpoint 匹配 model profile，并把推荐参数填入出图设置。
   * 用户手动改过的项不覆盖（sdParamsTouched）。
   */
  function applyModelProfile(modelName?: string, options: { applySize?: boolean } = {}): ModelProfile | null {
    const profile = resolveModelProfile(modelProfiles.value, modelName || sdModelName.value)
    if (!profile) return null
    const touched = sdParamsTouched.value
    const set = <K extends keyof SDParams>(key: K, value: SDParams[K] | null | undefined) => {
      if (value === undefined || value === null || value === '') return
      if (touched.has(key)) return
      sdParams[key] = value
    }
    set('sampler', profile.sampler)
    if (!touched.has('scheduler') && profile.scheduler !== undefined) sdParams.scheduler = profile.scheduler || ''
    set('steps', Number(profile.steps) || undefined)
    set('cfg', Number(profile.cfg) || undefined)
    set('hiresFix', profile.hires_fix)
    set('hiresScale', Number(profile.hires_scale) || undefined)
    set('hiresUpscaler', profile.hires_upscaler)
    set('hiresSteps', Number(profile.hires_steps) || undefined)
    set('hiresDenoise', Number(profile.hires_denoising_strength) || undefined)
    // profile 推荐尺寸（如 1024×1344）转成 WxH
    if (options.applySize !== false && !touched.has('size') && profile.size) {
      const m = String(profile.size).match(/(\d+)\s*[×x]\s*(\d+)/)
      if (m) lastRecommendedSize.value = `${m[1]}x${m[2]}`
    }
    return profile
  }

  // ── Draft persistence ────────────────────────────────────────────────────
  const DRAFT_KEY = 'aics_pb_last_draft'
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  function snapshotDraft(): PromptBuilderDraft {
    const subjectSnapshot = subject.value.kind === 'popular'
      ? {
          subject: 'popular' as const,
          characterId: subject.value.characterId,
          outfitId: subject.value.outfitId,
          blueprintId: subject.value.blueprintId,
          noLora: true,
        }
      : { subject: 'studio' as const, noLora: false }
    return {
      updatedAt: Date.now(),
      story: story.value,
      visualDescription: visualDescription.value,
      char: char.value,
      sceneId: sceneId.value,
      sceneTitle: activeScene.value?.title ?? null,
      selections: { emotion: [...selections.emotion], shot: selections.shot, lighting: selections.lighting, composition: selections.composition },
      colorMood: colorMood.value,
      manualTags: [...manualTags.value],
      artistStyleIds: [...artistStyleIds.value],
      sceneBaseStory: sceneBaseStory.value,
      directorMode: directorMode.value,
      sdParams: { ...sdParams },
      // 2026-08-16 审计：把用户已确认的参数键一并入草稿，恢复后不被 profile 覆盖。
      sdParamsTouched: [...sdParamsTouched.value],
      projectId: projectId.value,
      ...subjectSnapshot,
    }
  }

  function applyDraft(d: PromptBuilderDraft) {
    if (typeof d.story === 'string') story.value = d.story
    if (typeof d.visualDescription === 'string') visualDescription.value = d.visualDescription
    if (d.char) char.value = d.char
    if (d.sceneId !== undefined) sceneId.value = d.sceneId
    if (d.sceneBaseStory !== undefined) sceneBaseStory.value = d.sceneBaseStory
    if (d.selections) {
      selections.emotion = d.selections.emotion ?? []
      selections.shot = d.selections.shot ?? null
      selections.lighting = d.selections.lighting ?? null
      selections.composition = d.selections.composition ?? null
    }
    if (typeof d.colorMood === 'string' || d.colorMood === null) colorMood.value = d.colorMood
    if (d.manualTags) manualTags.value = new Set(d.manualTags)
    artistStyleIds.value = normalizeArtistStyleIds(d.artistStyleIds)
    if (d.directorMode) directorMode.value = d.directorMode
    if (d.sdParams) Object.assign(sdParams, d.sdParams)
    // 2026-08-16 审计：恢复草稿时同步重建 touched 集合——否则恢复的用户参数会被
    // 后续 applyModelProfile（切底模/引擎等）当默认值静默覆盖。缺省（旧草稿）
    // 保持原行为：不标记任何键。
    if (Array.isArray(d.sdParamsTouched) && d.sdParamsTouched.length) {
      sdParamsTouched.value = new Set(d.sdParamsTouched.filter(key => isSDParamKey(key)) as Array<keyof SDParams>)
    }
    if (typeof d.projectId === 'string') projectId.value = d.projectId
    if (d.subject === 'popular' && d.characterId && d.outfitId) {
      subject.value = { kind: 'popular', characterId: d.characterId, outfitId: d.outfitId, blueprintId: d.blueprintId ?? null }
    } else {
      subject.value = { kind: 'studio' }
    }
  }

  function saveDraft() {
    if (!dataReady.value) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshotDraft())) } catch {}
    }, 280)
  }

  function restoreDraft(): boolean {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return false
      const d = parsePromptBuilderDraft(JSON.parse(raw))
      if (!d) return false
      applyDraft(d)
      return true
    } catch { return false }
  }

  /**
   * 量出成片真实像素。
   * size 字段记的是保存那一刻下拉框的值，跟成片可能已经不一致
   * （中途换过场景 / 尺寸、或走了 hires.fix 放大），作品册按它排版就会
   * 给竖图套上横构图的框。所以入册时直接解码一次拿真尺寸。
   */
  async function measureBlob(blob: Blob): Promise<{ width: number | null; height: number | null }> {
    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(blob)
        const size = { width: bitmap.width, height: bitmap.height }
        bitmap.close?.()
        return size
      }
    } catch { /* 落到 <img> 兜底 */ }
    return await new Promise(resolve => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(url) }
      img.src = url
    })
  }

  /** 入册时顺带生成缩略图缓存（fire-and-forget，失败忽略不影响入册） */
  async function cacheThumbnail(imageId: string, blob: Blob): Promise<void> {
    try {
      const dataUrl = await blobThumbDataUrl(blob)
      if (dataUrl) await kvSet(thumbKey(imageId), dataUrl)
    } catch { /* 缩略图只是缓存，丢了下次进作品册会补 */ }
  }

  // ── History entry commit (IndexedDB image save) ──────────────────────────
  async function commitHistoryEntry(entry: Partial<HistoryEntry> & {
    blob: Blob; seed?: number; size?: string; negative?: string; prompt: string
    engine?: DrawEngine; profile?: string; model?: string
    loraId?: string | null; loraStrength?: number | null
    cfg?: number | string; steps?: number | string; sampler?: string; scheduler?: string
  }): Promise<HistoryEntry | null> {
    let imageId = ''
    try {
      imageId = await imgPut(entry.blob)
      void cacheThumbnail(imageId, entry.blob)
      const measured = await measureBlob(entry.blob)
      const now = Date.now()
      // Date.now() 同毫秒内「队列自动入册 + 手动保存」并发会撞 id，
      // removeHistoryEntry 可能误删另一条；加模块级序号保证唯一。
      const id = historyIdSeq(now)
      const currentSubject = subject.value
      const isPopular = currentSubject.kind === 'popular'
      const popChar = isPopular ? popularCharacters.value.find(c => c.id === currentSubject.characterId) : null
      const popBlueprint = isPopular && currentSubject.blueprintId
        ? sceneBlueprints.value.find(b => b.id === currentSubject.blueprintId)
        : null
      const resolvedSceneTitle = isPopular
        ? (popBlueprint?.title || (popChar ? `${popChar.displayName} 创作` : '热门角色作品'))
        : (activeScene.value?.title ?? (story.value ? story.value.slice(0, 20) : null))

      const historyEntry: HistoryEntry = {
        id,
        timestamp: now,
        character: isPopular ? ((currentSubject.characterId as unknown as CharKey) || char.value) : char.value,
        scene: isPopular ? (currentSubject.blueprintId ?? null) : sceneId.value,
        sceneTitle: resolvedSceneTitle,
        story: story.value,
        visualDescription: visualDescription.value,
        prompt: entry.prompt,
        negative: entry.negative ?? '',
        seed: entry.seed ?? lastSeed.value ?? -1,
        emotion: [...selections.emotion],
        shot: selections.shot, lighting: selections.lighting, composition: selections.composition,
        colorMood: colorMood.value,
        manual_tags: [...manualTags.value],
        lora: (entry.lora ?? loraLine.value) || null,
        cfg: entry.cfg ?? sdParams.cfg,
        steps: entry.steps ?? sdParams.steps,
        sampler: entry.sampler ?? sdParams.sampler,
        scheduler: entry.scheduler ?? sdParams.scheduler,
        checkpoint: entry.model ?? sdModelName.value,
        size: entry.size ?? lastRecommendedSize.value,
        engine: entry.engine ?? 'sd',
        profile: entry.profile ?? '',
        model: entry.model ?? sdModelName.value,
        loraId: entry.loraId ?? null,
        loraStrength: entry.loraStrength ?? null,
        loras: Object.freeze((entry.loras ?? []).map(lora => Object.freeze({ id:lora.id, strength:lora.strength }))),
        width: measured.width, height: measured.height,
        rating: {}, favorite: false, notes: '',
        image_id: imageId, image_url: '',
        version: 1, parent_id: null, project: projectId.value,
        subject: isPopular ? 'popular' : 'studio',
        characterId: isPopular ? currentSubject.characterId : undefined,
        outfitId: isPopular ? currentSubject.outfitId : undefined,
        blueprintId: isPopular ? currentSubject.blueprintId : undefined,
        noLora: isPopular,
        styleLoraId: entry.styleLoraId ?? null,
        artistStyleIds: normalizeArtistStyleIds(entry.artistStyleIds ?? (directorMode.value === 'pro' ? artistStyleIds.value : [])),
      }
      const updated = [...history.value, historyEntry]
      // 2026-08-16 审计：先持久化再提交内存态——此前 kvSet 失败会「内存已入册、
      // 磁盘没写」，刷新后条目静默丢失且刚写入的图片成为孤儿 blob。
      await kvSet(HISTORY_STORAGE_KEY, updated)
      history.value = updated
      return historyEntry
    } catch (e) {
      console.warn('commitHistoryEntry failed', e)
      // 持久化失败：回收刚写入的孤儿图片，避免无历史引用的 blob 堆积。
      if (imageId) void imgDelete(imageId).catch(() => {})
      return null
    }
  }

  async function removeHistoryEntry(id: number) {
    const result = await artworkRepository.deleteArtwork(id)
    if (result.historyChanged) {
      history.value = history.value.filter(entry => entry.id !== id)
    }
    if (result.removedProjectReferences > 0) await loadProjects()
  }

  async function loadHistory() {
    try {
      const raw = await kvGet<HistoryEntry[]>(HISTORY_STORAGE_KEY)
      if (Array.isArray(raw)) history.value = raw
    } catch {}
    // projects 以前只声明不加载 → 下拉框恒空，每条历史都写 project:''
    await loadProjects()
  }

  async function loadProjects() {
    try {
      let raw: unknown = await kvGet(PROJECT_STORAGE_KEY)
      let parsed = parseProjectOptions(raw)
      if (!parsed.length) {
        // 兼容旧键（作品册早期用的是 aics_projects）
        raw = await kvGet('aics_projects')
        parsed = parseProjectOptions(raw)
      }
      // 作品册用 title，导演台用 name —— 两边字段历史上就不一致，这里统一
      projects.value = parsed
    } catch {}
  }

  return {
    story, visualDescription, char, colorMood, concise, sceneId, sceneBaseStory,
    selections, manualTags, artistStyleIds, projectId,
    subject, isPopular,
    scenes, curation, loraMeta, presets, modelProfiles, tags, characters,
    popularCharacters, sceneBlueprints, dataReady,
    history, projects,
    sdModelName, lastSeed, sdParams,
    focusMode, directorMode, sceneSearch, sceneTheme, sceneLibMode,
    currentStep, showMatureScenes, activeTab, toastMsg, lastRecommendedSize,
    activeScene, charPrompt, loraLine, emotionPrompt, filteredScenes,
    setChar, setStory, toggleEmotion, setShot, setLighting, setComposition,
    setColorMood, toggleManualTag, setArtistStyleIds, loadScene, clearScene, flash,
    setStudioSubject, setPopularSubject, setPopularBlueprint,
    loadData, loadHistory, loadProjects,
    saveDraft, restoreDraft, snapshotDraft,
    commitHistoryEntry, removeHistoryEntry,
    sdParamsTouched, markParamTouched, applyModelProfile,
  }
})
