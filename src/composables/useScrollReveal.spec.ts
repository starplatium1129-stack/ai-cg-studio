import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useScrollReveal } from './useScrollReveal'

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })
it('only observes its own page and suspends work while cached offscreen', async () => {
  const observe = vi.fn(), disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class { observe = observe; unobserve = vi.fn(); disconnect = disconnect })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  const outside = document.createElement('div'); outside.dataset.reveal = ''; document.body.append(outside)
  const active = ref(true)
  const Page = defineComponent({ setup() { useScrollReveal(); return () => h('article', [h('div', { 'data-reveal': '' })]) } })
  const wrapper = mount(defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => active.value ? h(Page) : null }) }), { attachTo: document.body })
  expect(observe.mock.calls.some(([element]) => element === outside)).toBe(false)
  active.value = false; await nextTick()
  expect(disconnect).toHaveBeenCalled()
  const before = observe.mock.calls.length
  active.value = true; await nextTick()
  expect(observe.mock.calls.length).toBeGreaterThan(before)
  wrapper.unmount()
})
