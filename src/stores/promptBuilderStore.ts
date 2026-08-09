import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { sceneLighting, sceneShot, sceneColorMood, sceneComposition, sceneRecommendedSize } from '@/utils/sceneInference'
import { resolveModelProfile, mutualGroupOf, membersOfMutualGroup, type LoraMeta, type ModelProfile } from '@/utils/promptPolicy'
import { imgPut } from '@/composables/useImageStore'
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
export type DrawEngine = 'sd' | 'anima'

export interface Scene {
  id: string; title: string; story?: string; prompt?: string; tags?: string[]
  char?: string; category?: string; season?: string; series?: string
  rating?: string; mature?: boolean; lora?: string; timeOfDay?: string
  lighting?: string; camera?: string; negative?: string
  [k: string]: unknown
}

export interface HistoryEntry {
  id: number; timestamp: number; character: CharKey
  scene: string | null; sceneTitle: string | null
  story: string; prompt: string; negative: string; seed: number
  emotion: string[]; shot: string | null; lighting: string | null
  composition: string | null; colorMood: string | null
  manual_tags: string[]; lora: string | null
  cfg: number | string; steps: number | string; sampler: string
  scheduler: string; checkpoint: string; size: string
  engine?: DrawEngine; profile?: string; model?: string
  loraId?: string | null; loraStrength?: number | null
  /** 成片真实像素；size 只是保存时下拉框的值，作品册排版以这两个为准 */
  width: number | null; height: number | null
  rating: Record<string, number>; favorite: boolean; notes: string
  image_id: string; image_url: string; version: number
  parent_id: number | null; project: string; [k: string]: unknown
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
  const char      = ref<CharKey>('nene')
  const colorMood = ref<string | null>(null)
  const concise   = ref(false)
  const sceneId   = ref<string | null>(null)
  const sceneBaseStory = ref('')
  const selections = reactive<Selections>({ emotion: [], shot: null, lighting: null, composition: null })
  const manualTags = ref<Set<string>>(new Set())
  const projectId  = ref('')

  // ── Loaded data ─────────────────────────────────────────────────────────
  const scenes       = ref<Scene[]>([])
  const curation     = ref<Record<string, unknown>>({})
  const loraMeta     = ref<LoraMeta[]>([])
  const presets      = ref<PromptPreset[]>([])
  const modelProfiles = ref<ModelProfile[]>([])
  const tags         = ref<Array<{ en: string; cn: string; cat: string }>>([])
  const characters   = ref<Array<{ id: string; lora?: { name: string; weight: number }; traits?: Array<{ tag: string; label: string; icon?: string }>; [k: string]: unknown }>>([])
  const dataReady    = ref(false)

  // ── Runtime history ─────────────────────────────────────────────────────
  const history  = ref<HistoryEntry[]>([])
  const projects = ref<ProjectOption[]>([])

  // ── SD state ────────────────────────────────────────────────────────────
  const sdOnline      = ref(false)
  const sdGenerating  = ref(false)
  const sdProgress    = ref(0)
  const sdResultUrl   = ref('')
  const sdStatus      = ref('')
  const sdError       = ref('')
  const sdModelName   = ref('')
  const sdAvailableModels = ref<string[]>([])
  const lastSeed      = ref<number | null>(null)

  // ── SD params (synced from UI) ──────────────────────────────────────────
  // 默认值对齐 data/presets.json 的 WAI Illustrious v17（本站 LoRA 的训练底模）
  // 实际值在 loadData 后由 applyModelProfile() 按当前 checkpoint 覆盖
  const sdParams = reactive<SDParams>({
    cfg: 6, steps: 30, sampler: 'Euler a', scheduler: '',
    size: '2:3', hiresFix: false, hiresScale: 1.5,
    hiresUpscaler: 'R-ESRGAN 4x+ Anime6B', hiresSteps: 30, hiresDenoise: 0.5,
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
  const voiceOnline   = ref(false)
  const voiceMode     = ref<'caption' | 'story' | 'custom'>('caption')
  const voiceCaption  = ref('')
  const voiceCustom   = ref('')

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

  function loadScene(scene: Scene) {
    sceneId.value       = scene.id
    sceneBaseStory.value = scene.story ?? ''
    story.value         = scene.story ?? story.value
    if (scene.tags) manualTags.value = new Set(scene.tags.slice(0, 20))
    if (scene.char && scene.char !== 'both' && scene.char !== 'triad') {
      char.value = scene.char as CharKey
    }
    // 智能推断：自动预填导演决策（仅当用户尚未手动选择时）
    const lighting = sceneLighting(scene)
    if (lighting && !selections.lighting) selections.lighting = lighting
    const shot = sceneShot(scene)
    if (shot && !selections.shot) selections.shot = shot
    const mood = sceneColorMood(scene)
    if (mood && !colorMood.value) colorMood.value = mood
    const comp = sceneComposition(scene)
    if (comp && !selections.composition) selections.composition = comp
    // 推荐尺寸（提供给视图书写）
    lastRecommendedSize.value = sceneRecommendedSize(scene)
  }

  function clearScene(opts: { keepStory?: boolean } = {}) {
    sceneId.value = null; sceneBaseStory.value = ''; manualTags.value = new Set()
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
  function applyModelProfile(modelName?: string): ModelProfile | null {
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
    set('hiresScale', Number(profile.hires_scale) || undefined)
    set('hiresUpscaler', profile.hires_upscaler)
    set('hiresSteps', Number(profile.hires_steps) || undefined)
    set('hiresDenoise', Number(profile.hires_denoising_strength) || undefined)
    // profile 推荐尺寸（如 1024×1344）转成 WxH
    if (!touched.has('size') && profile.size) {
      const m = String(profile.size).match(/(\d+)\s*[×x]\s*(\d+)/)
      if (m) lastRecommendedSize.value = `${m[1]}x${m[2]}`
    }
    return profile
  }

  // ── Draft persistence ────────────────────────────────────────────────────
  const DRAFT_KEY = 'aics_pb_last_draft'
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  function snapshotDraft(): PromptBuilderDraft {
    return {
      updatedAt: Date.now(),
      story: story.value,
      char: char.value,
      sceneId: sceneId.value,
      sceneTitle: activeScene.value?.title ?? null,
      selections: { emotion: [...selections.emotion], shot: selections.shot, lighting: selections.lighting, composition: selections.composition },
      colorMood: colorMood.value,
      manualTags: [...manualTags.value],
      sceneBaseStory: sceneBaseStory.value,
      directorMode: directorMode.value,
      sdParams: { ...sdParams },
      projectId: projectId.value,
    }
  }

  function applyDraft(d: PromptBuilderDraft) {
    if (typeof d.story === 'string') story.value = d.story
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
    if (d.directorMode) directorMode.value = d.directorMode
    if (d.sdParams) Object.assign(sdParams, d.sdParams)
    if (typeof d.projectId === 'string') projectId.value = d.projectId
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
    try {
      const imageId = await imgPut(entry.blob)
      void cacheThumbnail(imageId, entry.blob)
      const measured = await measureBlob(entry.blob)
      const now = Date.now()
      // Date.now() 同毫秒内「队列自动入册 + 手动保存」并发会撞 id，
      // removeHistoryEntry 可能误删另一条；加模块级序号保证唯一。
      const id = historyIdSeq(now)
      const historyEntry: HistoryEntry = {
        id,
        timestamp: now,
        character: char.value,
        scene: sceneId.value,
        sceneTitle: activeScene.value?.title ?? null,
        story: story.value,
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
        width: measured.width, height: measured.height,
        rating: {}, favorite: false, notes: '',
        image_id: imageId, image_url: '',
        version: 1, parent_id: null, project: projectId.value,
      }
      const updated = [...history.value, historyEntry]
      history.value = updated
      await kvSet(HISTORY_STORAGE_KEY, updated)
      return historyEntry
    } catch (e) { console.warn('commitHistoryEntry failed', e); return null }
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
    story, char, colorMood, concise, sceneId, sceneBaseStory,
    selections, manualTags, projectId,
    scenes, curation, loraMeta, presets, modelProfiles, tags, characters, dataReady,
    history, projects,
    sdOnline, sdGenerating, sdProgress, sdResultUrl, sdStatus, sdError,
    sdModelName, sdAvailableModels, lastSeed, sdParams,
    voiceOnline, voiceMode, voiceCaption, voiceCustom,
    focusMode, directorMode, sceneSearch, sceneTheme, sceneLibMode,
    currentStep, showMatureScenes, activeTab, toastMsg, lastRecommendedSize,
    activeScene, charPrompt, loraLine, emotionPrompt, filteredScenes,
    setChar, setStory, toggleEmotion, setShot, setLighting, setComposition,
    setColorMood, toggleManualTag, loadScene, clearScene, flash,
    loadData, loadHistory, loadProjects,
    saveDraft, restoreDraft, snapshotDraft,
    commitHistoryEntry, removeHistoryEntry,
    sdParamsTouched, markParamTouched, applyModelProfile,
  }
})
