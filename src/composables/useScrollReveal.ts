import { onMounted, onUnmounted } from 'vue'

/**
 * 为目标元素添加进入视口时的淡入动画
 * 用法：在 .vue 的 onMounted 里调用 useScrollReveal('[data-reveal]')
 */
export function useScrollReveal(selector = '[data-reveal]', options?: IntersectionObserverInit) {
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (typeof IntersectionObserver === 'undefined') return

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
          observer?.unobserve(entry.target)
        }
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px', ...options })

    document.querySelectorAll(selector).forEach(el => observer?.observe(el))
  })

  onUnmounted(() => { observer?.disconnect() })
}
