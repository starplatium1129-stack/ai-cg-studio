<template>
  <section class="workspace-archive-bar" :data-state="state" :data-shape="shape" :aria-label="`${title}状态`">
    <div class="workspace-code" aria-hidden="true">
      <span>{{ chapter }}</span>
    </div>
    <div class="workspace-copy">
      <strong>{{ title }}</strong>
      <span>{{ subtitle }}</span>
    </div>
    <div class="workspace-state" role="status" aria-live="polite">
      <span class="workspace-state-dot" aria-hidden="true"></span>
      {{ status }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import type { ParticleShapeId } from '@/utils/particleShapes'
import { emitParticleSignal, type ParticleSignalState } from '@/utils/particleSignal'

const props = withDefaults(defineProps<{
  chapter: string
  title: string
  subtitle: string
  status: string
  state?: ParticleSignalState
  shape?: ParticleShapeId
}>(), {
  state: 'idle',
  shape: 'atelier',
})

function signal() {
  emitParticleSignal({
    state: props.state,
    shape: props.shape,
    label: props.status,
    duration: props.state === 'active' ? 1800 : 1050,
  })
}

onMounted(signal)
watch(() => [props.state, props.shape, props.status], signal)
</script>

<style scoped>
.workspace-archive-bar { display: flex; align-items: center; gap: var(--s-4); min-height: 44px; margin-bottom: var(--s-5); padding: var(--s-3) 0; border-bottom: 1px solid var(--border-soft); }
.workspace-code { flex: 0 0 auto; color: var(--character-accent); font: 500 var(--fs-label)/var(--lh-label) var(--font-mono); }
.workspace-copy { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--s-3); flex: 1; min-width: 0; }
.workspace-copy strong { color: var(--text-secondary); font: 500 var(--fs-label-xs)/var(--lh-label) var(--font-sans); letter-spacing: .1em; }
.workspace-copy > span { color: var(--text-muted); font-size: var(--fs-label-xs); overflow-wrap: anywhere; }
.workspace-state { display: flex; align-items: center; gap: var(--s-2); color: var(--text-secondary); font: 500 var(--fs-label-xs)/var(--lh-label) var(--font-sans); }
.workspace-state-dot { width: 5px; height: 5px; flex-shrink: 0; border-radius: 50%; background: var(--text-muted); }
[data-state="active"] .workspace-state-dot { background: var(--character-accent); }
[data-state="success"] .workspace-state-dot { background: var(--success); }
[data-state="warning"] .workspace-state-dot { background: var(--warning); }
@media(max-width: 480px) { .workspace-archive-bar { flex-wrap: wrap; gap: var(--s-2); } .workspace-state { margin-left: auto; } }
</style>
