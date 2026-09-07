<template>
  <header
    class="archive-page-hero"
    :class="{ 'is-compact': compact }"
  >
    <div v-if="!compact" class="archive-register" aria-hidden="true">
      <span>{{ section }}</span>
    </div>

    <div class="archive-copy">
      <slot />
      <div v-if="$slots.meta" class="archive-meta">
        <slot name="meta" />
      </div>
    </div>

    <SemanticParticleField
      v-if="!compact"
      class="archive-particles"
      :shape="shape"
      :portrait-id="portraitId"
      :label="label"
      :caption="caption || `FILE ${chapter} / ${folio}`"
      :density="compact ? 'ambient' : 'hero'"
    />

  </header>
</template>

<script setup lang="ts">
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

</script>

<style scoped>
.archive-page-hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .8fr); min-height: 300px; margin-bottom: var(--s-6); overflow: hidden; isolation: isolate; border-bottom: 1px solid var(--border-soft); }
.archive-register { position: absolute; top: var(--s-5); left: 0; color: var(--text-muted); font: 500 var(--fs-label-xs)/var(--lh-label) var(--font-sans); letter-spacing: .14em; text-transform: uppercase; }
.archive-copy { align-self: center; min-width: 0; padding: var(--s-8) var(--s-6) var(--s-6) 0; }
.archive-copy :deep(h1) { margin: var(--s-3) 0 var(--s-4); font: 500 clamp(2rem, 3.2vw, 3rem)/var(--lh-tight) var(--font-display); letter-spacing: -.04em; }
.archive-copy :deep(p) { max-width: 42em; color: var(--text-secondary); line-height: var(--lh-loose); }
.archive-meta { display: flex; flex-wrap: wrap; gap: var(--s-2); margin-top: var(--s-4); }
.archive-particles { min-width: 0; min-height: 300px; }
.archive-page-hero.is-compact { grid-template-columns: minmax(0, 1fr); min-height: 0; }
.is-compact .archive-copy { padding-top: var(--s-6); padding-bottom: var(--s-5); }
@media (max-width: 768px) { .archive-page-hero { grid-template-columns: minmax(0, 1fr); } .archive-copy { padding-right: 0; } .archive-particles { min-height: 200px; } }
</style>
