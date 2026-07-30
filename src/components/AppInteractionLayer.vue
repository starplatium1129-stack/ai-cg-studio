<template>
  <div class="route-loader" :class="{ active: routeLoading }" aria-hidden="true"><i></i></div>
  <div
    class="interaction-impulse"
    :class="{ active: impulseVisible }"
    :style="impulseStyle"
    aria-hidden="true"
  ></div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { playInterfaceTone, type InterfaceTone } from '@/composables/useInterfaceFeedback'

const router = useRouter()
const routeLoading = ref(false)
const impulseVisible = ref(false)
const impulseX = ref(0)
const impulseY = ref(0)
const impulseStyle = computed(() => ({
  '--impulse-x': `${impulseX.value}px`,
  '--impulse-y': `${impulseY.value}px`,
}))
let impulseTimer = 0
let routeTimer = 0
let removeBefore: (() => void) | null = null
let removeAfter: (() => void) | null = null

function interactiveTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>('button:not(:disabled),a[href],summary,[role="button"]:not([aria-disabled="true"])')
    : null
}

function onPointerDown(event: PointerEvent) {
  const target = interactiveTarget(event.target)
  if (!target) return
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.clearTimeout(impulseTimer)
    impulseX.value = event.clientX
    impulseY.value = event.clientY
    impulseVisible.value = false
    requestAnimationFrame(() => { impulseVisible.value = true })
    impulseTimer = window.setTimeout(() => { impulseVisible.value = false }, 420)
  }
}

function onClick(event: MouseEvent) {
  const target = interactiveTarget(event.target)
  if (!target) return
  if (target.matches('[data-interface-sound-toggle]')) return
  const tone: InterfaceTone = target.matches('.btn-danger,.danger,[data-tone="danger"]')
    ? 'warning'
    : target.matches('.btn-primary,[data-tone="confirm"]') ? 'confirm' : 'tap'
  playInterfaceTone(tone)
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('click', onClick)
  removeBefore = router.beforeEach(() => {
    window.clearTimeout(routeTimer)
    routeLoading.value = true
    return true
  })
  removeAfter = router.afterEach(() => {
    routeTimer = window.setTimeout(() => { routeLoading.value = false }, 280)
  })
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('click', onClick)
  removeBefore?.()
  removeAfter?.()
  window.clearTimeout(impulseTimer)
  window.clearTimeout(routeTimer)
})
</script>

<style scoped>
.route-loader { position:fixed; z-index:var(--z-toast); inset:0 0 auto; height:2px; overflow:hidden; pointer-events:none; opacity:0; transition:opacity var(--t-fast); }
.route-loader i { display:block; width:38%; height:100%; background:linear-gradient(90deg,transparent,var(--archive-blue),var(--accent),transparent); transform:translateX(-110%); }
.route-loader.active { opacity:1; }
.route-loader.active i { animation:route-loader-run .82s var(--ease-out) infinite; }
.interaction-impulse { position:fixed; z-index:var(--z-toast); left:var(--impulse-x); top:var(--impulse-y); width:12px; height:12px; border:1px solid var(--archive-blue); border-radius:50%; opacity:0; transform:translate(-50%,-50%) scale(.2); pointer-events:none; }
.interaction-impulse.active { animation:interaction-impulse .42s var(--ease-out) both; }
@keyframes route-loader-run { to{transform:translateX(290%)} }
@keyframes interaction-impulse { 0%{opacity:.8;transform:translate(-50%,-50%) scale(.25)} 100%{opacity:0;transform:translate(-50%,-50%) scale(3.4)} }
@media(prefers-reduced-motion:reduce){.route-loader,.interaction-impulse{display:none}}
</style>
