<template>
  <div class="route-stage">
    <RouterView />
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
</style>
