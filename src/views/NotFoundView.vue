<template>
  <article class="page notfound-page">
    <h1 class="title">页面走丢了</h1>
    <p class="subtitle">地址 <code class="notfound-path">{{ path }}</code> 不存在。</p>

    <div class="notfound-actions">
      <RouterLink class="btn btn-primary" to="/">回到首页</RouterLink>
      <RouterLink class="btn btn-ghost" to="/scene-explorer">去场景库</RouterLink>
      <RouterLink class="btn btn-ghost" to="/prompt-builder">去导演台</RouterLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const path = computed(() => route.fullPath)
</script>

<style scoped>
.notfound-page {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--s-3);
}

.notfound-path {
  color: var(--text-secondary);
  word-break: break-all;
}

.notfound-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  justify-content: center;
  margin-top: var(--s-4);
}
</style>
