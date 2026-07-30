<template>
  <div class="route-stage">
    <RouterView v-slot="{ Component, route }">
      <Transition :name="route.meta.transition as string || 'page'">
        <component :is="Component" :key="route.path" />
      </Transition>
    </RouterView>
  </div>
  <AppInteractionLayer />
  <AppToast />
</template>

<script setup lang="ts">
import AppInteractionLayer from '@/components/AppInteractionLayer.vue'
import AppToast from '@/components/AppToast.vue'
</script>

<style>
.route-stage {
  display: grid;
  align-items: start;
  min-width: 0;
}
.route-stage > * {
  grid-area: 1 / 1;
  min-width: 0;
}

/* ── 页面路由过渡 ─────────────────────────────────────────────────────── */
.page-enter-active,
.page-leave-active {
  transform-origin: 50% 24%;
  transition:
    opacity .18s ease,
    transform .24s var(--ease-out);
}
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to   { opacity: 0; transform: translateY(-4px); }

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
  .page-leave-to { transform: none; }
}
</style>
