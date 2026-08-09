<template>
  <section class="empty-state archive-state-panel" :class="{ compact }" :data-kind="kind" :role="role">
    <div class="archive-state-mark" aria-hidden="true">
      <ArchiveIcon :name="iconName" />
      <i></i><i></i>
    </div>
    <div class="archive-state-code">{{ code || defaultCode }}</div>
    <h2>{{ title }}</h2>
    <p v-if="message">{{ message }}</p>
    <div v-if="$slots.default" class="archive-state-actions"><slot /></div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ArchiveIcon, { type ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'

const props = withDefaults(defineProps<{
  kind: 'loading' | 'empty' | 'filtered' | 'error' | 'success'
  title: string
  message?: string
  code?: string
  compact?: boolean
}>(), { message:'', code:'', compact:false })

const role = computed(() => props.kind === 'error' ? 'alert' : props.kind === 'loading' ? 'status' : undefined)

const iconName = computed<ArchiveIconName>(() => ({
  loading:'refresh', empty:'gallery', filtered:'search', error:'warning', success:'success',
})[props.kind] as ArchiveIconName)
const defaultCode = computed(() => ({
  loading:'READING LOCAL ARCHIVE', empty:'NO LOCAL RECORD', filtered:'NO FILTER MATCH', error:'ARCHIVE EXCEPTION', success:'ARCHIVE READY',
})[props.kind])
</script>

<style scoped>
.archive-state-panel { min-height:260px; display:grid; place-items:center; align-content:center; }
.archive-state-panel.compact { min-height:150px; margin:0; padding:var(--s-4); }
.archive-state-panel.compact .archive-state-mark { width:52px; height:52px; margin-bottom:var(--s-2); }
.archive-state-mark { position:relative; display:grid; place-items:center; width:68px; height:68px; margin:0 auto var(--s-3); color:var(--archive-blue); font-size:1.6rem; }
.archive-state-mark i { position:absolute; inset:0; border:1px solid color-mix(in srgb,var(--archive-blue) 38%,transparent); border-radius:50%; }
.archive-state-mark i:nth-of-type(2){inset:9px;border-style:dashed}
.archive-state-code { color:var(--text-muted); font:700 var(--fs-mono-xs) var(--font-mono); letter-spacing:.14em; }
.archive-state-actions { display:flex; justify-content:center; gap:var(--s-2); flex-wrap:wrap; margin-top:var(--s-3); }
[data-kind="loading"] .archive-state-mark i:first-of-type { animation:state-orbit 1.8s linear infinite; border-top-color:var(--archive-blue); }
[data-kind="loading"] :deep(.archive-icon) { animation:state-counter 1.8s linear infinite reverse; }
[data-kind="error"] .archive-state-mark { color:var(--danger-text); }
[data-kind="success"] .archive-state-mark { color:var(--success-text); }
@keyframes state-orbit{to{transform:rotate(360deg)}}
@keyframes state-counter{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.archive-state-mark i,.archive-state-mark :deep(.archive-icon){animation:none!important}}
</style>
