import { onMounted, onUnmounted } from 'vue'

/**
 * 为目标元素添加进入视口时的淡入动画
 * 用法：在 .vue 的 onMounted 里调用 useScrollReveal('[data-reveal]')
 */
export function useScrollReveal(selector = '[data-reveal]', options?: IntersectionObserverInit) {
  let observer: IntersectionObserver | null = null
  const seen = new WeakSet<Element>()

  function observeAll() {
    if (!observer) return
    document.querySelectorAll(selector).forEach(el => {
      if (seen.has(el)) return
      seen.add(el)
      observer!.observe(el)
    })
  }

  onMounted(() => {
    // 无 IO 或用户要求减少动效时，直接全部显形，不留隐藏元素
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (typeof IntersectionObserver === 'undefined' || reduced) {
      document.querySelectorAll(selector).forEach(el => el.classList.add('revealed'))
      return
    }

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
          observer?.unobserve(entry.target)
        }
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px', ...options })

    observeAll()
    // 场景/作品是异步载入的，首帧观察不到；补几次重扫
    ;[120, 400, 1200].forEach(delay => setTimeout(observeAll, delay))
  })

  onUnmounted(() => { observer?.disconnect(); observer = null })

  return { observeAll }
}
