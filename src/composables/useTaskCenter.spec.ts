import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('@/composables/useKVStore', () => ({ kvGet: storage.get, kvSet: storage.set }))
beforeEach(() => { vi.resetModules(); storage.get.mockReset().mockResolvedValue([]); storage.set.mockReset().mockResolvedValue(undefined) })

it('new tasks merge with restored summaries and old running work is not reported as live', async () => {
  storage.get.mockResolvedValue([{ id: 'previous', kind: 'batch', title: '旧批次', status: 'running', route: '/prompt-builder', createdAt: 1, updatedAt: 1 }])
  const module = await import('./useTaskCenter')
  module.createTask({ kind: 'image', title: '新任务', status: 'running', route: '/prompt-builder' })
  await module.flushTaskSummaries()
  expect(module.useTaskCenter().tasks.value).toHaveLength(2)
  expect(module.useTaskCenter().tasks.value.find(task => task.id === 'previous')?.status).toBe('interrupted')
  expect(module.useTaskCenter().activeCount.value).toBe(1)
  expect(storage.set.mock.calls.at(-1)?.[1]).toHaveLength(2)
})

it('deactivation retains work and controls; true destruction marks it interrupted', async () => {
  const module = await import('./useTaskCenter')
  const show = ref(true), progress = ref(10), cancel = vi.fn()
  const Owner = defineComponent({ name: 'Owner', setup() { module.useTrackedTask(() => ({ kind: 'batch', title: '批次', status: 'running', route: '/prompt-builder', progress: progress.value }), { cancel }); return () => h('div') } })
  const wrapper = mount(defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => show.value ? h(Owner) : null }) }))
  show.value = false; await nextTick(); progress.value = 40; await nextTick()
  const task = module.useTaskCenter().tasks.value[0]
  expect(task.progress).toBe(40)
  expect(task.status).toBe('running')
  module.useTaskCenter().controls(task.id)?.cancel?.()
  expect(cancel).toHaveBeenCalledOnce()
  wrapper.unmount()
  expect(module.useTaskCenter().tasks.value[0].status).toBe('interrupted')
  expect(module.useTaskCenter().controls(task.id)).toBeUndefined()
  await module.flushTaskSummaries()
})

it('clearing history preserves active work and failures', async () => {
  const module = await import('./useTaskCenter')
  for (const status of ['running', 'failed', 'succeeded'] as const) module.createTask({ kind: 'image', title: status, status, route: '/prompt-builder' })
  module.useTaskCenter().clearCompleted()
  expect(module.useTaskCenter().tasks.value.map(task => task.status).sort()).toEqual(['failed', 'running'])
  await module.flushTaskSummaries()
})

it('persistence failure is visible without marking the running task failed', async () => {
  storage.set.mockRejectedValue(new Error('quota'))
  const module = await import('./useTaskCenter')
  module.createTask({ kind: 'image', title: '绘图', status: 'running', route: '/prompt-builder' })
  await module.flushTaskSummaries()
  expect(module.useTaskCenter().storageError.value).toContain('暂未保存')
  expect(module.useTaskCenter().activeCount.value).toBe(1)
})


it('a stopped owner can register a retry after its summary was cleared', async () => {
  const module = await import('./useTaskCenter')
  const status = ref<'running' | 'cancelled'>('running')
  const owner = mount(defineComponent({ setup() { module.useTrackedTask(() => ({ kind: 'batch', title: '重试批次', status: status.value, route: '/prompt-builder' })); return () => h('div') } }))
  status.value = 'cancelled'; await nextTick()
  module.useTaskCenter().clearCompleted()
  expect(module.useTaskCenter().tasks.value).toHaveLength(0)
  status.value = 'running'; await nextTick()
  expect(module.useTaskCenter().activeCount.value).toBe(1)
  owner.unmount(); await module.flushTaskSummaries()
})
