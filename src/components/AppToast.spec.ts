import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppToast from './AppToast.vue'
import { useToast } from '@/composables/useToast'
vi.mock('motion', () => ({ animateMini: () => Promise.resolve() }))
vi.mock('@/composables/useInterfaceFeedback', () => ({ playInterfaceTone: vi.fn() }))
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

it('resumes expiry when the focused dismiss button is removed', async () => {
  vi.useFakeTimers()
  const wrapper = mount(AppToast, { attachTo: document.body, global: { stubs: { transition: false, 'transition-group': false } } })
  const toast = useToast()
  toast.show('第一条', 'info', 1000)
  await nextTick(); await flushPromises()
  const close = document.querySelector<HTMLButtonElement>('.toast-close')!
  close.focus()
  close.click()
  await nextTick(); await flushPromises(); await nextTick()
  toast.show('第二条', 'info', 1000)
  await nextTick()
  vi.advanceTimersByTime(1001)
  expect(toast.toasts.value).toHaveLength(0)
  wrapper.unmount()
})
