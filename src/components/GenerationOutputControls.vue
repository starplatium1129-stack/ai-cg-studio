<template>
  <div class="generation-output-controls">
    <div class="sd-inline-options">
      <label>尺寸<select v-model="sizeProxy">
        <optgroup label="竖图 Portrait">
          <option value="768x1344">768×1344</option>
          <option value="832x1216">832×1216</option>
          <option value="896x1344">896×1344</option>
          <option value="1024x1344">1024×1344 · WAI 推荐</option>
          <option value="1024x1536">1024×1536</option>
          <option value="1152x1536">1152×1536</option>
          <option value="1216x1664">1216×1664 · 大图</option>
        </optgroup>
        <optgroup label="方图 Square">
          <option value="896x896">896×896</option>
          <option value="1024x1024">1024×1024</option>
          <option value="1280x1280">1280×1280</option>
          <option value="1440x1440">1440×1440 · 大图</option>
        </optgroup>
        <optgroup label="横图 Landscape">
          <option value="1216x832">1216×832</option>
          <option value="1344x896">1344×896</option>
          <option value="1536x1024">1536×1024</option>
          <option value="1664x1216">1664×1216 · 大图</option>
        </optgroup>
        <optgroup label="16:9 官方 CG">
          <option value="1280x720">1280×720</option>
          <option value="1344x768">1344×768</option>
          <option value="1600x896">1600×896</option>
          <option value="1920x1088">1920×1088 · 大图</option>
        </optgroup>
      </select></label>
      <span class="sd-vram-hint advanced-decision" :class="vramLevel">{{ vramHint }}</span>
      <span v-if="baseResolutionRisk" class="sd-base-resolution-hint advanced-decision" :class="baseResolutionRisk">{{ baseResolutionHint }}</span>
      <label class="hires-label advanced-decision">
        <span class="switch"><input type="checkbox" v-model="params.hiresFix"><span class="slider"></span></span>
        hires.fix
      </label>
      <label v-if="canUseFaceDetailer" class="hires-label advanced-decision">
        <span class="switch"><input type="checkbox" v-model="params.faceDetailer" @change="touch('faceDetailer')"><span class="slider"></span></span>
        面部与手部修复
      </label>
      <details v-if="params.hiresFix" class="sd-advanced-options advanced-decision">
        <summary>高级设置</summary>
        <div class="sd-advanced-grid">
          <label>放大<select v-model.number="params.hiresScale" @change="touch('hiresScale')"><option :value="1.5">1.5×</option><option :value="2">2×</option></select></label>
          <label>二阶段步数<input type="number" v-model.number="params.hiresSteps" min="0" max="60" step="1" @change="touch('hiresSteps')"></label>
          <label>重绘幅度<input type="number" v-model.number="params.hiresDenoise" min="0.1" max="0.9" step="0.05" @change="touch('hiresDenoise')"></label>
          <label>放大器<select v-model="params.hiresUpscaler" @change="touch('hiresUpscaler')">
            <option>R-ESRGAN 4x+ Anime6B</option>
            <option>R-ESRGAN 4x+</option>
          </select></label>
        </div>
      </details>
    </div>

    <div class="preview-actions">
      <button class="btn btn-primary" type="button" :disabled="generating || !online" @click="$emit('generate')">
        {{ generating ? '生成中…' : '生成图片' }}
      </button>
      <button v-if="generating" class="btn btn-ghost" type="button" @click="$emit('cancel')">停止生成</button>
      <button class="btn btn-ghost" type="button" :disabled="!queueAvailable" @click="$emit('enqueue')">加入队列</button>
      <button class="btn btn-ghost advanced-decision" type="button" :disabled="resultSeed == null" @click="$emit('reuse-seed')">
        锁定这个 seed 微调
      </button>
      <button class="btn btn-ghost" type="button" @click="$emit('reset')">再来一次</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SDParams } from '@/utils/promptBuilderPersistence'

const props = defineProps<{
  params: SDParams
  size: string
  vramHint: string
  vramLevel: string
  baseResolutionRisk: string
  baseResolutionHint: string
  canUseFaceDetailer: boolean
  generating: boolean
  online: boolean
  resultSeed: number | null
  queueAvailable: boolean
}>()

const emit = defineEmits<{
  'update:size': [value: string]
  touch: [key: keyof SDParams]
  generate: []
  cancel: []
  enqueue: []
  'reuse-seed': []
  reset: []
}>()

const sizeProxy = computed({
  get: () => props.size,
  set: value => emit('update:size', value),
})
function touch(key: keyof SDParams) { emit('touch', key) }
</script>
