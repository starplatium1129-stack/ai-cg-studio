import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'

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
  const sdParams = reactive({
    cfg: 7, steps: 28, sampler: 'DPM++ 2M', scheduler: 'Karras',
    size: '2:3', hiresFix: false, hiresScale: 1.5, hiresUpscaler: 'R-ESRGAN 4x+',
    seedLock: false, seed: -1, quality: true, tail: true, negative: false,
  })

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
    if (scene.tags) manualTags.value = new Set(scene.tags.slice(0, 20))
    if (scene.char && scene.char !== 'both' && scene.char !== 'triad') {
      char.value = scene.char as CharKey
    }
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
  async function loadData() {
    const [sc, cu, ch, lm, pr, tg] = await Promise.allSettled([
      fetch('/data/scenes.json?v=9').then(r => r.json()),
      fetch('/data/curation.json?v=3').then(r => r.json()),
      fetch('/data/characters.json?v=6').then(r => r.json()),
      fetch('/data/loras.json?v=2').then(r => r.json()),
      fetch('/data/presets.json?v=2').then(r => r.json()),
      fetch('/data/tags.json').then(r => r.json()),
    ])
    if (sc.status === 'fulfilled') scenes.value = Array.isArray(sc.value) ? sc.value : []
    if (cu.status === 'fulfilled') curation.value = cu.value ?? {}
    if (ch.status === 'fulfilled') characters.value = Array.isArray(ch.value) ? ch.value : []
    if (lm.status === 'fulfilled') loraMeta.value = Array.isArray(lm.value) ? lm.value : []
    if (pr.status === 'fulfilled') {
      const v = pr.value
      presets.value = Array.isArray(v) ? v : (Array.isArray(v?.presets) ? v.presets : [])
      modelProfiles.value = Array.isArray(v?.model_profiles) ? v.model_profiles : []
    }
    if (tg.status === 'fulfilled') tags.value = Array.isArray(tg.value) ? tg.value : []
    dataReady.value = true
  }

  async function loadHistory() {
    try {
      const raw = (window as any).AICKVStore
        ? await (window as any).AICKVStore.getAll?.('history')
        : null
      if (Array.isArray(raw)) history.value = raw
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
    currentStep, showMatureScenes, activeTab, toastMsg,
    activeScene, charPrompt, loraLine, emotionPrompt, filteredScenes,
    setChar, setStory, toggleEmotion, setShot, setLighting, setComposition,
    setColorMood, toggleManualTag, loadScene, clearScene, flash,
    loadData, loadHistory,
  }
})
