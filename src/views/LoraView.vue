<template>
  <article class="page" style="--page-max:1100px">
    <WorkspaceArchiveBar
      chapter="10"
      title="MODEL SHELF"
      :subtitle="loading ? 'READING LOCAL CATALOG' : `${loras.length} CHARACTER PROFILES`"
      :status="loading ? 'SCANNING' : (loras.length ? 'CATALOG READY' : 'EMPTY CATALOG')"
      :state="loading ? 'active' : (loras.length ? 'success' : 'warning')"
      shape="frame"
    />
    <div class="page-kicker">Model shelf</div>
    <div class="lora-title-row">
      <div>
        <h1 class="title">模型</h1>
        <p class="subtitle">模型决定她的脸和气质能不能稳住。出图时自动带上，这里只是让你知道带的是什么。</p>
      </div>
      <RouterLink class="btn btn-primary" to="/training?kind=lora">打开训练台</RouterLink>
    </div>
    <ArchiveStatePanel
      v-if="loading"
      kind="loading"
      title="正在读取模型目录"
      message="正在核对本机 LoRA 档案与推荐权重。"
    />
    <ArchiveStatePanel
      v-else-if="!loras.length"
      kind="empty"
      title="模型目录还是空的"
      message="完成一次 LoRA 训练或导入模型后，资料会出现在这里。"
    >
      <RouterLink class="btn btn-primary" to="/training?kind=lora">前往训练台</RouterLink>
    </ArchiveStatePanel>
    <div v-else class="lora-grid">
      <div v-for="l in loras" :key="l.id" class="lora-card">
        <div class="lora-header">
          <span class="lora-name">{{ l.name }}</span>
          <span v-if="l.version" class="lora-version">v{{ l.version }}</span>
        </div>
        <div v-if="l.description" class="lora-desc">{{ l.description }}</div>
        <div class="lora-meta">
          <span v-if="l.recommendedWeight" class="lora-pill">推荐权重 {{ formatLoraWeight(l.recommendedWeight) }}</span>
          <span v-if="l.baseModel" class="lora-pill">{{ l.baseModel }}</span>
          <span v-if="l.character" class="lora-pill">{{ l.character }}</span>
        </div>
        <div v-if="l.triggerWords.length" class="lora-triggers">
          <span class="lora-label">触发词</span>
          <span v-for="tw in l.triggerWords" :key="tw" class="lora-tag">{{ tw }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSceneStore } from '@/stores/sceneStore'
import WorkspaceArchiveBar from '@/components/visual/WorkspaceArchiveBar.vue'
import ArchiveStatePanel from '@/components/visual/ArchiveStatePanel.vue'
import {
  formatLoraWeight,
  parseLoraCatalog,
  type LoraCatalogEntry,
} from '@/utils/loraCatalog'

const sceneStore = useSceneStore()
const loras = ref<LoraCatalogEntry[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    await sceneStore.load()
    loras.value = parseLoraCatalog(sceneStore.loras)
  } catch (e) { console.warn('lora load failed', e) }
  loading.value = false
})
</script>

<style scoped>
.lora-title-row {
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:var(--s-4);
  margin-bottom:var(--s-5);
}
.lora-title-row .title { margin-bottom:var(--s-2); }
.lora-title-row .subtitle { margin-bottom:0; }
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

@media (max-width:640px) {
  .lora-title-row { align-items:flex-start; flex-direction:column; }
}
</style>
