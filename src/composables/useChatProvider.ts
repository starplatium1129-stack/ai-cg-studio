import { computed, ref, type Ref } from 'vue'
import { useChatStorage, type ChatState } from '@/composables/useChatStorage'
import { parseChatStatus, type ChatModel } from '@/utils/chatStatus'

export type ApiVendor = 'cliproxy' | 'deepseek' | 'opencode' | 'opencode-go' | 'custom'
type ChatStorage = ReturnType<typeof useChatStorage>

interface ChatProviderOptions {
  storage: ChatStorage
  isBusy: Ref<boolean>
}

export function useChatProvider({ storage, isBusy }: ChatProviderOptions) {
  const ollamaOnline = ref(false)
  const models = ref<ChatModel[]>([])
  const currentModel = ref('')
  const chatProvider = ref<'local' | 'api'>('local')
  const apiBaseUrl = ref('https://api.deepseek.com')
  const apiModel = ref('deepseek-v4-flash')
  const apiKey = ref('')
  const apiVendor = ref<ApiVendor>('custom')
  const apiSettingsOpen = ref(false)
  const apiConfigHint = ref('')
  const chatStatusText = ref('正在检查本地聊天模型…')
  const statusKind = ref('')

  function restoreSettings(state: ChatState) {
    currentModel.value = state.settings.model || ''
    chatProvider.value = state.settings.provider
    apiBaseUrl.value = state.settings.apiBaseUrl
    apiModel.value = state.settings.apiModel
    apiKey.value = state.settings.apiKey
    const savedApiBase = apiBaseUrl.value.replace(/\/+$/, '')
    apiVendor.value = savedApiBase === 'https://api.deepseek.com'
      ? 'deepseek'
      : savedApiBase === 'http://127.0.0.1:8317/v1' ? 'cliproxy'
      : savedApiBase === 'https://opencode.ai/zen/v1' ? 'opencode'
        : savedApiBase === 'https://opencode.ai/zen/go/v1' ? 'opencode-go' : 'custom'
    apiSettingsOpen.value = chatProvider.value === 'api' && !apiModel.value
  }

  restoreSettings(storage.state)

  const apiConfigured = computed(() =>
    Boolean(apiBaseUrl.value.trim() && apiModel.value.trim()
      && (apiVendor.value === 'custom' || apiKey.value.trim())),
  )
  const chatReady = computed(() =>
    chatProvider.value === 'api' ? apiConfigured.value : ollamaOnline.value,
  )

  function setChatStatus(text: string, kind = '') {
    chatStatusText.value = text
    statusKind.value = kind
  }

  async function refreshChatStatus() {
    try {
      const response = await fetch('/api/chat-status', { cache: 'no-store' })
      if (!response.ok) throw new Error('聊天状态接口不可用')
      const data = parseChatStatus(await response.json() as unknown)
      ollamaOnline.value = data.online && Boolean(data.models.length)
      models.value = data.models
      if (!isBusy.value && chatProvider.value === 'local') {
        setChatStatus(ollamaOnline.value ? '本地聊天模型已连接' : 'Ollama 未启动', ollamaOnline.value ? 'online' : '')
      }
      const saved = storage.state.settings.model
      if (data.models.some(model => model.name === saved)) {
        currentModel.value = saved
      } else if (data.model || data.models[0]) {
        currentModel.value = data.model || data.models[0]?.name || ''
        storage.setModel(currentModel.value)
      }
      if (!data.models.length) {
        currentModel.value = ''
        if (chatProvider.value === 'local') setChatStatus('Ollama 未启动')
      }
    } catch {
      ollamaOnline.value = false
      models.value = []
      if (!isBusy.value && chatProvider.value === 'local') setChatStatus('Ollama 未启动')
    }
  }

  function setChatProvider(provider: 'local' | 'api') {
    if (isBusy.value || chatProvider.value === provider) return
    chatProvider.value = provider
    storage.setProvider(provider)
    apiConfigHint.value = ''
    if (provider === 'api') {
      apiSettingsOpen.value = !apiConfigured.value
      setChatStatus(apiConfigured.value ? `自定义 API · ${apiModel.value}` : '等待配置自定义 API', apiConfigured.value ? 'online' : '')
    } else {
      setChatStatus(ollamaOnline.value ? '本地聊天模型已连接' : 'Ollama 未启动', ollamaOnline.value ? 'online' : '')
    }
  }

  function saveApiSettings() {
    if (!apiConfigured.value) {
      apiConfigHint.value = apiVendor.value !== 'custom'
        ? `请填写 ${apiVendor.value === 'opencode' ? 'OpenCode Zen' : apiVendor.value === 'opencode-go' ? 'OpenCode Go' : 'DeepSeek'} API Key。`
        : '请填写 API 地址和模型名。'
      return
    }
    storage.setApiSettings({ baseUrl: apiBaseUrl.value, model: apiModel.value, apiKey: apiKey.value })
    apiConfigHint.value = '配置已保存在这个浏览器中。'
    apiSettingsOpen.value = false
    setChatStatus(`自定义 API · ${apiModel.value}`, 'online')
  }

  function setBusyStatus(value: boolean) {
    isBusy.value = value
    if (value) setChatStatus('正在生成回复…', 'busy')
    else if (chatProvider.value === 'api') {
      setChatStatus(apiConfigured.value ? `自定义 API · ${apiModel.value}` : '等待配置自定义 API', apiConfigured.value ? 'online' : '')
    } else {
      setChatStatus(ollamaOnline.value ? '本地聊天模型已连接' : '聊天模型未连接', ollamaOnline.value ? 'online' : '')
    }
  }

  return {
    ollamaOnline, models, currentModel, chatProvider, apiBaseUrl, apiModel, apiKey,
    apiVendor, apiSettingsOpen, apiConfigHint, chatStatusText, statusKind,
    apiConfigured, chatReady, refreshChatStatus, setChatProvider, saveApiSettings,
    setChatStatus, setBusy: setBusyStatus,
  }
}
