<template>
  <section v-if="routeRecovery" class="route-recovery" role="alert" aria-label="页面加载恢复">
    <ArchiveIcon name="warning" />
    <div><h2>这个页面暂时没能打开</h2><p>连接中断或更新后，页面文件可能需要重新读取。当前页面仍然保留。</p>
      <div class="route-recovery-actions"><a class="btn btn-primary" :href="routeRecovery.target">重新打开目标页面</a><button class="btn btn-ghost" type="button" @click="routeRecovery = null">继续当前页面</button><a class="btn btn-ghost" href="/">返回首页</a></div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { routeRecovery } from '@/composables/useRouteRecovery'
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
</script>
<style scoped>
.route-recovery { position: sticky; top: 0; z-index: var(--z-overlay); display: flex; gap: var(--s-3); margin: var(--s-4); padding: var(--s-4); border: 1px solid var(--border-strong); border-radius: var(--r-lg); background: var(--bg-surface); color: var(--text-primary); }
.route-recovery > .archive-icon { flex-shrink: 0; color: var(--warning-text); }
.route-recovery > div { min-width: 0; }
.route-recovery h2 { margin: 0; font-size: var(--fs-body); line-height: var(--lh-body); }
.route-recovery p { margin: var(--s-2) 0; color: var(--text-secondary); font-size: var(--fs-label); line-height: var(--lh-body); }
.route-recovery-actions { display: flex; flex-wrap: wrap; gap: var(--s-2); }
</style>
