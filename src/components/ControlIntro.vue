<template>
  <header class="control-intro">
    <div>
      <p class="control-eyebrow">绫季绘境 / 本机控制室</p>
      <h1 class="control-title">把画室，准备好。</h1>
      <p class="control-subtitle">管理创作服务、安排显存，让每一次心动顺利成画。</p>
    </div>
    <div class="control-intro-actions"><span class="control-count" role="status">{{ readyLabel }}</span><div class="control-intro-buttons"><slot name="actions" /></div></div>
  </header>
</template>
<script setup lang="ts">
defineProps<{ readyLabel: string }>()
</script>
<style scoped>
.control-intro { display: flex; align-items: center; justify-content: space-between; gap: var(--s-5); margin-bottom: var(--s-6); }
.control-eyebrow { margin: 0 0 var(--s-3); color: var(--accent); font-size: var(--fs-label); letter-spacing: .08em; }
.control-title { margin: 0; color: var(--text-primary); font: 500 var(--fs-display)/var(--lh-tight) var(--font-serif); letter-spacing: -.02em; }
.control-subtitle { margin: var(--s-3) 0 0; color: var(--text-secondary); font-size: var(--fs-body-sm); line-height: var(--lh-loose); }
.control-intro-actions { display: flex; flex-direction: column; align-items: flex-end; gap: var(--s-3); flex-shrink: 0; }
.control-count { color: var(--text-muted); font-size: var(--fs-label); }
.control-intro-buttons { display: flex; gap: var(--s-2); flex-wrap: wrap; }
@media (max-width: 1200px) { .control-intro { align-items: flex-start; flex-direction: column; } .control-intro-actions { align-items: flex-start; } }
</style>
