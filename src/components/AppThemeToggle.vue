<template>
  <button
    type="button"
    class="theme-toggle"
    aria-label="切换主题"
    @click="toggle"
  >
    <span class="theme-toggle-icon"><ArchiveIcon :name="theme === 'dark' ? 'moon' : 'sun'" /></span>
  </button>
</template>

<script setup lang="ts">
import ArchiveIcon from '@/components/visual/ArchiveIcon.vue'
import { useTheme } from '@/composables/useTheme'

const { theme, toggle } = useTheme()
</script>
