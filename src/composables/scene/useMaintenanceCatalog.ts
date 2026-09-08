import { computed, ref, watch, type Ref } from 'vue'
import type { MaintenanceRecord } from '@/utils/maintenanceRecords'

export function useMaintenanceCatalog(records: Ref<MaintenanceRecord[]>) {
  const search = ref('')
  const character = ref('')
  const category = ref('')
  const rating = ref('')
  const focus = ref('all')
  const sort = ref('id')
  const page = ref(1)
  const selectedId = ref('')
  const pageSize = 24
  const categories = computed(() => [...new Set(records.value.map(item => item.category).filter(Boolean))].sort())
  const characters = computed(() => [...new Map(records.value.map(item => [item.character, item.characterName])).entries()].filter(([id]) => id).sort((a, b) => a[1].localeCompare(b[1], 'zh-CN')))
  const missing = (item: MaintenanceRecord) => !item.description.trim() || !item.prompts.some(prompt => prompt.value?.trim())
  const indexed = computed(() => records.value.map(item => ({ item, text: [item.id, item.title, item.characterName, item.category, item.description, ...item.tags, ...item.prompts.map(prompt => prompt.value)].join(' ').toLocaleLowerCase() })))
  const filtered = computed(() => {
    const needle = search.value.trim().toLocaleLowerCase()
    return indexed.value.filter(({ item, text }) =>
      (!needle || text.includes(needle)) && (!character.value || item.character === character.value)
      && (!category.value || item.category === category.value) && (!rating.value || item.rating === rating.value)
      && (focus.value !== 'review' || item.tier === 'review') && (focus.value !== 'missing' || missing(item)),
    ).map(({ item }) => item).sort((a, b) => {
      if (sort.value === 'title') return a.title.localeCompare(b.title, 'zh-CN')
      if (sort.value === 'character') return a.characterName.localeCompare(b.characterName, 'zh-CN') || a.id.localeCompare(b.id)
      return a.id.localeCompare(b.id, undefined, { numeric: true })
    })
  })
  const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
  const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
  const selected = computed(() => paged.value.find(item => item.id === selectedId.value) || null)
  watch([search, character, category, rating, focus, sort], () => { page.value = 1 }, { flush: 'sync' })
  watch(totalPages, total => { if (page.value > total) page.value = total }, { flush: 'sync' })
  watch(paged, items => {
    if (!items.some(item => item.id === selectedId.value)) selectedId.value = items[0]?.id || ''
  }, { immediate: true, flush: 'sync' })
  function reset() { search.value = ''; character.value = ''; category.value = ''; rating.value = ''; focus.value = 'all'; page.value = 1 }
  const hasFilters = computed(() => Boolean(search.value || character.value || category.value || rating.value || focus.value !== 'all'))
  return { search, character, category, rating, focus, sort, page, selectedId, categories, characters, filtered, paged, selected, totalPages, hasFilters, missing, reset }
}
