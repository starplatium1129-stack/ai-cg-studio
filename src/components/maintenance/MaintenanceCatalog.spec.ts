import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MaintenanceCatalog from './MaintenanceCatalog.vue'
import { sceneMaintenanceRecord } from '@/utils/maintenanceRecords'
import type { SceneDraft } from '@/types/api'
vi.mock('@/utils/runtimeEnvironment', () => ({ isLocalStudioHost: () => true }))
describe('maintenance catalog workspace', () => {
  it('allows full inspection in read-only mode while keeping mutations disabled', async () => {
    const record = sceneMaintenanceRecord({ id: 'sc001', title: '<b>文字标题</b>', category: '日常', char: 'nene', rating: 'All', story: '完整故事', prompt: 'original prompt', negative: 'original negative', tags: [] } as unknown as SceneDraft, '宁宁')
    const wrapper = mount(MaintenanceCatalog, { props: { records: [record], kind: 'scene', label: '场景', readonly: true }, global: { stubs: { RouterLink: true } } })
    expect(wrapper.find('h2').text()).toBe('<b>文字标题</b>')
    expect(wrapper.find('h2 b').exists()).toBe(false)
    expect(wrapper.findAll('button').find(button => button.text() === '编辑')?.attributes('disabled')).toBeDefined()
    await wrapper.findAll('button').find(button => button.text() === '提示词')!.trigger('click')
    expect(wrapper.find('.inspector-prompt').text()).toBe('original prompt')
    expect(wrapper.findAll('button').find(button => button.text() === '复制 JSON')?.attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('edit')).toBeUndefined()
    wrapper.unmount()
  })
})
