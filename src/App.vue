<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :name="route.meta.transition as string || 'page'" mode="out-in">
      <component :is="Component" :key="route.path" />
    </Transition>
  </RouterView>
  <AppInteractionLayer />
  <AppToast />
</template>

<script setup lang="ts">
import AppInteractionLayer from '@/components/AppInteractionLayer.vue'
import AppToast from '@/components/AppToast.vue'
</script>

<style>
/* ── 页面路由过渡 ─────────────────────────────────────────────────────── */
.page-enter-active,
.page-leave-active {
  transform-origin: 50% 24%;
  transition:
    opacity .3s ease,
    transform .36s var(--ease-out),
    filter .3s ease;
}
.page-enter-from { opacity: 0; transform: translateY(14px) scale(.995); filter: blur(5px); }
.page-leave-to   { opacity: 0; transform: translateY(-7px) scale(1.002); filter: blur(2px); }

/* 控制面板用 fade-only（不做位移，避免全屏闪）*/
.fade-enter-active,
.fade-leave-active { transition: opacity .18s ease; }
.fade-enter-from,
.fade-leave-to     { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active,
  .fade-enter-active,
  .fade-leave-active { transition-duration: .01ms; }
  .page-enter-from,
  .page-leave-to { transform: none; filter: none; }
}
</style>
