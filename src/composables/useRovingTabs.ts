import { nextTick, type Ref } from 'vue'

/**
 * 完成 tablist 模式的最后一段：roving tabindex + 方向键。
 *
 * 为什么需要：`role="tablist"` + `role="tab"` 一旦声明，读屏就会播报
 * "标签 1 / 2"并让用户按方向键切换。只写 role 不接键盘，等于承诺了一套
 * 交互又不实现 —— 比一开始就用普通按钮更糟（审计 AX-6）。
 *
 * 用法：
 *   const tabs = useRovingTabs(ids, activeId, id => { activeId.value = id })
 *   <div role="tablist" @keydown="tabs.onKeydown">
 *     <button role="tab" :id="tabs.tabId(id)" :aria-controls="tabs.panelId(id)"
 *             :aria-selected="..." :tabindex="tabs.tabIndex(id)">
 */
export function useRovingTabs(
  ids: Ref<readonly string[]> | (() => readonly string[]),
  activeId: Ref<string> | (() => string),
  select: (id: string) => void,
  options: { prefix?: string } = {},
) {
  const prefix = options.prefix ?? 'tab'
  const list = () => (typeof ids === 'function' ? ids() : ids.value)
  const active = () => (typeof activeId === 'function' ? activeId() : activeId.value)

  const tabId = (id: string) => `${prefix}-${id}`
  const panelId = (id: string) => `${prefix}panel-${id}`
  /** 只有当前项进 Tab 序列，其余靠方向键到达 */
  const tabIndex = (id: string) => (active() === id ? 0 : -1)

  async function focusTab(id: string) {
    select(id)
    await nextTick()
    document.getElementById(tabId(id))?.focus()
  }

  function onKeydown(event: KeyboardEvent) {
    const items = list()
    if (items.length < 2) return
    const current = items.indexOf(active())
    if (current < 0) return

    let next = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % items.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    if (next < 0) return

    event.preventDefault()
    void focusTab(items[next])
  }

  return { tabId, panelId, tabIndex, onKeydown, focusTab }
}
