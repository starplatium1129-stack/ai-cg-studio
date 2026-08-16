<template>
  <header
    ref="hero"
    class="archive-page-hero"
    :class="{ 'is-ready': ready, 'is-compact': compact }"
  >
    <div class="archive-register" aria-hidden="true">
      <span>{{ section }}</span>
      <strong>{{ chapter }}</strong>
      <span>{{ folio }}</span>
    </div>

    <div class="archive-copy">
      <slot />
      <div v-if="$slots.meta" class="archive-meta">
        <slot name="meta" />
      </div>
    </div>

    <SemanticParticleField
      class="archive-particles"
      :shape="shape"
      :portrait-id="portraitId"
      :label="label"
      :caption="caption || `FILE ${chapter} / ${folio}`"
      :density="compact ? 'ambient' : 'hero'"
    />

    <div class="archive-coordinate" aria-hidden="true">
      <span>35.6812 N</span>
      <i></i>
      <span>139.7671 E</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import SemanticParticleField from '@/components/visual/SemanticParticleField.vue'
import type { ParticleShapeId } from '@/utils/particleShapes'

withDefaults(defineProps<{
  chapter: string
  section: string
  shape: ParticleShapeId
  label: string
  folio?: string
  caption?: string
  compact?: boolean
  /** 角色形象粒子：有预生成点云时粒子重组为该角色剪影。 */
  portraitId?: string
}>(), {
  folio: '08',
  caption: '',
  compact: false,
  portraitId: '',
})

const hero = ref<HTMLElement | null>(null)
const ready = ref(false)
let frameId = 0

onMounted(() => {
  frameId = requestAnimationFrame(() => { ready.value = true })
})

onUnmounted(() => {
  if (frameId) cancelAnimationFrame(frameId)
})
</script>

<style scoped>
.archive-page-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, .92fr) minmax(360px, 1.08fr);
  min-height: 330px;
  margin: 0 0 clamp(28px, 4vw, 52px);
  overflow: hidden;
  isolation: isolate;
  border: 1px solid color-mix(in srgb, var(--border-soft) 88%, transparent);
  border-radius: var(--r-xl);
  background:
    linear-gradient(112deg, color-mix(in srgb, var(--bg-surface) 96%, transparent) 0 48%, transparent 69%),
    var(--bg-deep);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent), var(--shadow-sm);
}
.archive-page-hero::before {
  content: "";
  position: absolute;
  z-index: var(--z-raised);
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(var(--archive-blue), color-mix(in srgb, var(--accent) 75%, transparent), transparent 88%);
  transform: scaleY(0);
  transform-origin: top;
  transition: transform .7s var(--ease-out) .1s;
}
.archive-page-hero.is-ready::before { transform: scaleY(1); }
.archive-page-hero::after {
  content:"";
  position:absolute;
  z-index:var(--z-raised);
  top:56px;
  left:22px;
  right:22px;
  height:1px;
  background:linear-gradient(90deg,var(--archive-blue),color-mix(in srgb,var(--border-strong) 72%,transparent),transparent 82%);
  opacity:0;
  transform:scaleX(.08);
  transform-origin:left;
  transition:opacity .22s ease .22s,transform .72s var(--ease-out) .22s;
  pointer-events:none;
}
.archive-page-hero.is-ready::after { opacity:.72; transform:scaleX(1); }
.archive-register {
  position: absolute;
  z-index: var(--z-raised);
  top: 18px;
  left: 22px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--text-muted);
  font: 700 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: .12em;
  text-transform: uppercase;
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity .42s ease .16s, transform .42s var(--ease-out) .16s;
}
.archive-register strong {
  color: var(--archive-blue);
  font-size: clamp(1.15rem, 2vw, 1.75rem);
  letter-spacing: -.04em;
}
.archive-page-hero.is-ready .archive-register { opacity: 1; transform: none; }
.archive-copy {
  position: relative;
  z-index: var(--z-raised);
  align-self: end;
  min-width: 0;
  padding: 74px clamp(24px, 4vw, 54px) 42px;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity .58s ease .08s, transform .58s var(--ease-out) .08s;
}
.archive-page-hero.is-ready .archive-copy { opacity: 1; transform: none; }
.archive-copy :deep(.page-kicker),
.archive-copy :deep(.gallery-kicker) {
  opacity:0;
  transform:translateX(-12px);
  transition:opacity .36s ease .18s,transform .44s var(--ease-out) .18s;
}
.archive-copy :deep(.title),
.archive-copy :deep(.gallery-title),
.archive-copy :deep(h1) {
  max-width: 760px;
  margin-top: 0;
  font-size: clamp(2.15rem, 4vw, 4rem);
  font-weight: 780;
  letter-spacing: -.055em;
  line-height: .98;
  opacity:0;
  transform:translateY(22px);
  transition:opacity .44s ease .22s,transform .58s var(--ease-out) .22s;
}
.archive-copy :deep(.subtitle),
.archive-copy :deep(.gallery-subtitle),
.archive-copy :deep(p) {
  max-width: 660px;
  color: var(--text-secondary);
  line-height: 1.75;
  opacity:0;
  transform:translateY(10px);
  transition:opacity .42s ease .34s,transform .5s var(--ease-out) .34s;
}
.archive-page-hero.is-ready .archive-copy :deep(.page-kicker),
.archive-page-hero.is-ready .archive-copy :deep(.gallery-kicker),
.archive-page-hero.is-ready .archive-copy :deep(h1),
.archive-page-hero.is-ready .archive-copy :deep(.title),
.archive-page-hero.is-ready .archive-copy :deep(.gallery-title),
.archive-page-hero.is-ready .archive-copy :deep(p),
.archive-page-hero.is-ready .archive-copy :deep(.subtitle),
.archive-page-hero.is-ready .archive-copy :deep(.gallery-subtitle) { opacity:1; transform:none; }
.archive-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin-top: var(--s-4);
}
.archive-particles {
  min-width: 0;
  min-height: 330px;
  border-left: 1px solid color-mix(in srgb, var(--border-soft) 72%, transparent);
  opacity: 0;
  transform: translateX(18px);
  clip-path:inset(0 0 0 28%);
  transition:opacity .54s ease .2s,transform .62s var(--ease-out) .2s,clip-path .72s var(--ease-out) .18s;
}
.archive-page-hero.is-ready .archive-particles { opacity: 1; transform: none; clip-path:inset(0); }
.archive-coordinate {
  position: absolute;
  z-index: var(--z-raised);
  right: 20px;
  top: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font: 650 var(--fs-mono-xs) var(--font-mono);
  letter-spacing: .08em;
  opacity:0;
  transform:translateY(-6px);
  transition:opacity .36s ease .42s,transform .36s var(--ease-out) .42s;
}
.archive-page-hero.is-ready .archive-coordinate { opacity:1; transform:none; }
.archive-coordinate i { width: 22px; height: 1px; background: var(--border-strong); }
.is-compact { min-height: 280px; }
.is-compact .archive-particles { min-height: 280px; }

@media (max-width: 820px) {
  .archive-page-hero { grid-template-columns: 1fr; min-height: 0; }
  .archive-copy { min-height: 260px; padding: 72px var(--s-5) 34px; }
  .archive-particles { min-height: 250px; border-left: 0; border-top: 1px solid var(--border-soft); }
  .archive-page-hero.is-compact .archive-copy { min-height: 214px; padding-top: 66px; padding-bottom: 28px; }
  .archive-page-hero.is-compact .archive-particles { min-height: 150px; }
  .archive-coordinate { display: none; }
}
@media (max-width: 520px) {
  .archive-page-hero { border-radius: var(--r-lg); }
  .archive-copy { min-height: 230px; padding: 66px var(--s-4) 28px; }
  .archive-page-hero.is-compact .archive-copy { min-height: 194px; padding: 62px var(--s-4) 24px; }
  .archive-page-hero.is-compact .archive-particles { min-height: 128px; }
  .archive-register { left: var(--s-4); }
  .archive-copy :deep(.title),
  .archive-copy :deep(.gallery-title),
  .archive-copy :deep(h1) { font-size: clamp(2rem, 13vw, 3.55rem); }
}
@media (prefers-reduced-motion: reduce) {
  .archive-page-hero::before,
  .archive-page-hero::after,
  .archive-register,
  .archive-copy,
  .archive-particles,
  .archive-coordinate,
  .archive-copy :deep(*) { transition:none; opacity:1; transform:none; clip-path:none; }
}
@media (prefers-contrast: more) {
  .archive-page-hero { border-color: var(--border-strong); }
}
</style>
