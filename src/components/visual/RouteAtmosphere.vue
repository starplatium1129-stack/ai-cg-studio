<template>
  <div
    class="route-atmosphere"
    :class="{ 'is-transitioning': transitioning }"
    :data-signal="signalState"
    :style="atmosphereStyle"
    aria-hidden="true"
  >
    <SemanticParticleField
      v-if="!routeHasOwnParticle"
      class="route-atmosphere-field"
      :shape="activeShape"
      label=""
      density="backdrop"
      :interactive="false"
      :signal="signalState"
      bare
      decorative
    />
    <div class="route-scan" aria-hidden="true"></div>
    <div class="route-progress" aria-hidden="true"><i></i></div>
    <div class="route-index" aria-hidden="true">
      <span>{{ routeMeta.code }}</span>
      <strong>{{ signalLabel || routeMeta.label }}</strong>
      <i></i>
      <small>LOCAL ARCHIVE</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import SemanticParticleField from '@/components/visual/SemanticParticleField.vue'
import type { ParticleShapeId } from '@/utils/particleShapes'
import {
  PARTICLE_SIGNAL_EVENT,
  type ParticleSignalDetail,
  type ParticleSignalState,
} from '@/utils/particleSignal'

interface RouteAtmosphereMeta {
  code: string
  label: string
  shape: ParticleShapeId
}

const ROUTE_META: Record<string, RouteAtmosphereMeta> = {
  '/': { code: '00', label: 'ATELIER HOME', shape: 'atelier' },
  '/prompt-builder': { code: '01', label: 'DIRECTOR CONSOLE', shape: 'frame' },
  '/scene-explorer': { code: '02', label: 'SCENE ARCHIVE', shape: 'mountain' },
  '/character': { code: '03', label: 'IDENTITY FILE', shape: 'moon' },
  '/style': { code: '04', label: 'VISUAL GRAMMAR', shape: 'spark' },
  '/showcase': { code: '05', label: 'APPROVED WORKS', shape: 'atelier' },
  '/gallery': { code: '06', label: 'PRIVATE COLLECTION', shape: 'frame' },
  '/color-script': { code: '07', label: 'CHROMATIC RECORD', shape: 'spark' },
  '/scenario': { code: '08', label: 'NARRATIVE SEQUENCE', shape: 'book' },
  '/chat': { code: '09', label: 'CHARACTER ROOM', shape: 'heart' },
  '/lora': { code: '10', label: 'MODEL SHELF', shape: 'frame' },
  '/training': { code: '11', label: 'TRAINING WORKBENCH', shape: 'book' },
  '/scene-manager': { code: '12', label: 'SCENE MAINTENANCE', shape: 'frame' },
  '/control': { code: '13', label: 'LOCAL CONTROL', shape: 'spark' },
}

const route = useRoute()
const ROUTES_WITH_OWN_PARTICLES = new Set([
  '/',
  '/scene-explorer',
  '/character',
  '/style',
  '/showcase',
  '/gallery',
  '/color-script',
  '/scenario',
])
const routeHasOwnParticle = computed(() => ROUTES_WITH_OWN_PARTICLES.has(route.path))
const signalState = ref<ParticleSignalState>('idle')
const signalShape = ref<ParticleShapeId | null>(null)
const signalLabel = ref('')
const transitioning = ref(false)
const shiftX = ref(0)
const shiftY = ref(0)
const scrollProgress = ref(0)
let signalTimer = 0
let transitionTimer = 0
let pointerFrame = 0
let scrollFrame = 0

const routeMeta = computed(() => ROUTE_META[route.path] || {
  code: '99', label: 'LOCAL ARCHIVE', shape: 'atelier' as ParticleShapeId,
})
const activeShape = computed(() => signalShape.value || routeMeta.value.shape)
const atmosphereStyle = computed(() => ({
  '--route-shift-x': `${shiftX.value}px`,
  '--route-shift-y': `${shiftY.value}px`,
  '--route-progress': String(scrollProgress.value),
}))

function onPointerMove(event: PointerEvent) {
  if (pointerFrame || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0
    shiftX.value = ((event.clientX / Math.max(1, window.innerWidth)) - .5) * 22
    shiftY.value = ((event.clientY / Math.max(1, window.innerHeight)) - .5) * 14
  })
}

function onScroll() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0
    const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    scrollProgress.value = Math.min(1, Math.max(0, window.scrollY / range))
  })
}

function resetSignal() {
  signalState.value = 'idle'
  signalShape.value = null
  signalLabel.value = ''
}

function onSignal(event: Event) {
  const detail = (event as CustomEvent<ParticleSignalDetail>).detail
  if (!detail) return
  window.clearTimeout(signalTimer)
  signalState.value = detail.state
  signalShape.value = detail.shape || null
  signalLabel.value = detail.label || ''
  signalTimer = window.setTimeout(resetSignal, Math.max(450, detail.duration ?? 1200))
}

watch(() => route.path, () => {
  window.clearTimeout(transitionTimer)
  resetSignal()
  transitioning.value = true
  signalState.value = 'active'
  transitionTimer = window.setTimeout(() => {
    transitioning.value = false
    signalState.value = 'idle'
  }, 760)
})

onMounted(() => {
  window.addEventListener(PARTICLE_SIGNAL_EVENT, onSignal)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onUnmounted(() => {
  window.removeEventListener(PARTICLE_SIGNAL_EVENT, onSignal)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('scroll', onScroll)
  window.clearTimeout(signalTimer)
  window.clearTimeout(transitionTimer)
  if (pointerFrame) cancelAnimationFrame(pointerFrame)
  if (scrollFrame) cancelAnimationFrame(scrollFrame)
})
</script>

<style scoped>
.route-atmosphere {
  position: fixed;
  z-index: var(--z-base);
  inset: 58px 0 0;
  overflow: hidden;
  pointer-events: none;
  opacity: .2;
  transition: opacity .5s ease;
}
.route-atmosphere::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 49.94%, color-mix(in srgb,var(--archive-blue) 16%,transparent) 50%, transparent 50.06%),
    linear-gradient(transparent 49.94%, color-mix(in srgb,var(--archive-blue) 12%,transparent) 50%, transparent 50.06%);
  background-size: 120px 120px;
  -webkit-mask-image: radial-gradient(circle at 76% 42%, #000, transparent 66%);
  mask-image: radial-gradient(circle at 76% 42%, #000, transparent 66%);
}
.route-atmosphere-field {
  position: absolute;
  inset: -8% -5% -8% 42%;
  min-height: 116%;
  opacity: .34;
  transform: translate3d(var(--route-shift-x,0),var(--route-shift-y,0),0);
  transition: transform .8s var(--ease-out);
  -webkit-mask-image: radial-gradient(ellipse at 55% 44%, #000 0 34%, transparent 74%);
  mask-image: radial-gradient(ellipse at 55% 44%, #000 0 34%, transparent 74%);
}
.route-atmosphere[data-signal="active"] { opacity: .42; }
.route-atmosphere[data-signal="success"] { opacity: .3; }
.route-atmosphere[data-signal="warning"] { opacity: .34; }
.route-scan {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -15%;
  width: 22%;
  opacity: 0;
  background: linear-gradient(90deg,transparent,color-mix(in srgb,var(--archive-blue) 12%,transparent),transparent);
  transform: skewX(-12deg);
}
.route-progress {
  position:absolute;
  z-index:var(--z-raised);
  top:26px;
  right:6px;
  bottom:26px;
  width:1px;
  background:color-mix(in srgb,var(--border-soft) 64%,transparent);
}
.route-progress i {
  display:block;
  width:100%;
  height:100%;
  background:var(--archive-blue);
  transform:scaleY(var(--route-progress,0));
  transform-origin:top;
  transition:transform .16s linear;
}
.is-transitioning .route-scan { animation: route-scan 760ms var(--ease-out) both; }
.route-index {
  position: absolute;
  right: clamp(18px, 3vw, 48px);
  bottom: clamp(24px, 5vw, 62px);
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  gap: 4px 10px;
  color: var(--text-muted);
  font: 700 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: .12em;
  text-align: right;
  opacity: .55;
}
.route-index span { color: var(--archive-blue); font-size: var(--fs-title-xs); }
.route-index strong { color: var(--text-secondary); }
.route-index i { height: 1px; background: var(--border-strong); }
.route-index small { font: inherit; }
@keyframes route-scan {
  0% { opacity:0; transform:translateX(0) skewX(-12deg); }
  18% { opacity:1; }
  100% { opacity:0; transform:translateX(620%) skewX(-12deg); }
}
@media (max-width: 760px) {
  .route-atmosphere { opacity: .1; }
  .route-atmosphere-field { inset: 12% -34% 18% 24%; }
  .route-index { display:none; }
  .route-progress { right:2px; }
}
@media (prefers-reduced-motion: reduce) {
  .route-atmosphere { transition:none; opacity:.1; }
  .route-scan { display:none; }
  .route-atmosphere-field { transform:none; transition:none; }
  .route-progress i { transition:none; }
}
</style>
