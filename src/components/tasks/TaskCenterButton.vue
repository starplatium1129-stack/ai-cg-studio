<template><button class="task-center-button" type="button" aria-haspopup="dialog" @click="opened = true"><ArchiveIcon name="queue" /><span>任务</span><strong v-if="activeCount">{{ activeCount }}</strong></button></template>
<script setup lang="ts">
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { useTaskCenter } from '@/composables/useTaskCenter'
const { opened, activeCount } = useTaskCenter()
</script>
<style scoped>
.task-center-button { display: inline-flex; align-items: center; justify-content: center; gap: var(--s-2); min-height: 38px; padding: var(--s-2) var(--s-3); border: 1px solid var(--border-soft); border-radius: var(--r-md); color: var(--text-primary); background: var(--bg-surface); font: 600 var(--fs-label) var(--font-sans); cursor: pointer; }
.task-center-button strong { color: var(--accent); font-variant-numeric: tabular-nums; }
</style>
