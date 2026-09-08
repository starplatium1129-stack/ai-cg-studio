<template>
  <header class="control-intro">
    <div>
      <h1 class="control-title">控制面板</h1>
      <p class="control-subtitle">绘图引擎、语音合成与智能对话等核心服务全流程本机运行。随时查阅运行状态与本地连接。</p>
    </div>
    <div class="control-count">{{ readyLabel }}</div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ readyLabel: string }>()
</script>

<style scoped>
.control-intro {
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end;
  gap: var(--s-5); margin-bottom: clamp(22px, 3vw, 32px); padding: clamp(20px, 3vw, 30px);
  border: 1px solid color-mix(in srgb, var(--archive-cyan) 18%, var(--border-soft)); border-radius: var(--r-dossier);
  background: color-mix(in srgb, var(--bg-surface) 76%, transparent); box-shadow: var(--shadow-sm);
}
.control-intro::before { content: ''; position: absolute; top: -1px; left: var(--s-4); width: 42px; height: var(--line-hairline); background: var(--archive-cyan); }
.control-title {
  margin: 0; color: var(--text-primary); font-family: var(--font-display);
  font-size: clamp(1.35rem, 2vw, 1.55rem); font-weight: 750; letter-spacing: -.02em; line-height: var(--lh-tight);
}
.control-subtitle {
  max-width: 640px; margin: var(--s-3) 0 0; color: var(--text-secondary);
  font-size: var(--fs-body); line-height: var(--lh-loose);
}
.control-count {
  padding: 9px 12px; border: 1px solid var(--border-soft); border-radius: var(--r-terminal);
  color: var(--text-muted); background: var(--bg-deep); font: 650 var(--fs-label-xs) var(--font-mono);
  letter-spacing: .08em; white-space: nowrap;
}
</style>
