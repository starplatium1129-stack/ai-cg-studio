import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import { useMaintenanceCatalog } from './useMaintenanceCatalog'
import { sceneMaintenanceRecord } from '@/utils/maintenanceRecords'
import type { SceneDraft } from '@/types/api'

const scene = (id: number) => ({ id: `sc${String(id).padStart(3, '0')}`, title: `场景 ${id}`, category: id % 2 ? '日常' : '旅行', char: 'nene', rating: 'All', story: `故事 ${id}`, prompt: `prompt_${id}`, negative: 'negative', tags: ['tag'], futureField: { untouched: true } }) as unknown as SceneDraft
describe('maintenance catalog', () => {
  it('keeps selection valid when filtering, paginating and deleting the last page', () => {
    const scope = effectScope()
    scope.run(() => {
      const records = ref(Array.from({ length: 49 }, (_, i) => sceneMaintenanceRecord(scene(i + 1), '宁宁')))
      const catalog = useMaintenanceCatalog(records)
      expect(catalog.selected.value?.id).toBe('sc001')
      catalog.page.value = 3
      expect(catalog.selected.value?.id).toBe('sc049')
      records.value = records.value.slice(0, 48)
      expect(catalog.page.value).toBe(2)
      expect(catalog.selected.value?.id).toBe('sc025')
      catalog.search.value = 'prompt_17'
      expect(catalog.page.value).toBe(1)
      expect(catalog.selected.value?.id).toBe('sc017')
      catalog.search.value = 'no match'
      expect(catalog.selected.value).toBeNull()
      catalog.reset()
      expect(catalog.selected.value?.id).toBe('sc001')
    })
    scope.stop()
  })
  it('keeps the same selection on an edit and combines filters without mutating source order', () => {
    const scope = effectScope()
    scope.run(() => {
      const original = [scene(2), scene(1)]
      const records = ref(original.map(item => sceneMaintenanceRecord(item, '宁宁', item.id === 'sc001' ? 'review' : 'normal')))
      const catalog = useMaintenanceCatalog(records)
      catalog.selectedId.value = 'sc002'
      records.value = records.value.map(item => item.id === 'sc002' ? { ...item, title: '更新标题' } : item)
      expect(catalog.selected.value?.title).toBe('更新标题')
      catalog.focus.value = 'review'
      catalog.category.value = '日常'
      expect(catalog.filtered.value.map(item => item.id)).toEqual(['sc001'])
      expect(original.map(item => item.id)).toEqual(['sc002', 'sc001'])
    })
    scope.stop()
  })
  it('preserves prompt bytes and unknown source fields in the read-only adapter', () => {
    const original = { ...scene(1), prompt: ' leading, tokens\nsecond line  ', story: '<script>plain text</script>' }
    const before = JSON.stringify(original)
    const record = sceneMaintenanceRecord(original, '宁宁')
    expect(record.prompts[0].value).toBe(original.prompt)
    expect(record.raw).toBe(original)
    expect(JSON.stringify(record.raw)).toBe(before)
    expect(record.href).toBe('/prompt-builder?scene=sc001')
  })
})
