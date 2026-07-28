<template>
  <form class="api-settings" @submit.prevent="$emit('save')">
    <div class="api-settings-head">
      <div>
        <strong>OpenAI 兼容 API</strong>
        <span>适用于 DeepSeek、OpenCode Zen 及其他兼容 /chat/completions 的服务。</span>
      </div>
      <span class="api-storage-note">仅保存在本机浏览器</span>
    </div>

    <div class="api-settings-grid">
      <label class="api-field">
        <span>服务商</span>
        <select :value="vendorProxy" @change="applyVendor">
          <option value="deepseek">DeepSeek 官方</option>
          <option value="opencode">OpenCode Zen</option>
          <option value="custom">其他 OpenAI 兼容 API</option>
        </select>
      </label>
      <label class="api-field">
        <span>API 地址</span>
        <input v-model.trim="baseUrlProxy" type="url" maxlength="500"
          placeholder="https://api.example.com/v1" autocomplete="url" required />
      </label>
      <label class="api-field">
        <span>模型名</span>
        <select v-if="vendorProxy !== 'custom'" v-model="modelProxy" required>
          <option v-for="option in modelOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <template v-else>
          <input v-model.trim="modelProxy" list="chat-api-models" maxlength="200"
            placeholder="填写服务商提供的模型 ID" autocomplete="off" required />
          <datalist id="chat-api-models">
            <option v-for="modelName in discoveredModels" :key="modelName" :value="modelName" />
          </datalist>
        </template>
        <small v-if="vendorProxy !== 'custom'">{{ modelNote }}</small>
      </label>
      <label class="api-field">
        <span>API Key{{ vendorProxy === 'custom' ? '（可留空）' : '' }}</span>
        <div class="api-key-field">
          <input v-model.trim="apiKeyProxy" :type="showApiKey ? 'text' : 'password'"
            maxlength="1000" placeholder="sk-…" autocomplete="off"
            :required="vendorProxy !== 'custom'" />
          <button type="button" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button>
        </div>
      </label>
    </div>

    <div class="api-settings-actions">
      <span class="api-test-status" :data-state="testState" role="status">{{ statusText }}</span>
      <div class="api-settings-buttons">
        <button class="btn btn-ghost btn-sm" type="button"
          :disabled="testing || !canTest" @click="testConnection">
          {{ testing ? '测试中…' : '测试连接' }}
        </button>
        <button class="btn btn-primary btn-sm" type="submit">保存并使用</button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type ApiVendor = 'deepseek' | 'opencode' | 'custom'
interface ModelOption { value: string; label: string }

const PRESET_MODELS: Record<Exclude<ApiVendor, 'custom'>, ModelOption[]> = {
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash · 推荐' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro · 更强' },
  ],
  opencode: [
    { value: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free · 免费推荐' },
    { value: 'mimo-v2.5-free', label: 'MiMo V2.5 Free · 免费' },
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash · 性价比' },
    { value: 'minimax-m2.5', label: 'MiniMax M2.5' },
    { value: 'kimi-k2.5', label: 'Kimi K2.5' },
  ],
}

const props = defineProps<{
  vendor: ApiVendor
  baseUrl: string
  model: string
  apiKey: string
  hint?: string
}>()

const emit = defineEmits<{
  'update:vendor': [value: ApiVendor]
  'update:baseUrl': [value: string]
  'update:model': [value: string]
  'update:apiKey': [value: string]
  save: []
}>()

const showApiKey = ref(false)
const testing = ref(false)
const testState = ref('')
const testMessage = ref('')
const discoveredModels = ref<string[]>([])

const vendorProxy = computed({
  get: () => props.vendor,
  set: value => emit('update:vendor', value),
})
const baseUrlProxy = computed({
  get: () => props.baseUrl,
  set: value => emit('update:baseUrl', value),
})
const modelProxy = computed({
  get: () => props.model,
  set: value => emit('update:model', value),
})
const apiKeyProxy = computed({
  get: () => props.apiKey,
  set: value => emit('update:apiKey', value),
})

const canTest = computed(() =>
  Boolean(props.baseUrl.trim() && props.model.trim()
    && (props.vendor === 'custom' || props.apiKey.trim()))
)
const modelOptions = computed<ModelOption[]>(() => {
  if (props.vendor === 'custom') return []
  const known = PRESET_MODELS[props.vendor]
  const extras = discoveredModels.value
    .filter(value => !known.some(option => option.value === value))
    .map(value => ({ value, label: value }))
  return known.concat(extras)
})
const modelNote = computed(() =>
  props.vendor === 'opencode'
    ? '免费模型适合日常角色闲聊；测试连接后会补充账号当前可见模型。'
    : '角色聊天默认关闭深度思考，响应更快、更省 token。'
)
const statusText = computed(() => testMessage.value || props.hint || '先测试连接，再保存配置。')

function applyVendor(event: Event) {
  const vendor = (event.target as HTMLSelectElement).value as ApiVendor
  emit('update:vendor', vendor)
  discoveredModels.value = []
  testState.value = ''
  testMessage.value = ''
  if (vendor === 'deepseek') {
    emit('update:baseUrl', 'https://api.deepseek.com')
    emit('update:model', 'deepseek-v4-flash')
  } else if (vendor === 'opencode') {
    emit('update:baseUrl', 'https://opencode.ai/zen/v1')
    emit('update:model', 'deepseek-v4-flash-free')
  }
}

async function testConnection() {
  if (!canTest.value || testing.value) return
  testing.value = true
  testState.value = 'testing'
  testMessage.value = '正在验证密钥并获取模型列表…'
  try {
    const response = await fetch('/api/chat-provider/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: props.baseUrl,
        model: props.model,
        apiKey: props.apiKey,
      }),
    })
    const data = await response.json()
    if (!response.ok || !data.ok) {
      throw new Error(data.detail ? `${data.error}：${data.detail}` : data.error || '连接测试失败')
    }
    discoveredModels.value = Array.isArray(data.models)
      ? data.models.map(String).filter(Boolean)
      : []
    testState.value = 'success'
    testMessage.value = discoveredModels.value.length
      ? `连接成功，发现 ${discoveredModels.value.length} 个模型。`
      : '连接成功；该服务没有返回模型列表。'
  } catch (error) {
    testState.value = 'error'
    testMessage.value = (error as Error).message || '连接测试失败'
  } finally {
    testing.value = false
  }
}
</script>
