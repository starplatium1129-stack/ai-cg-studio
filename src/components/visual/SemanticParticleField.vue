<template>
  <figure
    ref="host"
    class="semantic-particle-field"
    :class="[`density-${density}`, `signal-${signal}`, { 'is-static': reduceMotion, 'has-canvas': canvasAvailable, 'is-bare': bare }]"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative ? 'true' : undefined"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <canvas ref="canvas" aria-hidden="true"></canvas>
    <div class="particle-fallback" aria-hidden="true">
      <span v-for="index in 18" :key="index" :style="{ '--fallback-index': String(index) }"></span>
    </div>
    <figcaption v-if="caption" class="particle-caption">{{ caption }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { createParticleShape, type ParticlePoint, type ParticleShapeId } from '@/utils/particleShapes'

const props = withDefaults(defineProps<{
  shape: ParticleShapeId
  label: string
  caption?: string
  density?: 'backdrop' | 'ambient' | 'hero'
  interactive?: boolean
  bare?: boolean
  decorative?: boolean
  signal?: 'idle' | 'active' | 'success' | 'warning'
}>(), {
  caption: '',
  density: 'hero',
  interactive: true,
  bare: false,
  decorative: false,
  signal: 'idle',
})

interface RuntimeParticle {
  x: number
  y: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  tone: 0 | 1 | 2
  phase: number
}

interface Palette {
  primary: string
  secondary: string
  accent: string
}

const host = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const reduceMotion = ref(false)
const canvasAvailable = ref(true)

let context: CanvasRenderingContext2D | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let themeObserver: MutationObserver | null = null
let motionMedia: MediaQueryList | null = null
let frameId = 0
let width = 0
let height = 0
let dpr = 1
let particles: RuntimeParticle[] = []
let palette: Palette = { primary: '#d9d5df', secondary: '#77717f', accent: '#f4a6d7' }
let visible = true
let transitionStart = 0
let transitionDuration = 1180
let pointerX = -10000
let pointerY = -10000
let pointerActive = false
let lastFrame = 0
let slowFrames = 0
let qualityScale = 1

function preferredCount(): number {
  if (reduceMotion.value) return 260
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const compact = window.matchMedia('(max-width: 760px)').matches
  if (props.density === 'backdrop') return Math.round((compact ? 120 : 180) * qualityScale)
  if (compact || (memory !== undefined && memory <= 4)) return Math.round(360 * qualityScale)
  return Math.round((props.density === 'ambient' ? 520 : 860) * qualityScale)
}

function readPalette() {
  if (!host.value) return
  const style = getComputedStyle(host.value)
  palette = {
    primary: style.getPropertyValue('--text-primary').trim() || '#d9d5df',
    secondary: style.getPropertyValue('--text-muted').trim() || '#77717f',
    accent: style.getPropertyValue('--archive-blue').trim() || style.getPropertyValue('--accent-violet').trim() || '#f4a6d7',
  }
  if (reduceMotion.value) draw(performance.now())
}

function targetPosition(point: ParticlePoint): { x: number; y: number } {
  const paddingX = Math.max(22, width * 0.08)
  const paddingY = Math.max(20, height * 0.08)
  return {
    x: paddingX + point.x * Math.max(1, width - paddingX * 2),
    y: paddingY + point.y * Math.max(1, height - paddingY * 2),
  }
}

function setShape(animate = true) {
  if (!width || !height) return
  const count = Math.max(120, preferredCount())
  const shape = createParticleShape(props.shape, count)
  const previous = particles.slice().sort((a, b) => {
    const rowA = Math.round(a.y / Math.max(1, height) * 18)
    const rowB = Math.round(b.y / Math.max(1, height) * 18)
    return rowA === rowB ? a.x - b.x : rowA - rowB
  })

  particles = shape.map((point, index) => {
    const target = targetPosition(point)
    const current = previous[index]
    const x = current?.x ?? Math.random() * width
    const y = current?.y ?? Math.random() * height
    return {
      x,
      y,
      startX: x,
      startY: y,
      targetX: target.x,
      targetY: target.y,
      tone: point.tone,
      phase: current?.phase ?? Math.random() * Math.PI * 2,
    }
  })

  transitionStart = performance.now()
  transitionDuration = animate && !reduceMotion.value ? 1180 : 0
  if (!transitionDuration) {
    particles.forEach((particle) => {
      particle.x = particle.targetX
      particle.y = particle.targetY
    })
    draw(transitionStart)
  } else {
    startLoop()
  }
}

function easeOutQuart(value: number): number {
  return 1 - (1 - value) ** 4
}

function draw(now: number) {
  if (!context || !canvas.value) return
  context.clearRect(0, 0, width, height)
  const rawProgress = transitionDuration ? Math.min(1, (now - transitionStart) / transitionDuration) : 1
  const progress = easeOutQuart(rawProgress)
  const signalEnergy = props.signal === 'active' ? 1.75 : props.signal === 'warning' ? 1.35 : props.signal === 'success' ? 1.15 : 1
  const idleAmount = reduceMotion.value ? 0 : (props.density === 'ambient' ? 2.2 : 3.6) * signalEnergy

  for (const particle of particles) {
    particle.x = particle.startX + (particle.targetX - particle.startX) * progress
    particle.y = particle.startY + (particle.targetY - particle.startY) * progress
    const driftX = Math.sin(now * 0.00046 + particle.phase) * idleAmount
    const driftY = Math.cos(now * 0.00038 + particle.phase * 1.3) * idleAmount * 0.72
    let offsetX = 0
    let offsetY = 0

    if (props.interactive && pointerActive && !reduceMotion.value) {
      const dx = particle.x - pointerX
      const dy = particle.y - pointerY
      const distance = Math.hypot(dx, dy)
      const radius = Math.min(132, Math.max(84, width * 0.18))
      if (distance > 0 && distance < radius) {
        const force = (1 - distance / radius) ** 2 * 14
        offsetX = dx / distance * force
        offsetY = dy / distance * force
      }
    }

    const energyScale = props.signal === 'active' ? 1.22 : props.signal === 'warning' ? 1.1 : 1
    const radius = (particle.tone === 2 ? 1.55 : particle.tone === 1 ? 1.05 : 0.78) * energyScale
    context.globalAlpha = particle.tone === 2 ? 0.9 : particle.tone === 1 ? 0.46 : 0.72
    context.fillStyle = particle.tone === 2 ? palette.accent : particle.tone === 1 ? palette.secondary : palette.primary
    context.beginPath()
    context.arc(particle.x + driftX + offsetX, particle.y + driftY + offsetY, radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
}

function renderFrame(now: number) {
  frameId = 0
  if (!visible || document.hidden || reduceMotion.value) return
  if (lastFrame) {
    const elapsed = now - lastFrame
    slowFrames = elapsed > 24 ? slowFrames + 1 : Math.max(0, slowFrames - 2)
    if (slowFrames >= 20 && qualityScale > 0.48) {
      qualityScale *= 0.7
      slowFrames = 0
      setShape(false)
    }
  }
  lastFrame = now
  draw(now)
  frameId = requestAnimationFrame(renderFrame)
}

function startLoop() {
  if (!frameId && visible && !document.hidden && !reduceMotion.value) {
    lastFrame = 0
    frameId = requestAnimationFrame(renderFrame)
  }
}

function stopLoop() {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
}

function resize() {
  if (!host.value || !canvas.value) return
  const rect = host.value.getBoundingClientRect()
  width = Math.max(1, Math.round(rect.width))
  height = Math.max(1, Math.round(rect.height))
  dpr = props.density === 'backdrop'
    ? 1
    : Math.min(window.devicePixelRatio || 1, window.matchMedia('(max-width: 760px)').matches ? 1.25 : 1.75)
  canvas.value.width = Math.round(width * dpr)
  canvas.value.height = Math.round(height * dpr)
  canvas.value.style.width = `${width}px`
  canvas.value.style.height = `${height}px`
  try {
    context = canvas.value.getContext('2d')
  } catch {
    context = null
  }
  canvasAvailable.value = context !== null
  if (!context) {
    stopLoop()
    return
  }
  context?.setTransform(dpr, 0, 0, dpr, 0, 0)
  setShape(false)
}

function onPointerMove(event: PointerEvent) {
  if (!host.value || event.pointerType === 'touch') return
  const rect = host.value.getBoundingClientRect()
  pointerX = event.clientX - rect.left
  pointerY = event.clientY - rect.top
  pointerActive = true
  startLoop()
}

function onPointerLeave() {
  pointerActive = false
}

function onVisibilityChange() {
  if (document.hidden) stopLoop()
  else if (visible) startLoop()
}

function onMotionPreference(event: MediaQueryListEvent | MediaQueryList) {
  reduceMotion.value = event.matches
  if (reduceMotion.value) stopLoop()
  setShape(false)
}

watch(() => props.shape, () => setShape(true))
watch(() => props.density, () => setShape(false))
watch(() => props.signal, () => startLoop())

onMounted(() => {
  if (!host.value || !canvas.value) return
  motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionPreference(motionMedia)
  motionMedia.addEventListener('change', onMotionPreference)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host.value)
  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true
    if (visible) startLoop()
    else stopLoop()
  }, { rootMargin: '120px' })
  intersectionObserver.observe(host.value)
  themeObserver = new MutationObserver(readPalette)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  document.addEventListener('visibilitychange', onVisibilityChange)
  readPalette()
  resize()
  startLoop()
})

onUnmounted(() => {
  stopLoop()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  themeObserver?.disconnect()
  motionMedia?.removeEventListener('change', onMotionPreference)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<style scoped>
.semantic-particle-field {
  --particle-primary: var(--text-primary);
  --particle-secondary: var(--text-muted);
  --particle-accent: var(--archive-blue);
  position:relative;
  min-width:0;
  min-height:260px;
  overflow:hidden;
  isolation:isolate;
  margin:0;
  background:
    linear-gradient(90deg,color-mix(in srgb,var(--border-soft) 54%,transparent) 1px,transparent 1px),
    linear-gradient(color-mix(in srgb,var(--border-soft) 54%,transparent) 1px,transparent 1px),
    radial-gradient(circle at 50% 48%,color-mix(in srgb,var(--particle-accent) 10%,transparent),transparent 55%);
  background-size:42px 42px,42px 42px,auto;
}
.semantic-particle-field::before,
.semantic-particle-field::after {
  content:"";
  position:absolute;
  pointer-events:none;
  z-index:var(--z-base);
}
.semantic-particle-field::before {
  inset:var(--s-3);
  border:1px solid color-mix(in srgb,var(--border-soft) 76%,transparent);
  clip-path:polygon(0 0,24% 0,24% 1px,76% 1px,76% 0,100% 0,100% 100%,76% 100%,76% calc(100% - 1px),24% calc(100% - 1px),24% 100%,0 100%);
}
.semantic-particle-field::after {
  left:50%; top:50%; width:5px; height:5px;
  border:1px solid var(--particle-accent);
  transform:translate(-50%,-50%) rotate(45deg);
  opacity:.7;
}
canvas { display:none; position:absolute; inset:0; width:100%; height:100%; z-index:var(--z-base); }
.has-canvas canvas { display:block; }
.particle-fallback { display:grid; position:absolute; inset:0; place-items:center; }
.has-canvas .particle-fallback { display:none; }
.particle-fallback span { position:absolute; width:3px; height:3px; border-radius:50%; background:var(--particle-primary); transform:rotate(calc(var(--fallback-index,1) * 20deg)) translateX(72px); }
.particle-fallback span:nth-child(3n) { background:var(--particle-accent); }
.particle-caption {
  position:absolute; z-index:var(--z-raised); right:var(--s-4); bottom:var(--s-3);
  color:var(--text-muted); font:650 var(--fs-mono-xs) var(--font-mono);
  letter-spacing:.12em; text-transform:uppercase;
}
.density-ambient { min-height:100%; background-size:56px 56px,56px 56px,auto; }
.density-backdrop { min-height:100%; background-size:64px 64px,64px 64px,auto; }
.is-bare { min-height:100%; background:none; }
.is-bare::before,.is-bare::after,.is-bare .particle-caption { display:none; }
.signal-active canvas { filter:drop-shadow(0 0 8px color-mix(in srgb,var(--particle-accent) 32%,transparent)); }
.signal-warning canvas { filter:drop-shadow(0 0 7px color-mix(in srgb,var(--warning) 26%,transparent)); }
@media (max-width:760px) {
  .semantic-particle-field { min-height:240px; background-size:34px 34px,34px 34px,auto; }
  .particle-caption { right:var(--s-3); }
}
@media (prefers-reduced-motion:reduce) {
  .semantic-particle-field { background-image:radial-gradient(circle at 50% 48%,color-mix(in srgb,var(--particle-accent) 12%,transparent),transparent 55%); }
}
</style>
