<template>
  <figure
    ref="host"
    class="semantic-particle-field"
    :class="[`density-${density}`, `signal-${signal}`, { 'is-static': reduceMotion, 'has-canvas': canvasAvailable, 'is-bare': bare }]"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative ? 'true' : undefined"
    @pointermove="onPointerMove"
    @pointerdown="onPointerDown"
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
import { loadPortraitCloud, samplePortraitPoints, type PortraitCloud } from '@/utils/particlePortrait'
import { registerParticleFrame } from '@/utils/particleScheduler'

const props = withDefaults(defineProps<{
  shape: ParticleShapeId
  label: string
  caption?: string
  density?: 'backdrop' | 'ambient' | 'hero'
  interactive?: boolean
  bare?: boolean
  decorative?: boolean
  signal?: 'idle' | 'active' | 'success' | 'warning'
  /** 角色形象粒子：提供且有预生成点云时，粒子重组为该角色的剪影（缺省回落 shape）。 */
  portraitId?: string
}>(), {
  caption: '',
  density: 'hero',
  interactive: true,
  bare: false,
  decorative: false,
  signal: 'idle',
  portraitId: '',
})

interface RuntimeParticle {
  x: number
  y: number
  velocityX: number
  velocityY: number
  targetX: number
  targetY: number
  tone: 0 | 1 | 2
  paint: number
  phase: number
  depth: number
  size: number
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

/** 角色形象点云：null = 用抽象形状。异步加载由 token 防竞态。 */
let portraitCloud: PortraitCloud | null = null
/** 剪影调色板（深色已提亮），与 portraitCloud 同步更新。 */
let portraitPaints: string[] = []
/** 半调点阵：每个调色板色的网点半径（剪影模式统一点径，见 setShape）。 */
let portraitRadii: number[] = []
let portraitToken = 0

/** 主题可读性：人物原色可能过暗（黑裙/深发在深色主题不可见），提亮到最低亮度。 */
function legibleColor(hex: string): string {
  const value = hex.trim()
  const match = /^#?([0-9a-f]{6})$/i.exec(value)
  if (!match) return value
  const full = match[1]
  let r = parseInt(full.slice(0, 2), 16) / 255
  let g = parseInt(full.slice(2, 4), 16) / 255
  let b = parseInt(full.slice(4, 6), 16) / 255
  const MIN = 0.34
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  if (lum < MIN) {
    const lift = (MIN - lum) / Math.max(1e-6, 1 - lum)
    r += (1 - r) * lift
    g += (1 - g) * lift
    b += (1 - b) * lift
  }
  const to255 = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255)
  return `#${[to255(r), to255(g), to255(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

let context: CanvasRenderingContext2D | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let themeObserver: MutationObserver | null = null
let motionMedia: MediaQueryList | null = null
let stopScheduledFrame: (() => void) | null = null
let paletteFrame = 0
let width = 0
let height = 0
let dpr = 1
let particles: RuntimeParticle[] = []
let palette: Palette = { primary: '#d9d5df', secondary: '#77717f', accent: '#f4a6d7' }
let visible = true
let pointerX = -10000
let pointerY = -10000
let pointerActive = false
let pointerReleasedAt = -Infinity
let pulseX = -10000
let pulseY = -10000
let pulseStartedAt = -Infinity
let lastFrame = 0
let lastPhysicsFrame = 0
let slowFrames = 0
let qualityScale = 1

function preferredCount(): number {
  if (reduceMotion.value) return 420
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const compact = window.matchMedia('(max-width: 760px)').matches
  let count: number
  if (props.density === 'backdrop') count = compact ? 220 : 380
  else if (compact || (memory !== undefined && memory <= 4)) count = 520
  else count = props.density === 'ambient' ? 780 : 1380
  // 角色剪影点阵密度：对标 Arknights-FlowingPoints 的 ~4px 点距（点径 3px +
  // 1px 缝）——ambient 3200 / hero 4200 在常见 hero 尺寸下点距约 3.8-4.5px，
  // 配合统一点径 0.75×点距呈现规整硬朗的点阵成像。物理与绘制均为 O(n)，
  // 慢帧自愈降档继续兜底。
  if (portraitCloud) {
    count = Math.max(count, compact ? 1600 : props.density === 'hero' ? 4200 : 3200)
  }
  return Math.round(count * qualityScale)
}

function readPalette() {
  if (!host.value) return
  const style = getComputedStyle(host.value)
  palette = {
    primary: style.getPropertyValue('--text-primary').trim() || '#d9d5df',
    secondary: style.getPropertyValue('--text-muted').trim() || '#77717f',
    accent: style.getPropertyValue('--archive-blue').trim() || style.getPropertyValue('--accent-violet').trim() || '#f4a6d7',
  }
  draw()
}

/**
 * 主题切换时所有粒子场会同时触发 MutationObserver。
 * 直接同步 readPalette 会在切换瞬间做 N 次 getComputedStyle（强制 reflow），
 * 这正是深色/浅色切换卡顿的来源之一：合并到下一帧批量执行一次。
 */
function schedulePaletteRead() {
  if (paletteFrame) return
  paletteFrame = requestAnimationFrame(() => {
    paletteFrame = 0
    readPalette()
  })
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
  const count = Math.max(props.density === 'backdrop' ? 80 : 120, preferredCount())
  let shape: ParticlePoint[]
  if (portraitCloud) {
    const sample = samplePortraitPoints(portraitCloud, count, width, height)
    shape = sample.points
    // 统一点径 = 0.62×点距（对标参考实现 3px 点/5px 距的 0.6 缝隙比，略放大
    // 适配更小的场域）：点径恒定才有规整点阵质感；明暗层次全部交给调色板颜色。
    portraitRadii = portraitPaints.map(() => sample.spacing * 0.62)
  } else {
    shape = createParticleShape(props.shape, count)
  }
  if (!shape.length) return
  const previous = particles.slice().sort((a, b) => {
    const rowA = Math.round(a.y / Math.max(1, height) * 18)
    const rowB = Math.round(b.y / Math.max(1, height) * 18)
    return rowA === rowB ? a.x - b.x : rowA - rowB
  })

  particles = shape.map((point, index) => {
    const target = targetPosition(point)
    const current = previous[index]
    const x = current?.x ?? (animate ? Math.random() * width : target.x)
    const y = current?.y ?? (animate ? Math.random() * height : target.y)
    return {
      x,
      y,
      velocityX: current?.velocityX ?? 0,
      velocityY: current?.velocityY ?? 0,
      targetX: target.x,
      targetY: target.y,
      tone: point.tone,
      paint: point.paint ?? point.tone,
      phase: current?.phase ?? Math.random() * Math.PI * 2,
      depth: current?.depth ?? 0.55 + Math.random() * 0.45,
      // 剪影模式收窄粒子尺寸抖动：点阵更均匀，成像更"实"
      size: current?.size ?? (portraitCloud ? 0.94 + Math.random() * 0.12 : 0.88 + Math.random() * 0.24),
    }
  })

  if (!animate || reduceMotion.value) {
    particles.forEach((particle) => {
      particle.x = particle.targetX
      particle.y = particle.targetY
      particle.velocityX = 0
      particle.velocityY = 0
    })
    draw()
  } else {
    startLoop()
  }
}

function simulateParticles(now: number): boolean {
  const elapsed = lastPhysicsFrame ? Math.min(32, Math.max(1, now - lastPhysicsFrame)) : 16.67
  const step = elapsed / 16.67
  const recoveryReady = !pointerActive && now - pointerReleasedAt > 220
  // 剪影模式物理对标 Arknights-FlowingPoints：恒定慢回位弹簧（流动感）+
  // 固定 105px 斥力半径 + 平方衰减力 1.8 + 摩擦 0.15/帧；点击脉冲不参与。
  const portrait = portraitCloud !== null
  const pulseAge = now - pulseStartedAt
  const pulseActive = !portrait && pulseAge >= 0 && pulseAge < 520
  const interactionRadius = portrait ? 105 : Math.min(150, Math.max(90, width * 0.22))
  const interactionRadiusSquared = interactionRadius * interactionRadius
  const repulsionForce = portrait ? 1.8 : 2.35
  let moving = pointerActive || pulseActive || !recoveryReady

  for (const particle of particles) {
    const spring = portrait
      ? 0.01
      : pointerActive ? 0.024 : recoveryReady ? 0.054 : 0
    particle.velocityX += (particle.targetX - particle.x) * spring * step
    particle.velocityY += (particle.targetY - particle.y) * spring * step

    if (props.interactive && pointerActive) {
      const dx = particle.x - pointerX
      const dy = particle.y - pointerY
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared < interactionRadiusSquared) {
        const distance = Math.sqrt(distanceSquared)
        const directionX = distance > 0.1 ? dx / distance : Math.cos(particle.phase)
        const directionY = distance > 0.1 ? dy / distance : Math.sin(particle.phase)
        const force = (1 - distance / interactionRadius) ** 2 * repulsionForce
        particle.velocityX += directionX * force * step
        particle.velocityY += directionY * force * step
      }
    }

    if (pulseActive) {
      const dx = particle.x - pulseX
      const dy = particle.y - pulseY
      const ringRadius = Math.min(30, interactionRadius * 0.24) + pulseAge * 0.24
      const ringBand = 48
      const distanceSquared = dx * dx + dy * dy
      const innerRadius = Math.max(0, ringRadius - ringBand)
      const outerRadius = ringRadius + ringBand
      if (distanceSquared >= innerRadius * innerRadius && distanceSquared <= outerRadius * outerRadius) {
        const distance = Math.sqrt(distanceSquared)
        const ringWeight = Math.exp(-(((distance - ringRadius) / 16) ** 2)) * (1 - pulseAge / 620)
        const directionX = distance > 0.1 ? dx / distance : Math.cos(particle.phase)
        const directionY = distance > 0.1 ? dy / distance : Math.sin(particle.phase)
        if (ringWeight > 0.01) {
          particle.velocityX += directionX * ringWeight * 2.4 * step
          particle.velocityY += directionY * ringWeight * 2.4 * step
        }
      }
    }

    const damping = Math.pow(portrait ? 0.85 : (pointerActive ? 0.84 : 0.86), step)
    particle.velocityX *= damping
    particle.velocityY *= damping
    particle.x += particle.velocityX * step
    particle.y += particle.velocityY * step

    if (Math.abs(particle.velocityX) > 0.012 || Math.abs(particle.velocityY) > 0.012
      || Math.abs(particle.targetX - particle.x) > 0.12 || Math.abs(particle.targetY - particle.y) > 0.12) {
      moving = true
    }
  }

  lastPhysicsFrame = now
  return moving
}

function draw(now = performance.now()) {
  if (!context || !canvas.value) return
  const ctx = context
  ctx.clearRect(0, 0, width, height)
  // 剪影模式按人物调色板分批填充；抽象形状沿用三档 tone
  const paints = portraitCloud && portraitPaints.length ? portraitPaints : null
  const paths = paints
    ? paints.map(() => new Path2D())
    : [new Path2D(), new Path2D(), new Path2D()]
  const signalEnergy = props.signal === 'active' ? 1.35 : props.signal === 'warning' ? 1.15 : props.signal === 'success' ? 1.08 : 1
  // 剪影模式完全静止成像（参考实现无待机漂移，漂移会把点阵糊掉）；
  // 抽象形状保持原漂移幅度。
  const driftAmount = reduceMotion.value ? 0
    : paints ? 0
      : (props.density === 'backdrop' ? 0.8 : props.density === 'ambient' ? 1.7 : 2.8) * signalEnergy
  const pulseAge = now - pulseStartedAt
  const pulseActive = !paints && pulseAge >= 0 && pulseAge < 520
  const highlights = pointerActive || pulseActive ? new Path2D() : null
  const interactionRadius = Math.min(150, Math.max(90, width * 0.22))
  const interactionRadiusSquared = interactionRadius * interactionRadius

  for (const particle of particles) {
    const driftPhase = now * 0.00034 + particle.phase
    const driftX = Math.sin(driftPhase) * driftAmount * (0.62 + particle.depth * 0.38)
    const driftY = Math.cos(driftPhase * 0.86 + particle.phase * 0.17) * driftAmount * 0.72 * (0.62 + particle.depth * 0.38)
    const x = particle.x + driftX
    const y = particle.y + driftY
    const energyScale = (props.signal === 'active' ? 1.16 : props.signal === 'warning' ? 1.08 : 1) * particle.size
    const pathIndex = paints
      ? Math.min(paths.length - 1, Math.max(0, particle.paint))
      : particle.tone
    const path = paths[pathIndex]
    // 半调网点：半径随调色板明暗调制（暗部大网点补实、亮部小网点透气）
    const baseRadius = paints
      ? (portraitRadii[pathIndex] || 1.02)
      : particle.tone === 2 ? 1.55 : particle.tone === 1 ? 1.05 : 0.78
    const radius = baseRadius * energyScale
    path.moveTo(x + radius, y)
    path.arc(x, y, radius, 0, Math.PI * 2)

    let focus = 0
    if (pointerActive && props.interactive) {
      const dx = x - pointerX
      const dy = y - pointerY
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared < interactionRadiusSquared) {
        const distanceRatio = 1 - distanceSquared / interactionRadiusSquared
        focus = distanceRatio * distanceRatio
      }
    }
    let pulse = 0
    if (pulseActive) {
      const ringRadius = Math.min(30, interactionRadius * 0.24) + pulseAge * 0.24
      const ringBand = 48
      const dx = x - pulseX
      const dy = y - pulseY
      const distanceSquared = dx * dx + dy * dy
      const innerRadius = Math.max(0, ringRadius - ringBand)
      const outerRadius = ringRadius + ringBand
      if (distanceSquared >= innerRadius * innerRadius && distanceSquared <= outerRadius * outerRadius) {
        const distance = Math.sqrt(distanceSquared)
        pulse = Math.exp(-(((distance - ringRadius) / 16) ** 2)) * Math.max(0, 1 - pulseAge / 620)
      }
    }
    const shimmer = Math.max(focus * 0.42, pulse)
    if (highlights && shimmer > 0.16 && (particle.tone > 0 || particle.phase % 1.7 < 0.25)) {
      const highlightRadius = radius * (1 + shimmer * 0.38)
      highlights.moveTo(x + highlightRadius, y)
      highlights.arc(x, y, highlightRadius, 0, Math.PI * 2)
    }
  }
  if (paints) {
    ctx.globalAlpha = .88
    paints.forEach((color, index) => {
      ctx.fillStyle = color
      ctx.fill(paths[index])
    })
  } else {
    ctx.globalAlpha = .72
    ctx.fillStyle = palette.primary
    ctx.fill(paths[0])
    ctx.globalAlpha = .46
    ctx.fillStyle = palette.secondary
    ctx.fill(paths[1])
    ctx.globalAlpha = .9
    ctx.fillStyle = palette.accent
    ctx.fill(paths[2])
  }
  if (highlights) {
    ctx.globalAlpha = .34
    ctx.fillStyle = palette.accent
    ctx.fill(highlights)
  }
  ctx.globalAlpha = 1
}

function renderFrame(now: number) {
  if (!visible || document.hidden || reduceMotion.value) return
  if (lastFrame) {
    const elapsed = now - lastFrame
    slowFrames = elapsed > 28 ? slowFrames + 1 : Math.max(0, slowFrames - 2)
    if (slowFrames >= 20 && qualityScale > 0.48) {
      qualityScale *= 0.7
      slowFrames = 0
      setShape(false)
    }
  }
  lastFrame = now
  const moving = simulateParticles(now)
  draw(now)
  if (!moving && props.density === 'backdrop') stopLoop()
}

function startLoop() {
  if (stopScheduledFrame || !visible || document.hidden || reduceMotion.value) return
  lastFrame = 0
  lastPhysicsFrame = 0
  // 2026-08-15（用户决策：性能充裕，放开帧率）：不再按密度节流（60/45/30fps），
  // 走 registerParticleFrame 的 fps<=0 原生模式——每个 rAF 都渲染，跑满显示器刷新率。
  // 物理模拟按 elapsed 时间步进（上限 32ms），高刷下不会变速；slowFrames 自愈仍保护低端机。
  stopScheduledFrame = registerParticleFrame(renderFrame, 0)
}

function stopLoop() {
  stopScheduledFrame?.()
  stopScheduledFrame = null
  lastFrame = 0
  lastPhysicsFrame = 0
}

function resize() {
  if (!host.value || !canvas.value) return
  const rect = host.value.getBoundingClientRect()
  width = Math.max(1, Math.round(rect.width))
  height = Math.max(1, Math.round(rect.height))
  // 剪影模式按 HiDPI 全分辨率渲染：小网点在高分屏上边缘锐利（模糊感来源之一
  // 就是 dpr 上限偏低把网点糊掉）；抽象形状维持原上限。
  const dprLimit = portraitCloud
    ? 2
    : props.density === 'hero' ? 1.5 : props.density === 'ambient' ? 1.35 : 1.2
  dpr = Math.min(window.devicePixelRatio || 1, dprLimit)
  canvas.value.width = Math.round(width * dpr)
  canvas.value.height = Math.round(height * dpr)
  canvas.value.style.width = `${width}px`
  canvas.value.style.height = `${height}px`
  try {
    // 2026-08-16 回退 desynchronized 实验：部分 GPU/WebView2 的 overlay 路径
    // 会让 desynchronized 画布整块渲染成纯黑（灵感场景/效果样张页实锤）；
    // 参考实现（Arknights-FlowingPoints）也用普通 2d 上下文。
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

function onPointerDown(event: PointerEvent) {
  if (!host.value || event.pointerType === 'touch' || reduceMotion.value) return
  const rect = host.value.getBoundingClientRect()
  pulseX = event.clientX - rect.left
  pulseY = event.clientY - rect.top
  pulseStartedAt = performance.now()
  startLoop()
}

function onPointerLeave() {
  pointerActive = false
  pointerReleasedAt = performance.now()
  startLoop()
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

watch(() => props.shape, () => { if (!portraitCloud) setShape(true) })
watch(() => props.portraitId, id => { void applyPortrait(id) })
watch(() => props.density, () => {
  stopLoop()
  resize()
  startLoop()
})
watch(() => props.signal, () => startLoop())

/** 角色剪影点云异步接管：加载完成前维持现有形状，完成后平滑形变成人物轮廓。 */
async function applyPortrait(id: string) {
  const token = ++portraitToken
  if (!id) {
    portraitCloud = null
    portraitPaints = []
    portraitRadii = []
    setShape(true)
    return
  }
  const cloud = await loadPortraitCloud(id)
  if (token !== portraitToken) return
  portraitCloud = cloud
  portraitPaints = cloud ? cloud.palette.map(legibleColor) : []
  // 网点半径在 setShape 里按「点距 × 明暗」自适应计算（依赖粒子数与场域尺寸）
  portraitRadii = portraitPaints.map(() => 1)
  setShape(true)
}

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
  themeObserver = new MutationObserver(schedulePaletteRead)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  document.addEventListener('visibilitychange', onVisibilityChange)
  readPalette()
  resize()
  startLoop()
  if (props.portraitId) void applyPortrait(props.portraitId)
})

onUnmounted(() => {
  stopLoop()
  if (paletteFrame) cancelAnimationFrame(paletteFrame)
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
.signal-active canvas { opacity:.92; }
.signal-warning canvas { opacity:.86; }
@media (max-width:760px) {
  .semantic-particle-field { min-height:240px; background-size:34px 34px,34px 34px,auto; }
  .particle-caption { right:var(--s-3); }
}
@media (prefers-reduced-motion:reduce) {
  .semantic-particle-field { background-image:radial-gradient(circle at 50% 48%,color-mix(in srgb,var(--particle-accent) 12%,transparent),transparent 55%); }
}
</style>
