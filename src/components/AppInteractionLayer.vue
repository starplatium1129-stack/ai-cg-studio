<template>
  <div class="route-loader" :class="{ active: routeLoading }" aria-hidden="true"><i></i></div>
  <div
    class="interaction-impulse"
    :class="{ active: impulseVisible }"
    :style="impulseStyle"
    aria-hidden="true"
  ></div>
  <div class="route-cut" :class="{ active: routeCutActive }" aria-hidden="true">
    <div class="route-cut-wash"></div>
    <div class="route-cut-line route-cut-line-a"></div>
    <div class="route-cut-line route-cut-line-b"></div>
    <div class="route-cut-register">
      <span>{{ routeCutCode }}</span>
      <strong>{{ routeCutLabel }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { playInterfaceTone, type InterfaceTone } from '@/composables/useInterfaceFeedback'

const router = useRouter()
const routeLoading = ref(false)
const routeCutActive = ref(false)
const routeCutCode = ref('00')
const routeCutLabel = ref('LOCAL ARCHIVE')
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

const ROUTE_LABELS: Record<string, [string, string]> = {
  '/': ['00', 'ATELIER HOME'],
  '/scene-explorer': ['02', 'SCENE ARCHIVE'],
  '/prompt-builder': ['01', 'DIRECTOR CONSOLE'],
  '/chat': ['09', 'CHARACTER ROOM'],
  '/showcase': ['05', 'APPROVED WORKS'],
  '/gallery': ['06', 'PRIVATE COLLECTION'],
  '/character': ['03', 'IDENTITY FILE'],
  '/style': ['04', 'VISUAL GRAMMAR'],
  '/lora': ['10', 'MODEL SHELF'],
  '/training': ['11', 'TRAINING WORKBENCH'],
  '/scene-manager': ['12', 'SCENE MAINTENANCE'],
  '/color-script': ['07', 'CHROMATIC RECORD'],
  '/scenario': ['08', 'NARRATIVE SEQUENCE'],
  '/control': ['13', 'LOCAL CONTROL'],
}

function setRouteCut(path: string): void {
  const [code, label] = ROUTE_LABELS[path] || ['99', 'LOCAL ARCHIVE']
  routeCutCode.value = code
  routeCutLabel.value = label
}

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
  removeBefore = router.beforeEach((to) => {
    window.clearTimeout(routeTimer)
    setRouteCut(to.path)
    routeLoading.value = true
    routeCutActive.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    return true
  })
  removeAfter = router.afterEach(() => {
    routeTimer = window.setTimeout(() => {
      routeLoading.value = false
      routeCutActive.value = false
    }, 440)
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
.route-cut { position:fixed; z-index:var(--z-toast); inset:0; overflow:hidden; pointer-events:none; opacity:0; }
.route-cut-wash { position:absolute; inset:0; background:linear-gradient(110deg,transparent 0 42%,color-mix(in srgb,var(--archive-blue) 5%,transparent) 48%,transparent 54%); transform:translateX(-100%); }
.route-cut-line { position:absolute; height:1px; background:linear-gradient(90deg,transparent,var(--archive-blue),var(--accent),transparent); transform:scaleX(0); transform-origin:left; }
.route-cut-line-a { top:31%; left:8%; width:62%; }
.route-cut-line-b { right:6%; bottom:26%; width:46%; transform-origin:right; }
.route-cut-register { position:absolute; right:clamp(20px,6vw,96px); top:clamp(86px,16vh,170px); display:grid; gap:4px; color:var(--text-muted); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.16em; text-align:right; transform:translateX(18px); }
.route-cut-register span { color:var(--archive-blue); font-size:clamp(1.4rem,3vw,2.6rem); letter-spacing:-.06em; }
.route-cut-register strong { font:inherit; color:var(--text-secondary); }
.route-cut.active { opacity:1; }
.route-cut.active .route-cut-wash { animation:route-cut-wash .44s var(--ease-out) both; }
.route-cut.active .route-cut-line-a { animation:route-cut-line .34s var(--ease-out) .04s both; }
.route-cut.active .route-cut-line-b { animation:route-cut-line-reverse .38s var(--ease-out) .08s both; }
.route-cut.active .route-cut-register { animation:route-cut-register .32s var(--ease-out) .06s both; }
@keyframes route-loader-run { to{transform:translateX(290%)} }
@keyframes interaction-impulse { 0%{opacity:.8;transform:translate(-50%,-50%) scale(.25)} 100%{opacity:0;transform:translate(-50%,-50%) scale(3.4)} }
@keyframes route-cut-wash { 0%{transform:translateX(-100%)} 65%{transform:translateX(16%)} 100%{transform:translateX(100%)} }
@keyframes route-cut-line { from{transform:scaleX(0)} to{transform:scaleX(1)} }
@keyframes route-cut-line-reverse { from{transform:scaleX(0)} to{transform:scaleX(1)} }
@keyframes route-cut-register { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:none} }
@media(prefers-reduced-motion:reduce){.route-loader,.interaction-impulse,.route-cut{display:none}}
</style>
