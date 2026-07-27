<template>
  <div class="skeleton" :class="[shape, { animated }]" :style="style" role="presentation" aria-hidden="true">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  width?: string
  height?: string
  shape?: 'rect' | 'circle' | 'text'
  animated?: boolean
  lines?: number
}>(), { shape: 'rect', animated: true, lines: 1 })

const style = computed(() => ({
  width:  props.width  || undefined,
  height: props.height || undefined,
}))
</script>

<style scoped>
.skeleton {
  background: linear-gradient(90deg,
    var(--bg-elevated) 25%,
    color-mix(in srgb, var(--bg-hover) 60%, var(--bg-elevated)) 50%,
    var(--bg-elevated) 75%
  );
  background-size: 200% 100%;
  border-radius: var(--r-md);
  display: block;
}
.skeleton.animated { animation: shimmer 1.6s ease-in-out infinite; }
.skeleton.circle   { border-radius: 50%; }
.skeleton.text     { height: 1em; border-radius: var(--r-sm); margin-bottom: .5em; }
.skeleton.text:last-child { width: 70%; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
