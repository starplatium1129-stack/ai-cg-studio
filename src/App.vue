<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :name="route.meta.transition as string || 'page'" mode="out-in">
      <component :is="Component" :key="route.path" />
    </Transition>
  </RouterView>
  <AppToast />
</template>

<script setup lang="ts">
import AppToast from '@/components/AppToast.vue'
</script>

<style>
/* ── 页面路由过渡 ─────────────────────────────────────────────────────── */
.page-enter-active,
.page-leave-active {
  transition: opacity .18s ease, transform .18s var(--ease-out);
}
.page-enter-from { opacity: 0; transform: translateY(10px); }
.page-leave-to   { opacity: 0; transform: translateY(-6px); }

/* 控制面板用 fade-only（不做位移，避免全屏闪）*/
.fade-enter-active,
.fade-leave-active { transition: opacity .18s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }
</style>
