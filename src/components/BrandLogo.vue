<template>
  <img :src="theme === 'light' ? '/assets/logo-light.svg' : '/assets/logo.svg'" alt="绘遇 · HUIYU" />
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { theme } = useTheme()
</script>
