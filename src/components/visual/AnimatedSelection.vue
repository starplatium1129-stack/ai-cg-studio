<template><span ref="indicator" class="animated-selection" aria-hidden="true"></span></template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
const props = withDefaults(defineProps<{ target?: string }>(), { target: '[aria-pressed="true"]' })
const indicator = ref<HTMLElement | null>(null)
let resize: ResizeObserver | undefined
let mutations: MutationObserver | undefined
let animation: Animation | undefined
let frame = 0
let media: MediaQueryList | undefined
let initialized = false
let parent: HTMLElement | null = null
function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
function update() {
  const el = indicator.value
  const selected = parent?.querySelector<HTMLElement>(props.target)
  if (!el || !parent) return
  if (!selected || !selected.getClientRects().length) { el.style.opacity = '0'; initialized = false; return }
  const previous = el.getBoundingClientRect()
  const host = parent.getBoundingClientRect()
  const next = selected.getBoundingClientRect()
  animation?.cancel()
  const x = next.left - host.left + parent.scrollLeft
  const y = next.top - host.top + parent.scrollTop
  el.style.width = next.width + 'px'
  el.style.height = next.height + 'px'
  el.style.opacity = '1'
  const destination = 'translate(' + x + 'px,' + y + 'px)'
  el.style.transform = destination
  if (initialized && previous.width && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const origin = 'translate(' + (previous.left - host.left + parent.scrollLeft) + 'px,' + (previous.top - host.top + parent.scrollTop) + 'px) scale(' + previous.width / next.width + ',' + previous.height / next.height + ')'
    animation = el.animate([{ transform: origin }, { transform: destination }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' })
  }
  initialized = true
}
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', schedule)
  parent = indicator.value?.parentElement ?? null
  if (!parent) return
  resize = new ResizeObserver(schedule)
  resize.observe(parent)
  mutations = new MutationObserver(schedule)
  mutations.observe(parent, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] })
  parent.addEventListener('scroll', schedule, { passive: true })
  schedule()
})
onUnmounted(() => { media?.removeEventListener('change', schedule); resize?.disconnect(); mutations?.disconnect(); animation?.cancel(); cancelAnimationFrame(frame); parent?.removeEventListener('scroll', schedule) })
</script>
<style scoped>
.animated-selection { position: absolute; inset: 0 auto auto 0; pointer-events: none; opacity: 0; transform-origin: 0 0; border-radius: var(--r-md); background: var(--bg-elevated); border: 1px solid var(--border-soft); box-shadow: inset 0 1px 0 var(--glass-highlight), var(--shadow-sm); }
</style>
