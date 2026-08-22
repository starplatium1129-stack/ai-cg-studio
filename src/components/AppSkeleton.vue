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
/* 2026-08-22 动效审计 LOW：shimmer 从 background-position（逐帧重绘，加载页常驻
   数十个骨架）改为 ::before 位移扫带——只动 transform，可上合成器；常速循环用 linear。 */
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--bg-elevated);
  border-radius: var(--r-md);
  display: block;
  width: var(--skeleton-w, 100%);
  height: var(--skeleton-h, auto);
}
.skeleton.animated::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg,
    transparent 25%,
    color-mix(in srgb, var(--bg-hover) 60%, var(--bg-elevated)) 50%,
    transparent 75%
  );
  transform: translateX(-100%);
  animation: shimmer 1.6s linear infinite;
}
.skeleton.circle   { border-radius: 50%; }
.skeleton.text     { height: 1em; border-radius: var(--r-sm); margin-bottom: .5em; }
.skeleton.text:last-child { width: 70%; }

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}
</style>
