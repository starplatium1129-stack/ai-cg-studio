<template>
  <svg
    class="archive-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="path in paths" :key="path" :d="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type ArchiveIconName =
  | 'scene' | 'spark' | 'chat' | 'image' | 'gallery'
  | 'character' | 'palette' | 'model' | 'training' | 'manager'
  | 'info' | 'success' | 'error' | 'warning' | 'sound' | 'mute'
  | 'close' | 'refresh' | 'sun' | 'moon' | 'menu'
  | 'gear' | 'lightning' | 'lock' | 'eye' | 'wand' | 'speaker' | 'filter' | 'search'

const props = defineProps<{ name: ArchiveIconName }>()

const ICON_PATHS: Record<ArchiveIconName, string[]> = {
  scene: ['M12 3c1.8 3.3 4.3 5.8 7.8 7.8-3.5 2-6 4.5-7.8 8.2-1.8-3.7-4.3-6.2-7.8-8.2C7.7 8.8 10.2 6.3 12 3Z', 'M12 7v8'],
  spark: ['M12 2.8 13.7 9l6.2 1.7-6.2 1.7-1.7 6.8-1.7-6.8-6.2-1.7L10.3 9 12 2.8Z'],
  chat: ['M5 5.5h14v10H9l-4 3v-13Z', 'M8 9h8M8 12h5'],
  image: ['M4 5h16v14H4z', 'm6 16 4-4 3 3 2-2 3 3', 'M15.5 9h.01'],
  gallery: ['M5 4h14v16H5z', 'M8 7h8M8 17h8', 'M8 10h8v4H8z'],
  character: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M5 21c.7-4 3-6 7-6s6.3 2 7 6'],
  palette: ['M12 3a9 9 0 0 0 0 18h1.2c1.2 0 1.8-1.5.9-2.3-.8-.8-.2-2.2 1-2.2H18a3 3 0 0 0 3-3C21 7.7 17 3 12 3Z', 'M7.5 10h.01M10 6.8h.01M14 6.5h.01M17 9h.01'],
  model: ['M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z', 'm4.5 7 7.5 4 7.5-4M12 11v10'],
  training: ['M4 6h16M6 6v12h12V6', 'M9 10h6M9 14h4'],
  manager: ['M5 4h14v16H5z', 'M8 8h8M8 12h8M8 16h5', 'M3 8h2M3 12h2M3 16h2'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 10v6M12 7h.01'],
  success: ['M20 6 9 17l-5-5'],
  error: ['M5 5l14 14M19 5 5 19'],
  warning: ['M12 3 2.8 20h18.4L12 3Z', 'M12 9v5M12 17h.01'],
  sound: ['M5 10v4h3l4 3V7l-4 3H5Z', 'M15 9c1.2 1.4 1.2 4.6 0 6M17.5 6.5c3 3 3 8 0 11'],
  mute: ['M5 10v4h3l4 3V7l-4 3H5Z', 'm16 9-5 5m0-5 5 5'],
  close: ['M5 5l14 14M19 5 5 19'],
  refresh: ['M19 8a7 7 0 1 0 1 7', 'M19 4v4h-4'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'],
  moon: ['M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
  gear: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z'],
  lightning: ['M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z'],
  lock: ['M6 10V7a6 6 0 1 1 12 0v3', 'M5 10h14v11H5z', 'M12 14v3'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  wand: ['M15 4l-2 2 3 3 2-2-3-3Z', 'm13 6-9.5 9.5a2.12 2.12 0 0 0 3 3L16 9', 'M18 3v2M21 6h-2'],
  speaker: ['M11 5 6 9H2v6h4l5 4V5Z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3Z'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm21 21-4.35-4.35'],
}

const paths = computed(() => ICON_PATHS[props.name])
</script>

<style scoped>
.archive-icon { display:inline-block; width:1em; height:1em; flex:0 0 auto; vertical-align:-.14em; }
</style>
