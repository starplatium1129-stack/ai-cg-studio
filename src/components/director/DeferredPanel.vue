<template><slot v-if="loaded" /></template>
<script setup lang="ts">
import { ref, watch } from 'vue'
const props = defineProps<{ active: boolean }>()
const loaded = ref(props.active)
// Once used, retain the panel and its draft even when its own dialog closes.
watch(() => props.active, value => { if (value) loaded.value = true })
</script>
