<template>
  <label class="live2d-quality-control">
    <span>Live2D 画质</span>
    <select :value="supported ? quality : 'original'" :disabled="!supported"
      aria-label="Live2D 画质" :title="supported ? '切换后重新加载模型，原始资源保持不变' : '更新桌面程序后可选择其他画质'"
      @change="setQuality(($event.target as HTMLSelectElement).value)">
      <option value="original">原始高清</option>
      <option value="standard">标准 · 较省内存</option>
      <option value="compact">节能 · 小窗适用</option>
    </select>
  </label>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useLive2DPreferences } from '@/composables/live2d/preferences'
const props = defineProps<{ native?: boolean }>()
const { quality, setQuality } = useLive2DPreferences()
const supported = computed(() => !props.native || !window.aicsLive2dNative || window.aicsLive2dNative.supportsTextureQuality === true)
</script>
<style scoped>
.live2d-quality-control { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); margin-top: var(--s-2); color: var(--text-secondary); font-size: var(--fs-label-sm); }
.live2d-quality-control select { min-width: 0; max-width: 65%; padding: var(--s-2); border: 1px solid var(--border-soft); border-radius: var(--r-sm); background: var(--bg-surface); color: var(--text-primary); font: inherit; }
.live2d-quality-control select:disabled { color: var(--text-disabled); }
</style>
