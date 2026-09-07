import { onMounted, onUnmounted } from 'vue'

/** Reveal content once as it enters the viewport, including late-loading collections. */
export function useScrollReveal(selector = '[data-reveal]', options?: IntersectionObserverInit) {
  let observer: IntersectionObserver | null = null
  let mutations: MutationObserver | null = null
  let media: MediaQueryList | null = null
  let frame = 0
  const seen = new WeakSet<Element>()
  function observeAll() {
    document.querySelectorAll(selector).forEach(el => {
      if (media?.matches || !observer) { el.classList.add('revealed'); return }
      if (seen.has(el)) return
      seen.add(el)
      observer.observe(el)
    })
  }
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(observeAll) }
  onMounted(() => {
    media = matchMedia('(prefers-reduced-motion: reduce)')
    if ('IntersectionObserver' in window) observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer?.unobserve(entry.target) } })
    }, { threshold: 0.04, rootMargin: '0px 0px -24px 0px', ...options })
    media.addEventListener('change', observeAll)
    mutations = new MutationObserver(schedule)
    mutations.observe(document.querySelector('main') || document.body, { childList: true, subtree: true })
    observeAll()
  })
  onUnmounted(() => { observer?.disconnect(); mutations?.disconnect(); media?.removeEventListener('change', observeAll); cancelAnimationFrame(frame) })
  return { observeAll }
}
