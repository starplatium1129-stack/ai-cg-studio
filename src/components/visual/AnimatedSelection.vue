<template><span ref="indicator" class="animated-selection" aria-hidden="true"></span></template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
const props = withDefaults(defineProps<{ target?: string }>(), { target: '[aria-pressed="true"]' })
const indicator = ref<HTMLElement | null>(null)
let resize: ResizeObserver | undefined
let mutations: MutationObserver | undefined
let animation: Animation | undefined
let frame = 0
let media: MediaQueryList | undefined
let initialized = false
let parent: HTMLElement | null = null
let observedTarget: HTMLElement | null = null
let destinationBox = ''
function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
function update() {
  const el = indicator.value
  const selected = parent?.querySelector<HTMLElement>(props.target)
  if (!el || !parent) return
  if (selected !== observedTarget) {
    if (observedTarget) resize?.unobserve(observedTarget)
    observedTarget = selected ?? null
    if (observedTarget) resize?.observe(observedTarget)
  }
  if (!selected || !selected.getClientRects().length) { animation?.cancel(); el.style.opacity = '0'; initialized = false; destinationBox = ''; return }
  const previous = el.getBoundingClientRect()
  const host = parent.getBoundingClientRect()
  const next = selected.getBoundingClientRect()
  const x = next.left - host.left + parent.scrollLeft - parent.clientLeft
  const y = next.top - host.top + parent.scrollTop - parent.clientTop
  const box = [x, y, next.width, next.height].map(value => Math.round(value * 100) / 100).join(',')
  if (initialized && box === destinationBox && !media?.matches) return
  destinationBox = box
  animation?.cancel()
  el.style.width = next.width + 'px'
  el.style.height = next.height + 'px'
  el.style.opacity = '1'
  const destination = 'translate(' + x + 'px,' + y + 'px)'
  el.style.transform = destination
  if (initialized && previous.width && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const origin = 'translate(' + (previous.left - host.left + parent.scrollLeft - parent.clientLeft) + 'px,' + (previous.top - host.top + parent.scrollTop - parent.clientTop) + 'px) scale(' + previous.width / next.width + ',' + previous.height / next.height + ')'
    const duration = parseFloat(getComputedStyle(el).getPropertyValue('--motion-control')) || 200
    animation = el.animate([{ transform: origin }, { transform: destination }], { duration, easing: 'cubic-bezier(.22,1,.36,1)' })
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
  mutations.observe(parent, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed', 'aria-selected', 'hidden'] })
  parent.addEventListener('scroll', schedule, { passive: true })
  document.fonts?.addEventListener('loadingdone', schedule)
  schedule()
})
watch(() => props.target, schedule)
onUnmounted(() => { document.fonts?.removeEventListener('loadingdone', schedule); media?.removeEventListener('change', schedule); resize?.disconnect(); mutations?.disconnect(); animation?.cancel(); cancelAnimationFrame(frame); parent?.removeEventListener('scroll', schedule) })
</script>
<style scoped>
.animated-selection { position: absolute; inset: 0 auto auto 0; pointer-events: none; opacity: 0; transform-origin: 0 0; border-radius: var(--r-md); background: var(--bg-elevated); border: 1px solid var(--border-soft); box-shadow: none; }
</style>
