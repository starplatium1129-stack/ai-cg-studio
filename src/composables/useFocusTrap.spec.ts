import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useFocusTrap } from './useFocusTrap'

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; document.body.classList.remove('overlay-open') })

it('a cached inactive page releases its trap and reacquires it when restored', async () => {
  const active = ref(true), close = vi.fn()
  const Page = defineComponent({ setup() {
    const root = ref<HTMLElement | null>(null)
    useFocusTrap(root, () => true, { onEscape: close })
    return () => h('section', { ref: root })
  } })
  const owner = mount(defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => active.value ? h(Page) : null }) }), { attachTo: document.body })
  await nextTick()
  expect(document.body.classList.contains('overlay-open')).toBe(true)
  active.value = false; await nextTick(); await nextTick()
  expect(document.body.classList.contains('overlay-open')).toBe(false)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
  expect(close).not.toHaveBeenCalled()
  active.value = true; await nextTick(); await nextTick()
  expect(document.body.classList.contains('overlay-open')).toBe(true)
  owner.unmount()
})

it('an initially open empty dialog receives focus and restores the opener on close', async () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus()
  const open = ref(true)
  const owner = mount(defineComponent({ setup() {
    const root = ref<HTMLElement | null>(null)
    useFocusTrap(root, () => open.value)
    return () => h('section', { ref: root })
  } }), { attachTo: document.body })
  await nextTick()
  expect(document.activeElement).toBe(owner.element)
  expect(owner.attributes('tabindex')).toBe('-1')
  open.value = false; await nextTick()
  expect(document.activeElement).toBe(opener)
  expect(owner.attributes('tabindex')).toBeUndefined()
  owner.unmount()
})
it('only the top trap handles Escape and closing it preserves the underlying scroll lock', async () => {
  const firstOpen = ref(false), secondOpen = ref(false)
  const firstClose = vi.fn(() => { firstOpen.value = false })
  const secondClose = vi.fn(() => { secondOpen.value = false })
  const owner = mount(defineComponent({ setup() {
    const first = ref<HTMLElement | null>(null), second = ref<HTMLElement | null>(null)
    useFocusTrap(first, () => firstOpen.value, { onEscape: firstClose })
    useFocusTrap(second, () => secondOpen.value, { onEscape: secondClose })
    return () => h('div', [h('section', { ref: first }, [h('button', 'one')]), h('section', { ref: second }, [h('button', 'two')])])
  } }), { attachTo: document.body })
  firstOpen.value = true; await nextTick()
  secondOpen.value = true; await nextTick()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await nextTick()
  expect(secondClose).toHaveBeenCalledOnce()
  expect(firstClose).not.toHaveBeenCalled()
  expect(document.body.classList.contains('overlay-open')).toBe(true)
  owner.unmount()
  expect(document.body.classList.contains('overlay-open')).toBe(false)
})
