/**
 * 场景管理 · 标签库 CRUD（从 SceneManagerView.vue 拆出）。
 *
 * 所有权：tags.json 的增删改、标签改名级联（场景引用同步替换）、
 * 标签使用频次统计与筛选分页。
 */

import { ref, computed, watch } from 'vue'
import type { TagRecord, SceneDraft } from '@/types/api'

export const TAG_PAGE_SIZE = 60
export const TAG_CATS = ['Character', 'Clothing', 'Action', 'Emotion', 'Scene', 'Lighting', 'Body', 'Appearance']

interface TagHooks {
  tags: { value: TagRecord[] }
  scenes: { value: SceneDraft[] }
  markDirty: (message: string) => void
}

export function useSceneTagManager({ tags, scenes, markDirty }: TagHooks) {
  const tagSearch = ref('')
  const tagSearchDebounced = ref('')
  let tagDebounceTimer: ReturnType<typeof setTimeout> | null = null
  watch(tagSearch, (v) => {
    if (tagDebounceTimer) clearTimeout(tagDebounceTimer)
    tagDebounceTimer = setTimeout(() => { tagSearchDebounced.value = v }, 250)
  })
  const tagCatFilter = ref('')
  const tagPage = ref(1)

  // ── 状态驱动的标签表单（替代 prompt/alert） ──
  const tagModalOpen = ref(false)
  const tagEditing = ref<TagRecord | null>(null)
  const tagForm = ref({ en: '', cn: '', cat: 'Scene', weight: 0.8 })
  const tagFormError = ref('')

  const tagUsage = computed(() => {
    const map: Record<string, number> = {}
    scenes.value.forEach(s => (s.tags || []).forEach((t: string) => { map[t] = (map[t] || 0) + 1 }))
    return map
  })

  const tagCats = computed(() => {
    const found = [...new Set(tags.value.map((t) => t.cat).filter(Boolean))] as string[]
    return [...new Set([...TAG_CATS, ...found])]
  })

  const filteredTags = computed(() => {
    const q = tagSearchDebounced.value.trim().toLowerCase()
    return tags.value
      .filter((t) => {
        if (tagCatFilter.value && t.cat !== tagCatFilter.value) return false
        if (!q) return true
        return [t.id, t.en, t.cn, t.cat].join(' ').toLowerCase().includes(q)
      })
      .slice()
      .sort((a, b) => (tagUsage.value[b.en] || 0) - (tagUsage.value[a.en] || 0))
  })
  const tagTotalPages = computed(() => Math.max(1, Math.ceil(filteredTags.value.length / TAG_PAGE_SIZE)))
  const pagedTags = computed(() =>
    filteredTags.value.slice((tagPage.value - 1) * TAG_PAGE_SIZE, tagPage.value * TAG_PAGE_SIZE),
  )
  watch([tagSearchDebounced, tagCatFilter], () => { tagPage.value = 1 })

  function nextTagId() {
    const max = tags.value.reduce((m: number, t) =>
      Math.max(m, parseInt(String(t.id).replace('tag_', ''), 10) || 0), 0)
    return 'tag_' + String(max + 1).padStart(3, '0')
  }

  function startAddTag() {
    tagEditing.value = null
    tagForm.value = { en: '', cn: '', cat: 'Scene', weight: 0.8 }
    tagFormError.value = ''
    tagModalOpen.value = true
  }

  function startEditTag(id: string) {
    const tag = tags.value.find((t) => t.id === id)
    if (!tag) return
    tagEditing.value = tag
    tagForm.value = {
      en: tag.en ?? '',
      cn: (tag.cn as string) ?? '',
      cat: tag.cat ?? 'Scene',
      weight: typeof tag.weight === 'number' ? tag.weight : 0.8,
    }
    tagFormError.value = ''
    tagModalOpen.value = true
  }

  function closeTagModal() {
    tagModalOpen.value = false
    tagEditing.value = null
    tagFormError.value = ''
  }

  function submitTag() {
    const en = tagForm.value.en.trim()
    const cn = tagForm.value.cn.trim()
    const cat = tagForm.value.cat.trim()
    const weight = Number(tagForm.value.weight)

    if (!en) { tagFormError.value = '英文名不能为空'; return }
    const duplicate = tags.value.some((t) => {
      if (tagEditing.value && t.id === tagEditing.value.id) return false
      return String(t.en).toLowerCase() === en.toLowerCase()
    })
    if (duplicate) { tagFormError.value = '这个英文名已存在'; return }
    if (!cn) { tagFormError.value = '中文名不能为空'; return }
    if (!cat) { tagFormError.value = '分类不能为空'; return }
    if (!Number.isFinite(weight) || weight < 0 || weight > 2) { tagFormError.value = '权重必须是 0–2 之间的数字'; return }

    if (tagEditing.value) {
      const oldEn = tagEditing.value.en
      Object.assign(tagEditing.value, { en, cn, cat, weight })
      if (oldEn !== en) {
        let touched = 0
        scenes.value.forEach(s => {
          if (!Array.isArray(s.tags)) return
          const next = s.tags.map((v: string) => (v === oldEn ? en : v))
          if (next.join('\u0000') !== s.tags.join('\u0000')) { s.tags = next; touched++ }
        })
        markDirty(`标签改名已级联更新 ${touched} 个场景，等待保存`)
      } else {
        markDirty('标签修改等待保存到项目')
      }
    } else {
      tags.value.push({ id: nextTagId(), cat, en, cn, weight, related: [] })
      markDirty('新增标签等待保存到项目')
    }
    closeTagModal()
  }

  function deleteTag(id: string) {
    const tag = tags.value.find((t) => t.id === id)
    if (!tag) return
    const used = tagUsage.value[tag.en] || 0
    if (!confirm(`确认删除标签「${tag.en}」？${used ? `场景中的 ${used} 处引用也会一并移除。` : ''}`)) return
    tags.value = tags.value.filter((t) => t.id !== id)
    scenes.value.forEach(s => {
      if (Array.isArray(s.tags)) s.tags = s.tags.filter((v: string) => v !== tag.en)
    })
    markDirty('标签删除及其场景引用等待保存')
  }

  return {
    tagSearch, tagSearchDebounced, tagCatFilter, tagPage, tagUsage, tagCats, filteredTags, tagTotalPages, pagedTags,
    deleteTag,
    // 状态驱动表单
    tagModalOpen, tagEditing, tagForm, tagFormError,
    startAddTag, startEditTag, closeTagModal, submitTag,
  }
}
