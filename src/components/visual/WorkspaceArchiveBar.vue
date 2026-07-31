<template>
  <section class="workspace-archive-bar" :data-state="state" :data-shape="shape" :aria-label="`${title}状态`">
    <div class="workspace-code" aria-hidden="true">
      <span>{{ chapter }}</span><small>/ 13</small>
    </div>
    <div class="workspace-copy">
      <strong>{{ title }}</strong>
      <span>{{ subtitle }}</span>
    </div>
    <div class="workspace-line" aria-hidden="true"><i :key="revision"></i></div>
    <div class="workspace-state" role="status" aria-live="polite">
      <span class="workspace-state-dot" aria-hidden="true"></span>
      {{ status }}
    </div>
    <div class="workspace-radar" aria-hidden="true"><i></i><i></i><i></i></div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
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
const revision = ref(0)

function signal() {
  revision.value += 1
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
.workspace-archive-bar {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(180px,auto) minmax(42px,1fr) auto 46px;
  align-items: center;
  gap: clamp(10px,1.6vw,22px);
  min-height: 58px;
  margin-bottom: var(--s-4);
  padding: 8px 12px 8px 9px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb,var(--border-soft) 84%,transparent);
  border-radius: var(--r-md);
  background: color-mix(in srgb,var(--bg-surface) 72%,transparent);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  backdrop-filter: blur(16px) saturate(120%);
}
.workspace-archive-bar::before {
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:2px;
  background:var(--archive-blue);
}
.workspace-code {
  display:flex;
  align-items:baseline;
  gap:3px;
  min-width:62px;
  color:var(--archive-blue);
  font:760 var(--fs-title-xs) var(--font-mono);
  letter-spacing:-.04em;
}
.workspace-code small { color:var(--text-secondary); font:650 var(--fs-mono-xs) var(--font-mono); letter-spacing:.06em; }
.workspace-copy { display:grid; min-width:0; gap:2px; }
.workspace-copy strong { color:var(--text-primary); font:750 var(--fs-mono-sm) var(--font-mono); letter-spacing:.11em; }
.workspace-copy span { overflow:hidden; color:var(--text-muted); font-size:var(--fs-label-xs); text-overflow:ellipsis; white-space:nowrap; }
.workspace-line { height:1px; overflow:hidden; background:var(--border-soft); }
.workspace-line i { display:block; width:34%; height:100%; background:linear-gradient(90deg,transparent,var(--archive-blue),transparent); animation:workspace-scan .82s var(--ease-out) both; }
.workspace-state { display:flex; align-items:center; gap:7px; color:var(--text-secondary); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.08em; white-space:nowrap; }
.workspace-state-dot { width:6px; height:6px; border-radius:50%; background:var(--text-muted); box-shadow:0 0 0 3px color-mix(in srgb,var(--text-muted) 12%,transparent); }
[data-state="active"] .workspace-state-dot { background:var(--archive-blue); animation:workspace-pulse 1.15s ease-in-out infinite; }
[data-state="success"] .workspace-state-dot { background:var(--success); }
[data-state="warning"] .workspace-state-dot { background:var(--warning); }
.workspace-radar { position:relative; width:36px; height:36px; }
.workspace-radar i { position:absolute; inset:50%; border:1px solid color-mix(in srgb,var(--archive-blue) 42%,transparent); border-radius:50%; transform:translate(-50%,-50%); }
.workspace-radar i:nth-child(1){width:8px;height:8px}.workspace-radar i:nth-child(2){width:20px;height:20px}.workspace-radar i:nth-child(3){width:34px;height:34px;border-style:dashed}
[data-state="active"] .workspace-radar i:nth-child(3){animation:workspace-rotate 3.2s linear infinite}
@keyframes workspace-scan { from{transform:translateX(-110%)} to{transform:translateX(310%)} }
@keyframes workspace-pulse { 50%{box-shadow:0 0 0 7px transparent} }
@keyframes workspace-rotate { to{transform:translate(-50%,-50%) rotate(360deg)} }
@media(max-width:720px){
  .workspace-archive-bar{grid-template-columns:auto minmax(0,1fr) auto;gap:10px}
  .workspace-line,.workspace-radar{display:none}
  .workspace-copy span{max-width:42vw}
}
@media(max-width:440px){
  .workspace-archive-bar{grid-template-columns:auto minmax(0,1fr);padding:9px}
  .workspace-state{grid-column:1/-1;padding-top:7px;border-top:1px solid var(--border-soft)}
}
@media(prefers-reduced-motion:reduce){.workspace-line i,.workspace-state-dot,.workspace-radar i{animation:none!important}}
</style>
