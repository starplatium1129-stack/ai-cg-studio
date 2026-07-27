<template>
  <button
    type="button"
    class="theme-toggle"
    aria-label="切换主题"
    @click="toggle"
  >
    <span class="theme-toggle-icon">{{ theme === 'dark' ? '🌙' : '☀️' }}</span>
  </button>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { theme, toggle } = useTheme()
</script>
