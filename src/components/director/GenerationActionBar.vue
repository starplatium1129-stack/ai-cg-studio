<template>
  <!-- 吸附式出图条：画布正下方、滚动时钉在导航下沿，尺寸与生成随时可达
       （2026-08-28 审计：尺寸原在栏底 AnimaQuickPanel/输出面板内，改一次要滚全页） -->
  <div class="gen-bar" role="group" aria-label="出图尺寸与生成">
    <label class="gen-bar-size">
      <span class="gen-bar-label">尺寸</span>
      <select :value="size" :disabled="busy" @change="onSizeChange">
        <template v-if="engine === 'sd'">
          <optgroup label="竖图 Portrait">
            <option value="768x1344">768×1344</option>
            <option value="832x1216">832×1216</option>
            <option value="896x1344">896×1344</option>
            <option value="1024x1344">1024×1344 · WAI 推荐</option>
            <option value="1024x1536">1024×1536</option>
            <option value="1152x1536">1152×1536</option>
          </optgroup>
          <optgroup label="方图 Square">
            <option value="896x896">896×896</option>
            <option value="1024x1024">1024×1024</option>
            <option value="1280x1280">1280×1280</option>
          </optgroup>
          <optgroup label="横图 Landscape">
            <option value="1216x832">1216×832</option>
            <option value="1344x896">1344×896</option>
            <option value="1536x1024">1536×1024</option>
          </optgroup>
          <optgroup label="16:9 官方 CG">
            <option value="1344x768">1344×768</option>
          </optgroup>
        </template>
        <option v-else v-for="item in animaSizes" :key="item" :value="item">{{ item.replace('x', '×') }}</option>
      </select>
    </label>
    <span v-if="presetSummary" class="gen-bar-preset">{{ presetSummary }}</span>
    <div class="gen-bar-actions">
      <button
        :data-testid="engine === 'sd' ? 'sd-generate' : 'anima-generate'"
        class="btn btn-primary"
        type="button"
        :disabled="busy || !online"
        @click="$emit('generate')"
      >{{ busy ? '生成中…' : '生成图片' }}</button>
      <button v-if="busy" class="btn btn-ghost" type="button" @click="$emit('cancel')">停止生成</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DrawEngine } from '@/storage/settingsRepository'
// 出图条承载主行动（生成按钮），同步导入保证首屏即位，不进异步分片；
// 体量 ~2KB，路由 CSS 预算余量充足。
import '@/assets/css/director/components/GenerationActionBar.css'

defineProps<{
  engine: DrawEngine
  busy: boolean
  online: boolean
  /** 当前生效尺寸：SD 取 sdSize，Anima/Krea2 取 width×height（宿主统一收敛）。 */
  size: string
  /** Anima/Krea2 候选尺寸（当前底模白名单，含当前值兜底）。 */
  animaSizes: string[]
  presetSummary: string
}>()

const emit = defineEmits<{
  'update:size': [value: string]
  generate: []
  cancel: []
}>()

function onSizeChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value
  if (value) emit('update:size', value)
}
</script>
