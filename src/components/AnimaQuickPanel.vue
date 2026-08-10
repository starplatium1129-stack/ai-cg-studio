<script setup lang="ts">
import { computed } from 'vue'
import type { AnimaGenerationState } from '@/types/anima'

const props = defineProps<{ state: AnimaGenerationState }>()
const state = computed(() => props.state)
const emit = defineEmits<{
  (event: 'update:state', patch: Partial<AnimaGenerationState>): void
  (event: 'submit'): void
  (event: 'cancel'): void
}>()

function patch(patch: Partial<AnimaGenerationState>) { emit('update:state', patch) }

const modelId = computed({
  get: () => props.state.modelId,
  set: value => {
    const model = props.state.models.find(item => item.id === value)
    const [width, height] = String(model?.sizes?.[0] || '').split('x').map(Number)
    patch({
      modelId: value,
      family: model?.family === 'krea2' ? 'krea2' : 'anima',
      steps: Number(model?.defaults?.steps) || props.state.steps,
      cfg: Number(model?.defaults?.cfg) || props.state.cfg,
      sampler: String(model?.defaults?.sampler || props.state.sampler),
      scheduler: String(model?.defaults?.scheduler || props.state.scheduler),
      loraId: model?.family === 'krea2' ? '' : props.state.loraId,
      ...(Number.isInteger(width) && Number.isInteger(height) ? { width, height } : {}),
    })
  },
})
const loraId = computed({ get: () => props.state.loraId, set: value => patch({ loraId: value }) })
const loraStrength = computed({ get: () => props.state.loraStrength, set: value => patch({ loraStrength: value }) })
const seed = computed({ get: () => props.state.seed ?? '', set: value => patch({ seed: value === '' ? null : Number(value) }) })
const steps = computed({ get: () => props.state.steps, set: value => patch({ steps: value }) })
const cfg = computed({ get: () => props.state.cfg, set: value => patch({ cfg: value }) })
const size = computed({
  get: () => `${props.state.width}x${props.state.height}`,
  set: value => {
    const [width, height] = value.split('x').map(Number)
    if (Number.isInteger(width) && Number.isInteger(height)) patch({ width, height })
  },
})

const busy = computed(() => ['submitting', 'running', 'cancelling'].includes(props.state.phase))
const canSubmit = computed(() => props.state.online && !busy.value && !!props.state.prompt && !!props.state.modelId)
const selectedLora = computed(() => props.state.loras.find(lora => lora.id === props.state.loraId) ?? null)
const selectedModel = computed(() => props.state.models.find(model => model.id === props.state.modelId) ?? null)
const availableSizes = computed(() => selectedModel.value?.sizes?.length ? selectedModel.value.sizes : ['832x1216', '1024x1024', '1216x832'])
function randomSeed() { patch({ seed: Math.floor(Math.random() * 1_000_000_000) }) }
</script>

<template>
  <details class="panel step-panel anima-quick-panel">
    <summary class="panel-title">
       <span>{{ state.family === 'krea2' ? 'Krea 2 · Comfy 创作引擎' : 'Anima 引擎（应用安全 API）' }}</span>
      <span class="anima-status" :class="state.online ? 'is-on' : 'is-off'">{{ state.online ? '● 在线' : '○ 离线' }}</span>
    </summary>
    <div class="anima-body">
       <p class="anima-hint">{{ state.checkMsg }}</p>
       <p v-if="state.family === 'krea2'" class="anima-preview-note"><strong>Krea 2 实验</strong> · 纯自然语言、无角色 LoRA，身份不保证；Prompt Enhancer 未启用。</p>
        <p v-else-if="selectedLora?.preview" class="anima-preview-note"><strong>实验预览</strong> · 夏目 v19 E08 · 普通全身稳定性有限</p>

       <div class="anima-row">
         <label>底模</label>
        <select v-model="modelId" :disabled="busy">
           <option v-for="m in state.models" :key="m.id" :value="m.id" :disabled="m.available === false">{{ m.label || m.id }}{{ m.available === false ? ' · 资源缺失' : '' }}</option>
        </select>
      </div>
       <div v-if="state.family !== 'krea2'" class="anima-row">
        <label>LoRA</label>
        <select v-model="loraId" :disabled="busy">
          <option v-for="l in state.loras" :key="l.id" :value="l.id">{{ l.name || l.id }}</option>
        </select>
        <span class="anima-inline">强度</span>
        <input v-model.number="loraStrength" type="number" min="0.65" max="1" step="0.05" class="anima-num" :disabled="busy" />
      </div>

      <label class="anima-label">正向提示词</label>
      <textarea :value="state.prompt" rows="4" class="anima-textarea" readonly></textarea>

       <template v-if="state.family !== 'krea2'">
         <label class="anima-label">负向提示词</label>
         <textarea :value="state.negative" rows="2" class="anima-textarea" readonly></textarea>
       </template>

      <div class="anima-row">
        <label>Seed</label>
        <input v-model.number="seed" type="number" class="anima-num anima-seed" :disabled="busy" />
        <button type="button" class="anima-btn" :disabled="busy" @click="randomSeed">随机</button>
        <span class="anima-inline">Steps</span>
         <input v-model.number="steps" type="number" min="1" max="60" class="anima-num" :disabled="busy || state.family === 'krea2'" />
        <span class="anima-inline">CFG</span>
         <input v-model.number="cfg" type="number" min="0.5" max="10" step="0.5" class="anima-num" :disabled="busy || state.family === 'krea2'" />
        <span class="anima-inline">尺寸</span>
        <select v-model="size" class="anima-num" :disabled="busy">
           <option v-for="item in availableSizes" :key="item" :value="item">{{ item.replace('x', '×') }}</option>
        </select>
      </div>

      <div class="anima-actions">
        <button type="button" class="anima-btn anima-primary" :disabled="!canSubmit" @click="emit('submit')">
           {{ busy ? '生成中…' : state.family === 'krea2' ? 'Krea 2 出图' : 'Anima 出图' }}
        </button>
        <button v-if="busy" type="button" class="anima-btn" @click="emit('cancel')">取消当前任务</button>
        <span v-if="state.statusText" class="anima-status-text">{{ state.statusText }}</span>
        <span v-if="state.errorMsg" class="anima-error">{{ state.errorMsg }}</span>
      </div>
    </div>
  </details>
</template>

<style scoped>
.anima-quick-panel { margin-top: 14px }
.anima-status { margin-left: auto; font-size: var(--fs-label-xs); padding: 2px 8px; border-radius: var(--r-pill) }
.anima-status.is-on { color: var(--success-text); background: color-mix(in srgb, var(--success) 12%, transparent) }
.anima-status.is-off { color: var(--danger-text); background: color-mix(in srgb, var(--danger) 12%, transparent) }
.anima-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 8px }
.anima-hint { font-size: var(--fs-label-xs); opacity: 0.65; margin: 0 }
.anima-preview-note { margin: 0; color: var(--warning-text); font-size: var(--fs-label-xs); line-height: 1.45 }
.anima-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.anima-row label, .anima-label { font-size: var(--fs-label-xs); opacity: 0.8; min-width: 44px }
.anima-label { margin-top: 4px }
.anima-row select, .anima-num { background: var(--bg-deep); color: inherit; border: 1px solid var(--border-soft); border-radius: var(--r-sm); padding: 4px 8px; font-size: var(--fs-label-xs) }
.anima-row select { flex: 1; min-width: 120px }
.anima-num { width: 72px }
.anima-seed { width: 140px }
.anima-inline { font-size: var(--fs-label-xs); opacity: 0.6 }
.anima-textarea { width: 100%; background: var(--bg-deep); color: inherit; border: 1px solid var(--border-soft); border-radius: var(--r-sm); padding: 6px 8px; font-size: var(--fs-label-xs); resize: vertical; font-family: inherit }
.anima-actions { display: flex; align-items: center; gap: 10px; margin-top: 4px }
.anima-btn { background: var(--bg-hover); color: inherit; border: 1px solid var(--border-soft); border-radius: var(--r-sm); padding: 5px 12px; font-size: var(--fs-label-xs); cursor: pointer }
.anima-btn:disabled { opacity: 0.4; cursor: not-allowed }
.anima-primary { background: var(--accent); border-color: var(--accent); color: var(--text-inverse); font-weight: 600 }
.anima-status-text { font-size: var(--fs-label-xs); opacity: 0.7 }
.anima-error { font-size: var(--fs-label-xs); color: var(--danger-text) }
.anima-result { margin-top: 8px }
.anima-result img { max-width: 100%; border-radius: var(--r-lg); border: 1px solid var(--border-soft) }
</style>
