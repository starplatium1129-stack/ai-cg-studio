/**
 * 场景管理 · 标签库 CRUD（从 SceneManagerView.vue 拆出）。
 *
 * 所有权：tags.json 的增删改、标签改名级联（场景引用同步替换）、
 * 标签使用频次统计与筛选分页。
 */

import { ref, computed, watch } from 'vue'
import type { TagRecord, SceneDraft } from '@/types/api'

const TAG_PAGE_SIZE = 60
const TAG_CATS = ['Character', 'Clothing', 'Action', 'Emotion', 'Scene', 'Lighting', 'Body', 'Appearance']

interface TagHooks {
  tags: { value: TagRecord[] }
  scenes: { value: SceneDraft[] }
  markDirty: (message: string) => void
}

export function useSceneTagManager({ tags, scenes, markDirty }: TagHooks) {
  const tagSearch = ref('')
  const tagCatFilter = ref('')
  const tagPage = ref(1)

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
    const q = tagSearch.value.trim().toLowerCase()
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
  watch([tagSearch, tagCatFilter], () => { tagPage.value = 1 })

  function nextTagId() {
    const max = tags.value.reduce((m: number, t) =>
      Math.max(m, parseInt(String(t.id).replace('tag_', ''), 10) || 0), 0)
    return 'tag_' + String(max + 1).padStart(3, '0')
  }

  function openAddTag() {
    const en = prompt('标签英文名（Danbooru 格式，用下划线）：')
    if (!en?.trim()) return
    if (tags.value.some((t) => String(t.en).toLowerCase() === en.trim().toLowerCase())) {
      alert('这个英文名已存在'); return
    }
    const cn = prompt('标签中文名：')
    if (!cn?.trim()) return
    const cat = prompt(`分类（${TAG_CATS.join(' / ')}）：`, 'Scene')
    if (!cat?.trim()) return
    const weight = Number(prompt('默认权重（0–2）：', '0.8'))
    if (!Number.isFinite(weight) || weight <= 0 || weight > 2) { alert('权重必须是 0–2 之间的数字'); return }
    tags.value.push({ id: nextTagId(), cat: cat.trim(), en: en.trim(), cn: cn.trim(), weight, related: [] })
    markDirty('新增标签等待保存到项目')
  }

  function openEditTag(id: string) {
    const tag = tags.value.find((t) => t.id === id)
    if (!tag) return
    const en = prompt('标签英文名：', tag.en)
    if (!en?.trim()) return
    if (tags.value.some((t) => t.id !== id && String(t.en).toLowerCase() === en.trim().toLowerCase())) {
      alert('这个英文名已存在'); return
    }
    const cn = prompt('标签中文名：', tag.cn || '')
    if (!cn?.trim()) return
    const cat = prompt('分类：', tag.cat || 'Scene')
    if (!cat?.trim()) return
    const weight = Number(prompt('默认权重（0–2）：', String(tag.weight ?? 0.8)))
    if (!Number.isFinite(weight) || weight <= 0 || weight > 2) { alert('权重必须是 0–2 之间的数字'); return }

    const oldEn = tag.en
    Object.assign(tag, { en: en.trim(), cn: cn.trim(), cat: cat.trim(), weight })
    if (oldEn !== tag.en) {
      // 改名级联：场景里引用的旧标签一并替换，否则引用会悬空
      let touched = 0
      scenes.value.forEach(s => {
        if (!Array.isArray(s.tags)) return
        const next = s.tags.map((v: string) => (v === oldEn ? tag.en : v))
        if (next.join('\u0000') !== s.tags.join('\u0000')) { s.tags = next; touched++ }
      })
      markDirty(`标签改名已级联更新 ${touched} 个场景，等待保存`)
    } else {
      markDirty('标签修改等待保存到项目')
    }
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
    tagSearch, tagCatFilter, tagPage, tagUsage, tagCats, filteredTags, tagTotalPages, pagedTags,
    openAddTag, openEditTag, deleteTag,
  }
}
