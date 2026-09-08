<template><span hidden aria-hidden="true" /></template>
<script setup lang="ts">
import type { useSDGenerate } from '@/composables/generation/useSDGenerate'
import type { useAnimaSession } from '@/composables/generation/useAnimaSession'
import { useDrawingTaskTracking } from '@/composables/generation/useDrawingTaskTracking'
const props = defineProps<{ sd: ReturnType<typeof useSDGenerate>; anima: ReturnType<typeof useAnimaSession> }>()
useDrawingTaskTracking(props.sd, props.anima)
</script>
