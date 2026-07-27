<template>
  <article class="page" style="--page-max:1100px">
    <div class="page-kicker">Model shelf</div>
    <h1 class="title">模型</h1>
    <p class="subtitle">模型决定她的脸和气质能不能稳住。出图时自动带上，这里只是让你知道带的是什么。</p>
    <div v-if="loading" class="empty-state"><div class="empty-state-icon">⏳</div><p>正在加载模型数据…</p></div>
    <div v-else-if="!loras.length" class="empty-state"><div class="empty-state-icon">🧪</div><p>暂无模型数据。</p></div>
    <div v-else class="lora-grid">
      <div v-for="l in loras" :key="l.id" class="lora-card">
        <div class="lora-header">
          <span class="lora-name">{{ l.name }}</span>
          <span v-if="l.version" class="lora-version">v{{ l.version }}</span>
        </div>
        <div v-if="l.description" class="lora-desc">{{ l.description }}</div>
        <div class="lora-meta">
          <span v-if="l.recommended_weight" class="lora-pill">推荐权重 {{ rw(l) }}</span>
          <span v-if="l.training?.base_model" class="lora-pill">{{ l.training.base_model }}</span>
          <span v-if="l.dataset?.character" class="lora-pill">{{ l.dataset.character }}</span>
        </div>
        <div v-if="l.trigger_words?.length" class="lora-triggers">
          <span class="lora-label">触发词</span>
          <span v-for="tw in l.trigger_words" :key="tw" class="lora-tag">{{ tw }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const loras = ref<any[]>([])
const loading = ref(true)

function rw(l: any) {
  const w = l.recommended_weight || {}
  if (typeof w === 'number') return w
  return Object.entries(w).map(([k,v]) => `${k}: ${Math.round(Number(v)*100)}%`).join(' / ')
}

onMounted(async () => {
  try {
    const r = await fetch('/data/loras.json?v=6')
    loras.value = await r.json()
  } catch {}
  loading.value = false
})
</script>

<style scoped>
.lora-grid { display:grid; gap:var(--s-4); grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); }
.lora-card { padding:var(--s-5); border:1px solid var(--border-soft); border-radius:var(--r-lg); background:var(--bg-surface); }
.lora-header { display:flex; align-items:baseline; gap:var(--s-2); margin-bottom:var(--s-2); }
.lora-name { font-size:var(--fs-title-xs); font-weight:800; }
.lora-version { color:var(--text-muted); font-size:var(--fs-mono-sm); }
.lora-desc { color:var(--text-secondary); font-size:var(--fs-body-sm); line-height:1.65; margin-bottom:var(--s-3); }
.lora-meta { display:flex; flex-wrap:wrap; gap:var(--s-1); margin-bottom:var(--s-2); }
.lora-pill { padding:2px var(--s-2); border:1px solid var(--border-soft); border-radius:var(--r-pill); color:var(--text-muted); font-size:var(--fs-mono-xs); }
.lora-triggers { display:flex; flex-wrap:wrap; gap:var(--s-1); align-items:center; }
.lora-label { font-size:var(--fs-label-xs); color:var(--text-muted); font-weight:700; letter-spacing:.06em; }
.lora-tag { padding:2px var(--s-2); background:var(--accent-soft); color:var(--accent); border-radius:var(--r-pill); font-size:var(--fs-mono-xs); }
</style>
