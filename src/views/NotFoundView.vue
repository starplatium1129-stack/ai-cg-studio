<template>
  <article class="page notfound-page">
    <img class="notfound-chibi" src="/assets/chibi/natsume-coffee.webp" alt="四季夏目 Q 版：页面迷路时也要从容地接一杯咖啡" width="480" height="288" loading="eager" decoding="async" />
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

.notfound-chibi {
  width: min(420px, 78vw);
  aspect-ratio: 5/3;
  object-fit: cover;
  border-radius: var(--r-2xl);
  border: 1px solid var(--border-soft);
  box-shadow: 0 18px 44px -18px color-mix(in srgb, var(--accent) 40%, transparent);
}

.notfound-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  justify-content: center;
  margin-top: var(--s-4);
}
</style>
