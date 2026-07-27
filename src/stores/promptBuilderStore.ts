import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { sceneLighting, sceneShot, sceneColorMood, sceneComposition, sceneRecommendedSize } from '@/utils/sceneInference'
import { resolveModelProfile } from '@/utils/promptPolicy'
import { imgPut } from '@/composables/useImageStore'
import { kvGet, kvSet } from '@/composables/useKVStore'
import { useSceneStore } from '@/stores/sceneStore'

// 与 useBackup.ts / GalleryView.vue 共用同一组键。改这里必须同步那两处。
const HISTORY_STORAGE_KEY = 'aics_pb_history'
const PROJECT_STORAGE_KEY = 'aics_pb_projects'

export type CharKey = 'nene' | 'natsume' | 'triad'

export interface Scene {
  id: string; title: string; story?: string; prompt?: string; tags?: string[]
  char?: string; category?: string; season?: string; series?: string
  rating?: string; mature?: boolean; lora?: string; timeOfDay?: string
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
  nene: '1girl, solo, ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, ahoge, hair_ribbon',
  natsume: '1girl, solo, shiki_natsume, black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip',
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
  const loraMeta     = ref<Array<{ name: string; [k: string]: unknown }>>([])
  const presets      = ref<Array<{ id: string; label: string; [k: string]: unknown }>>([])
  const modelProfiles = ref<Array<{ match?: string[]; quality_prefix?: string; [k: string]: unknown }>>([])
  const tags         = ref<Array<{ en: string; cn: string; cat: string }>>([])
  const characters   = ref<Array<{ id: string; lora?: { name: string; weight: number }; traits?: Array<{ tag: string; label: string; icon?: string }>; [k: string]: unknown }>>([])
  const dataReady    = ref(false)

  // ── Runtime history ─────────────────────────────────────────────────────
  const history  = ref<HistoryEntry[]>([])
  const projects = ref<Array<{ id: string; name: string }>>([])

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
  const sdParams = reactive({
    cfg: 6, steps: 30, sampler: 'Euler a', scheduler: '',
    size: '2:3', hiresFix: false, hiresScale: 1.5,
    hiresUpscaler: 'R-ESRGAN 4x+ Anime6B', hiresSteps: 20, hiresDenoise: 0.4,
    seedLock: false, seed: -1, quality: true, tail: true, negative: true,
    negativeCustom: '',
  })

  /** 用户是否手动改过某个参数（改过就不再被 profile 覆盖） */
  const sdParamsTouched = ref<Set<string>>(new Set())
  function markParamTouched(key: string) { sdParamsTouched.value.add(key) }

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
  const showMatureScenes = ref(false)
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
    if (next.has(tag)) next.delete(tag); else next.add(tag)
    manualTags.value = next
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
    const lighting = sceneLighting(scene as any)
    if (lighting && !selections.lighting) selections.lighting = lighting
    const shot = sceneShot(scene as any)
    if (shot && !selections.shot) selections.shot = shot
    const mood = sceneColorMood(scene as any)
    if (mood && !colorMood.value) colorMood.value = mood
    const comp = sceneComposition(scene as any)
    if (comp && !selections.composition) selections.composition = comp
    // 推荐尺寸（提供给视图书写）
    lastRecommendedSize.value = sceneRecommendedSize(scene as any)
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

    const pr = store.presets as { presets?: unknown[]; model_profiles?: unknown[] } | unknown[]
    presets.value = (Array.isArray(pr) ? pr : (Array.isArray(pr?.presets) ? pr.presets : [])) as typeof presets.value
    modelProfiles.value = (!Array.isArray(pr) && Array.isArray(pr?.model_profiles)
      ? pr.model_profiles : []) as typeof modelProfiles.value

    // presets.json 载入后立刻按底模填充推荐参数
    applyModelProfile()
    dataReady.value = true
  }

  /**
   * 按当前 checkpoint 匹配 model profile，并把推荐参数填入出图设置。
   * 用户手动改过的项不覆盖（sdParamsTouched）。
   */
  function applyModelProfile(modelName?: string): Record<string, unknown> | null {
    const profile = resolveModelProfile(modelProfiles.value as any, modelName || sdModelName.value)
    if (!profile) return null
    const touched = sdParamsTouched.value
    const set = (key: string, value: unknown) => {
      if (value === undefined || value === null || value === '') return
      if (touched.has(key)) return
      ;(sdParams as any)[key] = value
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
    return profile as any
  }

  // ── Draft persistence ────────────────────────────────────────────────────
  const DRAFT_KEY = 'aics_pb_last_draft'
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  function snapshotDraft() {
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
      sdParams: { ...sdParams },
      projectId: projectId.value,
    }
  }

  function applyDraft(d: any) {
    if (!d || typeof d !== 'object') return
    if (typeof d.story === 'string') story.value = d.story
    if (d.char) char.value = d.char as CharKey
    if (d.sceneId) sceneId.value = d.sceneId
    if (d.sceneBaseStory) sceneBaseStory.value = d.sceneBaseStory
    if (d.selections && typeof d.selections === 'object') {
      selections.emotion = Array.isArray(d.selections.emotion) ? d.selections.emotion : []
      selections.shot = d.selections.shot ?? null
      selections.lighting = d.selections.lighting ?? null
      selections.composition = d.selections.composition ?? null
    }
    if (typeof d.colorMood === 'string' || d.colorMood === null) colorMood.value = d.colorMood
    if (Array.isArray(d.manualTags)) manualTags.value = new Set(d.manualTags)
    if (d.sdParams && typeof d.sdParams === 'object') Object.assign(sdParams, d.sdParams)
    if (typeof d.projectId === 'string') projectId.value = d.projectId
  }

  function saveDraft() {
    if (!dataReady.value) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshotDraft())) } catch {}
    }, 280) as unknown as ReturnType<typeof setTimeout>
  }

  function restoreDraft(): boolean {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return false
      const d = JSON.parse(raw)
      if (!d || !d.updatedAt) return false
      if (!d.sceneId && !d.story) return false
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

  // ── History entry commit (IndexedDB image save) ──────────────────────────
  async function commitHistoryEntry(entry: Partial<HistoryEntry> & {
    blob: Blob; seed?: number; size?: string; negative?: string; prompt: string
  }): Promise<HistoryEntry | null> {
    try {
      const imageId = await imgPut(entry.blob)
      const measured = await measureBlob(entry.blob)
      const now = Date.now()
      const id = now
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
        lora: loraLine.value || null,
        cfg: sdParams.cfg, steps: sdParams.steps, sampler: sdParams.sampler,
        scheduler: sdParams.scheduler, checkpoint: sdModelName.value, size: entry.size ?? lastRecommendedSize.value,
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
    const idx = history.value.findIndex(h => h.id === id)
    if (idx < 0) return
    history.value.splice(idx, 1)
    await kvSet(HISTORY_STORAGE_KEY, history.value)
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
      let raw = await kvGet<Array<{ id: string; name?: string; title?: string }>>(PROJECT_STORAGE_KEY)
      if (!Array.isArray(raw) || !raw.length) {
        // 兼容旧键（作品册早期用的是 aics_projects）
        const legacy = await kvGet<Array<{ id: string; name?: string; title?: string }>>('aics_projects')
        if (Array.isArray(legacy) && legacy.length) raw = legacy
      }
      if (!Array.isArray(raw)) return
      // 作品册用 title，导演台用 name —— 两边字段历史上就不一致，这里统一
      projects.value = raw
        .filter(p => p && typeof p === 'object' && p.id)
        .map(p => ({ id: String(p.id), name: String(p.name || p.title || p.id) }))
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
