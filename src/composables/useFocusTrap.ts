import { useConfirmState } from './useConfirm.ts'
import { ref, watch, onActivated, onDeactivated, onUnmounted, nextTick, type Ref } from 'vue'

/**
 * 弹层焦点管理。
 *
 * 抽自 GalleryView —— 审计时 6 个弹层里只有它做对了（存取焦点、真 Tab 陷阱、
 * Escape、滚动锁），其余 5 个连 role="dialog" 都没有，Tab 能直接跑到背景内容上。
 * 破坏性最强的场景编辑器当时只有 @click.self。
 *
 * 用法：
 *   const overlay = ref<HTMLElement | null>(null)
 *   useFocusTrap(overlay, () => editing.value !== null, { onEscape: closeModal })
 */

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const trapStack: symbol[] = []
const scrollLocks = new Set<symbol>()
let previouslyLocked = false

export interface FocusTrapOptions {
  /** Escape 键回调；不传则不处理 Escape */
  onEscape?: () => void
  /** 打开时锁 body 滚动（加 .overlay-open） */
  lockScroll?: boolean
  /** 打开后要聚焦的元素；默认第一个可聚焦元素 */
  initialFocus?: Ref<HTMLElement | null>
}

export function useFocusTrap(
  root: Ref<HTMLElement | null>,
  isOpen: () => boolean,
  options: FocusTrapOptions = {},
) {
  const { onEscape, lockScroll = true, initialFocus } = options
  const confirmation = useConfirmState()
  /** 打开前的焦点位置，关闭后要还回去 */
  const returnFocus = ref<HTMLElement | null>(null)
  const attached = ref(true)
  const owner = Symbol('focus-trap')
  let fallbackRoot: HTMLElement | null = null

  function focusableIn(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      // offsetParent 为 null = 被隐藏；但当前焦点元素要保留，否则 Tab 会跳丢
      .filter(el => !el.closest('[inert], [hidden]') && getComputedStyle(el).visibility !== 'hidden'
        && (el.getClientRects().length > 0 || el.offsetParent !== null || el === document.activeElement))
  }

  function onKeydown(event: KeyboardEvent) {
    if (!attached.value || !isOpen() || trapStack.at(-1) !== owner || confirmation.value.visible || event.defaultPrevented) return

    if (event.key === 'Escape' && onEscape) {
      event.preventDefault()
      onEscape()
      return
    }
    if (event.key !== 'Tab') return

    const container = root.value
    if (!container) return
    const focusable = focusableIn(container)
    if (!focusable.length) { event.preventDefault(); return }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus()
    } else if (!container.contains(document.activeElement)) {
      // 焦点已经在弹层外（例如刚打开还没聚焦）——拉回来
      event.preventDefault(); first.focus()
    }
  }

  document.addEventListener('keydown', onKeydown)

  function release(restoreFocus: boolean) {
    const top = trapStack.at(-1) === owner
    const index = trapStack.indexOf(owner)
    if (index >= 0) trapStack.splice(index, 1)
    if (scrollLocks.delete(owner) && !scrollLocks.size && !previouslyLocked) document.body.classList.remove('overlay-open')
    if (restoreFocus && top && returnFocus.value?.isConnected) returnFocus.value.focus({ preventScroll: true })
    returnFocus.value = null
    if (fallbackRoot) { fallbackRoot.removeAttribute('tabindex'); fallbackRoot = null }
  }

  watch(() => attached.value && isOpen(), (open, wasOpen) => {
    if (open === wasOpen) return
    if (open) {
      returnFocus.value = document.activeElement as HTMLElement | null
      trapStack.push(owner)
      if (lockScroll) {
        if (!scrollLocks.size) previouslyLocked = document.body.classList.contains('overlay-open')
        scrollLocks.add(owner)
        document.body.classList.add('overlay-open')
      }
      nextTick(() => {
        if (!attached.value || !isOpen() || trapStack.at(-1) !== owner) return
        const target = initialFocus?.value
          ?? (root.value ? focusableIn(root.value)[0] : null)
        if (target) target.focus({ preventScroll: true })
        else if (root.value) {
          if (!root.value.hasAttribute('tabindex')) { root.value.setAttribute('tabindex', '-1'); fallbackRoot = root.value }
          root.value.focus({ preventScroll: true })
        }
      })
    } else {
      release(attached.value)
    }
  }, { immediate: true })
  onActivated(() => { attached.value = true })
  onDeactivated(() => { attached.value = false })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
    release(false)
  })

  return { returnFocus }
}
