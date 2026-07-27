<template>
  <div
    v-for="i in Math.max(1, lines)"
    :key="i"
    class="skeleton"
    :class="[shape, { animated }]"
    :style="sizeVars"
    role="presentation"
    aria-hidden="true"
  >
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

// 只承载自定义属性:尺寸属于数据,样式规则留在下面的 CSS 里
const sizeVars = computed(() => ({
  '--skeleton-w': props.width  || '100%',
  '--skeleton-h': props.height || 'auto',
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
  width: var(--skeleton-w, 100%);
  height: var(--skeleton-h, auto);
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
