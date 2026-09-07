<template><nav class="creative-library-nav" aria-label="创作资料导航"><RouterLink v-for="item in items" :key="item.path" :to="item.path" :aria-current="route.path === item.path ? 'page' : undefined">{{ item.label }}</RouterLink></nav></template>
<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
const items = [{ path: '/style', label: '画风与氛围' }, { path: '/color-script', label: '色彩情绪' }, { path: '/lora', label: '模型资料' }, { path: '/scenario', label: '剧本与分幕' }]
</script>
<style scoped>
.creative-library-nav { display: flex; flex-wrap: wrap; gap: var(--s-2); padding-bottom: var(--s-5); margin-bottom: var(--s-5); border-bottom: 1px solid var(--border-soft); }
.creative-library-nav a { padding: var(--s-2) var(--s-4); min-height: 40px; display: inline-flex; align-items: center; border-radius: var(--r-md); color: var(--text-secondary); font-size: var(--fs-body-sm); }
.creative-library-nav a[aria-current="page"] { background: var(--accent-soft); color: var(--accent); }
</style>
