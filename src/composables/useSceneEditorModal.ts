import { ref, type Ref } from 'vue'
import type { SceneDraft, CurationData } from '@/types/api'

export interface SceneEditorModalDeps {
  scenes: Ref<SceneDraft[]>
  curation: Ref<CurationData>
  markDirty: (message: string) => void
}

/** 策展层级 → curation.json 里对应的数组字段 */
const TIER_BUCKETS = {
  signature: 'signatureSceneIds',
  curated: 'curatedSceneIds',
  review: 'reviewSceneIds',
} as const

/**
 * 场景管理页「场景编辑弹层 + CRUD + 策展」簇（2026-08-22 自 SceneManagerView 下沉）。
 *
 * 编辑表单全量快照（JSON round-trip 脱离 reactive proxy）+ 脏关闭确认
 * （serializeModal 比对）、新增/编辑/保存/下架/复制，以及策展三层级
 * （招牌/精选/待审）在 curation 数组间的迁移与推荐理由维护。
 * 本簇只改内存草稿；落盘归 useSceneMaintenance 的 saveToProject。
 */
export function useSceneEditorModal(deps: SceneEditorModalDeps) {
  const { scenes, curation, markDirty } = deps

  const editing = ref<SceneDraft | null>(null)
  const editingId = ref('')
  const curationTierValue = ref('normal')
  const curationReason = ref('')
  const tagsInput = ref('')
  const usageInput = ref('')
  /** 弹窗打开时的表单快照，用于脏关闭确认 */
  const modalSnapshot = ref('')
  const triedSave = ref(false)
  const formHint = ref('')

  function curationTier(id: string) {
    if ((curation.value.signatureSceneIds || []).includes(id)) return 'signature'
    if ((curation.value.curatedSceneIds || []).includes(id)) return 'curated'
    if ((curation.value.reviewSceneIds || []).includes(id)) return 'review'
    return 'normal'
  }

  function updateCharacterDefaults() {
    const scene = editing.value
    if (!scene || editingId.value) return
    if (scene.char === 'nene') scene.lora = 'ayachi_nene_v18_wd14'
    else if (scene.char === 'natsume') scene.lora = 'shiki_natsume_v18_wd14'
    else if (scene.char === 'triad') scene.lora = 'ayachi_nene_v18_wd14:0.52, shiki_natsume_v18_wd14:0.52'
  }

  function onCurationTierChange() {
    if (curationTierValue.value === 'normal' || curationTierValue.value === 'review') curationReason.value = ''
  }

  function blankScene(): SceneDraft {
    return {
      id: '', title: '', category: '恋爱', char: 'nene',
      lora: 'ayachi_nene_v18_wd14', emotion: '恋爱',
      season: '不限', time: '深夜', timeOfDay: 'late_night',
      rating: 'All', mature: false,
      location: '', weather: '', camera: '', lighting: '',
      tags: [], usage: ['壁纸用'],
      story: '', storyJa: '', prompt: '', negative: 'worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, watermark, logo, signature, bad anatomy, bad hands',
    }
  }

  function serializeModal() {
    return JSON.stringify({
      ...editing.value,
      curationTierValue: curationTierValue.value,
      curationReason: curationReason.value,
      tagsInput: tagsInput.value,
      usageInput: usageInput.value,
    })
  }

  function openAddModal() {
    const maxId = scenes.value.reduce((m, s) => Math.max(m, parseInt(String(s.id).replace('sc', '')) || 0), 0)
    editing.value = blankScene()
    editing.value.id = 'sc' + String(maxId + 1).padStart(3, '0')
    editingId.value = ''
    curationTierValue.value = 'normal'
    curationReason.value = ''
    tagsInput.value = ''
    usageInput.value = '壁纸用'
    triedSave.value = false
    formHint.value = ''
    modalSnapshot.value = serializeModal()
  }

  function openEditModal(id: string) {
    const s = scenes.value.find(x => x.id === id)
    if (!s) return
    // sceneStore 的值是 Vue reactive proxy；structuredClone(proxy) 会抛 DataCloneError。
    // 这里需要的是脱离响应式的可编辑快照，JSON round-trip 正合适（场景数据是 JSON）。
    editing.value = JSON.parse(JSON.stringify(s)) as SceneDraft
    editingId.value = id
    curationTierValue.value = curationTier(id)
    curationReason.value = (curation.value.recommendationReasons || {})[id] || ''
    tagsInput.value = (s.tags || []).join(', ')
    usageInput.value = (s.usage || []).join(', ')
    triedSave.value = false
    formHint.value = ''
    modalSnapshot.value = serializeModal()
  }

  function closeModal() {
    if (editing.value && modalSnapshot.value && serializeModal() !== modalSnapshot.value) {
      if (!confirm('有未保存的修改，确定放弃？')) return
    }
    editing.value = null
    editingId.value = ''
    modalSnapshot.value = ''
  }

  function setSceneCuration(id: string, tier: string, reason: string) {
    const buckets = ['signatureSceneIds', 'curatedSceneIds', 'reviewSceneIds'] as const
    buckets.forEach(key => {
      const list = curation.value[key]
      curation.value[key] = (Array.isArray(list) ? list : []).filter(x => x !== id)
    })
    const target = TIER_BUCKETS[tier as keyof typeof TIER_BUCKETS]
    if (target) (curation.value[target] as string[]).push(id)
    if (!curation.value.recommendationReasons) curation.value.recommendationReasons = {}
    if (reason) curation.value.recommendationReasons[id] = reason
    else delete curation.value.recommendationReasons[id]
  }

  function saveScene() {
    triedSave.value = true
    const e = editing.value
    if (!e) return
    if (!e.title?.trim() || !e.story?.trim()) { formHint.value = '请先补齐标题和故事'; return }
    if (curationTierValue.value === 'signature' && !curationReason.value.trim()) { formHint.value = '招牌场景必须填写推荐理由'; return }
    e.character = e.char === 'triad' ? ['nene', 'natsume'] : [e.char]
    e.tags = tagsInput.value.split(',').map((t: string) => t.trim()).filter(Boolean)
    e.usage = usageInput.value.split(',').map((t: string) => t.trim()).filter(Boolean)
    e.mature = e.rating === 'R18'
    if (editingId.value) {
      const idx = scenes.value.findIndex(s => s.id === editingId.value)
      if (idx >= 0) scenes.value[idx] = JSON.parse(JSON.stringify(e)) as SceneDraft
    } else {
      if (scenes.value.some(s => s.id === e.id)) { formHint.value = 'ID 已存在：' + e.id; return }
      scenes.value.push(JSON.parse(JSON.stringify(e)) as SceneDraft)
    }
    setSceneCuration(e.id, curationTierValue.value, curationReason.value.trim())
    modalSnapshot.value = serializeModal()
    closeModal()
    markDirty('场景内容有修改，等待保存到项目')
  }

  function deleteScene(id: string) {
    if (!confirm('确认下架 ' + id + '？保存到项目后它将不再出现在场景库中。')) return
    scenes.value = scenes.value.filter(s => s.id !== id)
    setSceneCuration(id, 'normal', '')
    markDirty('有场景等待下架')
  }

  function duplicateScene(id: string) {
    const source = scenes.value.find(s => s.id === id)
    if (!source) return
    const maxId = scenes.value.reduce((m, s) => Math.max(m, parseInt(String(s.id).replace('sc', '')) || 0), 0)
    const copy = JSON.parse(JSON.stringify(source)) as SceneDraft
    copy.id = 'sc' + String(maxId + 1).padStart(3, '0')
    copy.title = source.title + ' · 副本'
    scenes.value.push(copy)
    markDirty('已复制场景，请编辑副本内容')
    openEditModal(copy.id)
  }

  function copyJson() {
    if (!editing.value) return
    navigator.clipboard.writeText(JSON.stringify(editing.value, null, 2))
  }

  return {
    editing,
    editingId,
    curationTierValue,
    curationReason,
    tagsInput,
    usageInput,
    triedSave,
    formHint,
    curationTier,
    updateCharacterDefaults,
    onCurationTierChange,
    openAddModal,
    openEditModal,
    closeModal,
    saveScene,
    deleteScene,
    duplicateScene,
    copyJson,
  }
}
