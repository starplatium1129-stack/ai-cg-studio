<template>
  <details class="panel generation-settings">
    <summary class="panel-title settings-summary">出图参数</summary>
    <div class="controls-grid">
      <div class="ctrl"><label>CFG</label>
        <select v-model.number="params.cfg" title="提示词遵循强度：值越高越贴近提示词，过低画面会漂。" @change="touch('cfg')">
          <option v-for="v in [3,4,4.5,5,5.5,6,7,8]" :key="v" :value="v">{{ v }}</option>
        </select>
      </div>
      <div class="ctrl"><label>Steps</label>
        <select v-model.number="params.steps" title="采样步数：越多细节越足、耗时越长，常用 20-40。" @change="touch('steps')">
          <option v-for="v in [20,28,30,35,40,50]" :key="v" :value="v">{{ v }}</option>
        </select>
      </div>
      <div class="ctrl"><label>Sampler</label>
        <select v-model="params.sampler" title="采样器：决定去噪方式与画面质感。" @change="touch('sampler')">
          <option v-for="sampler in samplerOptions" :key="sampler">{{ sampler }}</option>
        </select>
      </div>
      <div class="ctrl"><label>Scheduler</label>
        <select v-model="params.scheduler" title="调度器：配合采样器控制去噪节奏，一般保持自动。" @change="touch('scheduler')">
          <option value="">自动</option>
          <option v-for="scheduler in schedulerOptions" :key="scheduler">{{ scheduler }}</option>
        </select>
      </div>
      <div class="ctrl toggle-row">
        <label class="switch"><input type="checkbox" v-model="params.quality"><span class="slider"></span></label>
        <label title="由模型 profile 注入的质量前缀，无需手写。">质量前缀</label>
      </div>
      <div class="ctrl toggle-row">
        <label class="switch"><input type="checkbox" v-model="params.negative"><span class="slider"></span></label>
        <label title="负面提示词，防止常见缺陷。">负面</label>
      </div>
      <div class="ctrl ctrl-seed">
        <label class="seed-lock-label">
          <input type="checkbox" v-model="params.seedLock"> 锁定 seed
        </label>
        <div class="seed-input-wrap">
          <input type="number" v-model.number="params.seed" min="-1" step="1" placeholder="-1">
          <button class="btn btn-ghost btn-mini" type="button" :disabled="resultSeed == null" @click="$emit('reuse-seed')">复用</button>
        </div>
        <small class="ctrl-hint">{{ params.seedLock ? '将复用固定 seed' : '不锁定时使用随机 seed' }}</small>
      </div>
      <div v-if="params.negative" class="ctrl ctrl-full negative-editor">
        <label>负面提示词</label>
        <textarea v-model="params.negativeCustom" title="留空使用默认负面；可追加常见缺陷词，如 extra fingers, bad anatomy。" placeholder="留空使用默认负面；可追加如：extra fingers, bad anatomy"></textarea>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SDParams } from '@/utils/promptBuilderPersistence'

const props = defineProps<{
  params: SDParams
  samplers: readonly string[]
  schedulers: readonly string[]
  resultSeed: number | null
}>()

const emit = defineEmits<{
  touch: [key: keyof SDParams]
  'reuse-seed': []
}>()

const samplerOptions = computed(() =>
  props.samplers.length ? props.samplers : ['Euler a', 'Euler', 'DPM++ 2M', 'DPM++ 2M SDE'],
)
const schedulerOptions = computed(() =>
  props.schedulers.length ? props.schedulers : ['Karras', 'Exponential'],
)
function touch(key: keyof SDParams) { emit('touch', key) }
</script>
