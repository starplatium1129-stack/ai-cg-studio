<template>
  <div class="generation-output-controls">
    <div v-if="engine === 'sd' && expert" class="sd-inline-options">
      <label>尺寸<select v-model="sizeProxy">
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
            <option>Auto</option>
            <option>Latent</option>
            <option>Latent (nearest-exact)</option>
            <option>R-ESRGAN 4x+ Anime6B</option>
            <option>R-ESRGAN 4x+</option>
          </select></label>
        </div>
      </details>
    </div>

    <div v-if="presetSummary" class="generation-auto-summary">
      <span>自动参数</span>
      <strong>{{ presetSummary }}</strong>
    </div>

    <div class="preview-actions">
      <button :data-testid="engine === 'sd' ? 'sd-generate' : 'anima-generate'" class="btn btn-primary" type="button" :disabled="generating || !online" @click="$emit('generate')">
        {{ generating ? '生成中…' : '生成图片' }}
      </button>
      <button v-if="generating" class="btn btn-ghost" type="button" @click="$emit('cancel')">停止生成</button>
      <button v-if="engine === 'sd'" class="btn btn-ghost" type="button" :disabled="!queueAvailable" @click="$emit('enqueue')">加入队列</button>
      <button v-if="engine === 'sd' && expert" class="btn btn-ghost" type="button" :disabled="resultSeed == null" @click="$emit('reuse-seed')">
        锁定这个 seed 微调
      </button>
      <button class="btn btn-ghost" type="button" @click="$emit('reset')">清空并重来</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DrawEngine } from '@/storage/settingsRepository'
import type { SDParams } from '@/utils/promptBuilderPersistence'

const props = defineProps<{
  engine: DrawEngine
  expert: boolean
  presetSummary: string
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

<style scoped>
.generation-auto-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding: 9px 11px;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-md);
  background: var(--bg-deep);
  color: var(--text-muted);
  font-size: var(--fs-label-xs);
}
.generation-auto-summary strong { color: var(--text-secondary); font-weight: 650; text-align: right; }
</style>
