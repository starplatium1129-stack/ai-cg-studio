import { ref, type ComputedRef, type Ref } from 'vue'
import { createMessageId, type CharacterConfig } from '@/config/characters'
import { useChatStorage } from '@/composables/useChatStorage'
import { useVoice } from '@/composables/useVoice'
import {
  isAbortError,
  parseNdjsonResponse,
  streamErrorMessage,
} from '@/utils/stream'

type ChatStorage = ReturnType<typeof useChatStorage>
type VoiceController = ReturnType<typeof useVoice>

interface ChatConversationOptions {
  storage: ChatStorage
  voice: VoiceController
  activeChar: Ref<string>
  currentCharacter: ComputedRef<CharacterConfig>
  busy: Ref<boolean>
  chatReady: ComputedRef<boolean>
  chatProvider: Ref<'local' | 'api'>
  currentModel: Ref<string>
  apiBaseUrl: Ref<string>
  apiModel: Ref<string>
  apiKey: Ref<string>
  setBusy: (value: boolean) => void
  onError: (message: string, kind?: string, timeout?: number) => void
  nearBottom: () => boolean
  scrollBottom: () => void
}

export function useChatConversation(options: ChatConversationOptions) {
  const inputText = ref('')
  const streamingMid = ref('')
  const replyAnnouncement = ref('')
  let activeRequest: AbortController | null = null
  let draftTimer = 0

  function abortCurrentRequest(silent = false) {
    if (!activeRequest) return false
    activeRequest.abort()
    activeRequest = null
    options.voice.stop({ preserveMessageAudio: true, silent: true })
    if (!silent) options.onError('已停止本次回复。', 'info', 2500)
    return true
  }

  function stopEverything() {
    const wasBusy = Boolean(activeRequest)
    const wasSpeaking = options.voice.isActive()
    if (!wasBusy && !wasSpeaking) return false
    abortCurrentRequest(true)
    options.voice.stop({ preserveMessageAudio: true, silent: true })
    options.onError(wasBusy ? '已停止本次回复。' : '已停止语音播放。', 'info', 2500)
    return true
  }

  async function sendMessage() {
    const text = inputText.value.trim()
    if (!text || options.busy.value || !options.chatReady.value) return
    options.onError('')
    options.voice.ensureAudioContext()

    const characterId = options.activeChar.value
    const messages = options.storage.messages(characterId)
    replyAnnouncement.value = ''
    messages.push({ role: 'user', content: text, mid: '', stopped: false })
    options.storage.trim(characterId)
    const assistant = { role: 'assistant' as const, content: '', mid: createMessageId(), stopped: false }
    messages.push(assistant)
    options.storage.save()
    inputText.value = ''
    options.storage.setDraft(characterId, '')
    streamingMid.value = assistant.mid
    options.scrollBottom()
    options.setBusy(true)

    const controller = new AbortController()
    activeRequest = controller
    options.voice.startTurn({
      mid: assistant.mid,
      voice: options.currentCharacter.value.voice,
      character: characterId,
    })

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: characterId,
          provider: options.chatProvider.value,
          model: options.currentModel.value,
          api: options.chatProvider.value === 'api' ? {
            baseUrl: options.apiBaseUrl.value,
            model: options.apiModel.value,
            apiKey: options.apiKey.value,
          } : undefined,
          messages: messages.slice(0, -1).map(message => ({ role: message.role, content: message.content })),
        }),
        signal: controller.signal,
      })

      await parseNdjsonResponse(response, async event => {
        if (event.type === 'meta' && event.model) {
          if (options.chatProvider.value === 'api') {
            options.apiModel.value = String(event.model)
            options.storage.setApiSettings({
              baseUrl: options.apiBaseUrl.value,
              model: options.apiModel.value,
              apiKey: options.apiKey.value,
            })
          } else {
            options.currentModel.value = String(event.model)
            options.storage.setModel(options.currentModel.value)
          }
        }
        if (event.type !== 'token') return
        assistant.content += event.content || ''
        options.voice.append(event.content || '')
        if (options.nearBottom()) options.scrollBottom()
      })

      assistant.content = assistant.content.trim() || '……'
      replyAnnouncement.value = `${options.currentCharacter.value.name}说：${assistant.content}`
      options.voice.finishTurn()
    } catch (error) {
      if (isAbortError(error)) {
        assistant.content = assistant.content.trim()
        assistant.stopped = Boolean(assistant.content)
        if (!assistant.content) messages.splice(messages.indexOf(assistant), 1)
      } else {
        messages.splice(messages.indexOf(assistant), 1)
        options.voice.stop({ preserveMessageAudio: true, silent: true })
        options.onError(streamErrorMessage(
          error,
          options.chatProvider.value === 'api'
            ? 'API 对话暂不可用，请检查地址、模型名和密钥。'
            : '聊天暂不可用，请检查 Ollama。',
        ))
      }
    } finally {
      options.storage.trim(characterId)
      options.storage.save()
      streamingMid.value = ''
      if (activeRequest === controller) activeRequest = null
      options.setBusy(false)
      options.scrollBottom()
    }
  }

  function useStarter(text: string) {
    inputText.value = text
    options.storage.setDraft(options.activeChar.value, text)
  }

  function onInputChange() {
    clearTimeout(draftTimer)
    const characterId = options.activeChar.value
    const value = inputText.value
    draftTimer = window.setTimeout(() => options.storage.setDraft(characterId, value), 240) as unknown as number
  }

  function destroy() {
    clearTimeout(draftTimer)
    abortCurrentRequest(true)
  }

  return {
    inputText,
    streamingMid,
    replyAnnouncement,
    abortCurrentRequest,
    stopEverything,
    sendMessage,
    useStarter,
    onInputChange,
    destroy,
  }
}
