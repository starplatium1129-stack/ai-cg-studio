<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface ComfyHistoryNode {
  status?: { status_str?: string; messages?: [string, unknown][] }
  outputs?: Record<string, { images?: { filename: string; subfolder?: string; type?: string }[] }>
}

const online = ref(false)
const checkMsg = ref('')
const models = ref<string[]>([])
const loras = ref<string[]>([])
const modelName = ref('anima-base-v1.0.safetensors')
const loraName = ref('ayachi_nene_v19_anima.safetensors')
const loraStrength = ref(0.85)
const prompt = ref('ayachi_nene, 1girl, solo, witch hat, black cape, criss-cross halter, crop top, white hair, red eyes, looking at viewer, cafe, warm lighting, masterpiece, best quality')
const negative = ref('worst quality, low quality, blurry, bad anatomy')
const seed = ref(Math.floor(Math.random() * 1_000_000_000))
const steps = ref(24)
const cfg = ref(3.0)
const width = ref(832)
const height = ref(1216)
const generating = ref(false)
const statusText = ref('')
const errorMsg = ref('')
const pollTimer = ref(0)

const emit = defineEmits<{
  (e: 'result', payload: { url: string; seed: number | null }): void
}>()

async function checkBackend() {
  try {
    const [obj, loraList] = await Promise.all([
      fetch('/comfy/object_info/UNETLoader', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/comfy/object_info/LoraLoader', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ])
    if (!obj) throw new Error('no unet list')
    models.value = (obj.UNETLoader.input.required.unet_name[0] as string[]).filter((n: string) => n.endsWith('.safetensors'))
    loras.value = loraList ? (loraList.LoraLoader.input.required.lora_name[0] as string[]).filter((n: string) => n.includes('_v19')) : []
    online.value = true
    checkMsg.value = `ComfyUI 在线 · ${models.value.length} 个底模 · ${loras.value.length} 个 v19 LoRA`
  } catch {
    online.value = false
    checkMsg.value = 'ComfyUI 离线（未启动或网关未开 /comfy 放行）'
  }
}

function randomSeed() { seed.value = Math.floor(Math.random() * 1_000_000_000) }

async function generate() {
  await runGenerate(prompt.value, negative.value)
}

/** 供绘图页主生成链路调用：外部传入组装好的词条，引擎自动切换到本面板 */
async function generateWith(positive: string, negativeText: string, seedValue?: number) {
  prompt.value = positive
  negative.value = negativeText
  if (typeof seedValue === 'number' && seedValue >= 0) seed.value = seedValue
  await runGenerate(positive, negativeText)
}

async function runGenerate(posText: string, negText: string) {
  if (generating.value) return
  generating.value = true
  statusText.value = '提交工作流…'
  errorMsg.value = ''

  const workflow: Record<string, { class_type: string; inputs: Record<string, unknown> }> = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: modelName.value, weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_06b_base.safetensors', type: 'qwen_image' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' } },
    '4': { class_type: 'LoraLoader', inputs: { model: ['1', 0], clip: ['2', 0], lora_name: loraName.value, strength_model: loraStrength.value, strength_clip: loraStrength.value } },
    '5': { class_type: 'CLIPTextEncode', inputs: { clip: ['4', 1], text: posText } },
    '6': { class_type: 'CLIPTextEncode', inputs: { clip: ['4', 1], text: negText } },
    '7': { class_type: 'EmptyLatentImage', inputs: { width: width.value, height: height.value, batch_size: 1 } },
    '8': { class_type: 'KSampler', inputs: { model: ['4', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0], seed: seed.value, steps: steps.value, cfg: cfg.value, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1 } },
    '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
    '10': { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'anima_quick' } },
  }

  try {
    const r = await fetch('/comfy/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    })
    if (!r.ok) throw new Error('网关返回 ' + r.status)
    const data = await r.json() as { prompt_id?: string; error?: unknown }
    if (!data.prompt_id) throw new Error('ComfyUI 拒绝：' + JSON.stringify(data.error ?? 'unknown'))
    const pid = data.prompt_id
    statusText.value = '生成中…'

    const deadline = Date.now() + 10 * 60 * 1000
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      const h = await fetch('/comfy/history/' + pid, { cache: 'no-store' }).then(r => r.json()) as Record<string, ComfyHistoryNode>
      const entry = h[pid]
      if (!entry) continue
      const st = entry.status?.status_str
      if (st === 'success') {
        for (const node of Object.values(entry.outputs ?? {})) {
          const img = node.images?.[0]
          if (img) {
            const qs = new URLSearchParams({ filename: img.filename, type: img.type ?? 'output', subfolder: img.subfolder ?? '' })
            const url = '/comfy/view?' + qs.toString()
            statusText.value = '生成完成'
            generating.value = false
            emit('result', { url, seed: seed.value })
            return
          }
        }
      } else if (st === 'error') {
        const msgs = entry.status?.messages ?? []
        const err = msgs.find(m => m[0] === 'execution_error')
        throw new Error('执行错误：' + (err ? JSON.stringify(err[1]).slice(0, 200) : 'unknown'))
      }
    }
    throw new Error('生成超时')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
    statusText.value = '生成失败'
  } finally {
    generating.value = false
  }
}

onMounted(() => {
  void checkBackend()
  pollTimer.value = window.setInterval(() => { void checkBackend() }, 15000) as unknown as number
})
onUnmounted(() => { clearInterval(pollTimer.value) })

defineExpose({ generateWith, generate, online })
</script>

<template>
  <details class="panel step-panel anima-quick-panel">
    <summary class="panel-title">
      <span>Anima 引擎（ComfyUI 直通）</span>
      <span class="anima-status" :class="online ? 'is-on' : 'is-off'">{{ online ? '● 在线' : '○ 离线' }}</span>
    </summary>
    <div class="anima-body">
      <p class="anima-hint">{{ checkMsg }}</p>

      <div class="anima-row">
        <label>底模</label>
        <select v-model="modelName">
          <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
      <div class="anima-row">
        <label>LoRA</label>
        <select v-model="loraName">
          <option v-for="l in loras" :key="l" :value="l">{{ l }}</option>
        </select>
        <span class="anima-inline">强度</span>
        <input v-model.number="loraStrength" type="number" min="0" max="1.5" step="0.05" class="anima-num" />
      </div>

      <label class="anima-label">正向提示词</label>
      <textarea v-model="prompt" rows="4" class="anima-textarea"></textarea>

      <label class="anima-label">负向提示词</label>
      <textarea v-model="negative" rows="2" class="anima-textarea"></textarea>

      <div class="anima-row">
        <label>Seed</label>
        <input v-model.number="seed" type="number" class="anima-num anima-seed" />
        <button type="button" class="anima-btn" @click="randomSeed">随机</button>
        <span class="anima-inline">Steps</span>
        <input v-model.number="steps" type="number" min="1" max="60" class="anima-num" />
        <span class="anima-inline">CFG</span>
        <input v-model.number="cfg" type="number" min="0.5" max="10" step="0.5" class="anima-num" />
        <span class="anima-inline">尺寸</span>
        <select v-model="width" class="anima-num">
          <option :value="832">832×1216</option>
          <option :value="1024">1024×1024</option>
          <option :value="1216">1216×832</option>
        </select>
        <input v-model.number="height" type="hidden" />
      </div>

      <div class="anima-actions">
        <button type="button" class="anima-btn anima-primary" :disabled="!online || generating" @click="generate">
          {{ generating ? '生成中…' : 'Anima 出图' }}
        </button>
        <span v-if="statusText" class="anima-status-text">{{ statusText }}</span>
        <span v-if="errorMsg" class="anima-error">{{ errorMsg }}</span>
      </div>
    </div>
  </details>
</template>

<style scoped>
.anima-quick-panel { margin-top: 14px }
.anima-status { margin-left: auto; font-size: 12px; padding: 2px 8px; border-radius: 999px }
.anima-status.is-on { color: #4caf7d; background: rgba(76, 175, 125, 0.12) }
.anima-status.is-off { color: #e57373; background: rgba(229, 115, 115, 0.12) }
.anima-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 8px }
.anima-hint { font-size: 12px; opacity: 0.65; margin: 0 }
.anima-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.anima-row label, .anima-label { font-size: 12px; opacity: 0.8; min-width: 44px }
.anima-label { margin-top: 4px }
.anima-row select, .anima-num { background: var(--panel-input-bg, rgba(255,255,255,0.06)); color: inherit; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 4px 8px; font-size: 12px }
.anima-row select { flex: 1; min-width: 120px }
.anima-num { width: 72px }
.anima-seed { width: 140px }
.anima-inline { font-size: 12px; opacity: 0.6 }
.anima-textarea { width: 100%; background: var(--panel-input-bg, rgba(255,255,255,0.06)); color: inherit; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 6px 8px; font-size: 12px; resize: vertical; font-family: inherit }
.anima-actions { display: flex; align-items: center; gap: 10px; margin-top: 4px }
.anima-btn { background: rgba(255,255,255,0.08); color: inherit; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 5px 12px; font-size: 12px; cursor: pointer }
.anima-btn:disabled { opacity: 0.4; cursor: not-allowed }
.anima-primary { background: #f06292; border-color: #f06292; color: #fff; font-weight: 600 }
.anima-status-text { font-size: 12px; opacity: 0.7 }
.anima-error { font-size: 12px; color: #e57373 }
.anima-result { margin-top: 8px }
.anima-result img { max-width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12) }
</style>
