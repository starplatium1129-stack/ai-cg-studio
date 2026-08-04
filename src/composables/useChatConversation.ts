import { ref, type ComputedRef, type Ref } from 'vue'
import { createMessageId, type CharacterConfig } from '@/config/characters'
import { useChatStorage } from '@/composables/useChatStorage'
import { useVoice } from '@/composables/useVoice'
import { CLIPROXY_BASE_URL, CLIPROXY_API_KEY, CLIPROXY_DEFAULT_MODEL } from '@/config/chatApi'
import {
  inferEmotion,
  isAbortError,
  parseNdjsonResponse,
  streamErrorMessage,
} from '@/utils/stream'
import { extractMoodTag } from '@/utils/moodTag'

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
  webSearchEnabled: Ref<boolean>
  /** 使用站主托管配置（访客模式）：前端不带 key，服务端代填 */
  useHostConfig: Ref<boolean>
  /** 启用桌宠本地工具（companionTools）：仅桌面应用 + API 模式生效 */
  companionTools: Ref<boolean>
  /** 模型推理强度（off/low/medium/high，用户可调；仅 API 模式生效） */
  reasoning: Ref<'off' | 'low' | 'medium' | 'high'>
  setBusy: (value: boolean) => void
  onError: (message: string, kind?: string, timeout?: number) => void
  /** 流式回复文本驱动情绪（无配音时替代 TTS 情绪通道）；情绪变化才回调 */
  onStreamEmotion?: (emotion: string) => void
  /** 工具执行活动指示（null 表示本轮工具全部结束） */
  onToolActivity?: (activity: string | null) => void
  /** 思考过程进行中（收到 reasoning 增量）；第一个正文 token 到达时以 null 结束 */
  onThinking?: (thinking: string | null) => void
  nearBottom: () => boolean
  scrollBottom: () => void
}

interface PendingToolCall {
  id: string
  name: string
  arguments: string
}

const MAX_TOOL_ROUNDS = 4

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
    const streamEmotion = { value: 'neutral' }
    // 本回合原始流（含情绪标签），与干净展示文本分离累积。
    let rawContent = ''
    // 本回合是否出现过协议标签（[mood=xxx]）：出现后协议主导情绪，
    // 文本启发式整回合让位，避免两条通道互相覆盖。
    let moodTagged = false
    const maybeStreamEmotion = (replyText: string) => {
      if (!options.onStreamEmotion || replyText.length < 4) return
      const emotion = inferEmotion(replyText, characterId)
      if (emotion !== streamEmotion.value) {
        streamEmotion.value = emotion
        options.onStreamEmotion(emotion)
      }
    }
    const resetStreamEmotion = () => {
      if (options.onStreamEmotion && streamEmotion.value !== 'neutral') {
        streamEmotion.value = 'neutral'
        options.onStreamEmotion('neutral')
      }
      moodTagged = false
      rawContent = ''
    }
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
      const toolsEnabled = options.companionTools.value && options.chatProvider.value === 'api'
      // 工具循环的临时消息（assistant tool_calls / role:tool）只存内存，
      // 不进持久化历史：它们是同一轮对话的中间过程，不应污染聊天记录。
      const roundMessages: Array<Record<string, unknown>> = []
      let toolRounds = 0
      // 视觉轮：read_image 成功后的下一轮改用本地 Gemini（视觉模型）发图，
      // 看完成回到用户配置的聊天模型继续对话。
      let visionRound = false
      const isVisionMessage = (message: Record<string, unknown>) =>
        Array.isArray(message.content)
        && (message.content as Array<{ type?: string }>).some(part => part.type === 'image_url')
      while (true) {
        const hostMode = options.chatProvider.value === 'api' && options.useHostConfig.value
        const useVision = visionRound && options.chatProvider.value === 'api' && !hostMode
        visionRound = false
        // DeepSeek V4：思考轮带 tool_calls 时必须回传 reasoning_content
        let roundReasoning = ''
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: characterId,
            provider: options.chatProvider.value,
            model: hostMode ? '' : options.currentModel.value,
            api: !hostMode && options.chatProvider.value === 'api' ? (useVision ? {
              baseUrl: CLIPROXY_BASE_URL,
              model: CLIPROXY_DEFAULT_MODEL,
              apiKey: CLIPROXY_API_KEY,
            } : {
              baseUrl: options.apiBaseUrl.value,
              model: options.apiModel.value,
              apiKey: options.apiKey.value,
            }) : undefined,
            hostConfig: hostMode || undefined,
            webSearch: options.chatProvider.value === 'api' && options.webSearchEnabled.value,
            companionTools: toolsEnabled || undefined,
            reasoning: options.reasoning.value,
            messages: [
              ...messages.slice(0, -1).map(message => ({ role: message.role, content: message.content })),
              // 文本轮（回到 DeepSeek 等）不带图片消息：纯文本模型收到
              // image_url 会直接报错；图片已由视觉轮（Gemini）看过，
              // tool 结果里的摘要文本足够衔接上下文
              ...(useVision ? roundMessages : roundMessages.filter(message => !isVisionMessage(message))),
            ],
          }),
          signal: controller.signal,
        })

        const toolCalls: PendingToolCall[] = []
        await parseNdjsonResponse(response, async event => {
          if (event.type === 'meta' && event.model) {
            // 视觉轮（临时切到 Gemini 看图）的模型名不写回用户配置
            if (options.chatProvider.value === 'api' && !hostMode && !useVision) {
              options.apiModel.value = String(event.model)
              options.storage.setApiSettings({
                baseUrl: options.apiBaseUrl.value,
                model: options.apiModel.value,
                apiKey: options.apiKey.value,
              })
            } else if (options.chatProvider.value !== 'api' || hostMode) {
              options.currentModel.value = String(event.model)
              options.storage.setModel(options.currentModel.value)
            }
          }
          if (event.type === 'tool-call') {
            if (event.id && event.name) {
              toolCalls.push({ id: event.id, name: event.name, arguments: String(event.arguments || '{}') })
            }
            return
          }
          if (event.type === 'reasoning') {
            roundReasoning += event.content || ''
            options.onThinking?.(event.content || '')
            return
          }
          if (event.type !== 'token') return
          options.onThinking?.(null)
          const delta = event.content || ''
          const prevCleanLen = assistant.content.length
          // 原始流单独累积（含未闭合标签），展示/历史/配音只吃剥离后的干净文本；
          // 不能用 cleanText 反推 raw，否则被剥离的标签前缀会在下一 token 错位。
          rawContent += delta
          const extracted = extractMoodTag(rawContent)
          assistant.content = extracted.cleanText
          if (extracted.emotion) {
            moodTagged = true
            if (extracted.emotion !== streamEmotion.value) {
              streamEmotion.value = extracted.emotion
              options.onStreamEmotion?.(extracted.emotion)
            }
          } else if (!moodTagged) {
            maybeStreamEmotion(assistant.content)
          }
          options.voice.append(extracted.cleanText.slice(prevCleanLen))
          if (options.nearBottom()) options.scrollBottom()
        })

        if (!toolCalls.length) break
        toolRounds += 1
        if (toolRounds > MAX_TOOL_ROUNDS) break
        roundMessages.push({
          role: 'assistant',
          content: '',
          ...(roundReasoning ? { reasoning_content: roundReasoning.slice(0, 20000) } : {}),
          tool_calls: toolCalls.map(call => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: call.arguments },
          })),
        })
        for (const call of toolCalls) {
          options.onToolActivity?.(`正在执行 ${call.name}…`)
          let result: { ok: boolean; output: string; imageDataUrl?: string }
          try {
            let parsedArgs: Record<string, unknown> = {}
            try { parsedArgs = JSON.parse(call.arguments || '{}') } catch { parsedArgs = {} }
            if (window.companionDesktop) {
              result = await window.companionDesktop.runTool(call.name, parsedArgs)
            } else {
              result = { ok: false, output: '本地工具仅限桌面应用内使用' }
            }
          } catch (error) {
            result = { ok: false, output: error instanceof Error ? error.message : String(error) }
          }
          roundMessages.push({ role: 'tool', tool_call_id: call.id, content: result.output.slice(0, 60000) })
          // read_image 成功时把图片作为多模态 user 消息附加，供视觉模型理解；
          // 下一轮自动切到本地 Gemini 视觉轮，看完成回到原聊天模型
          if (call.name === 'read_image' && result.ok && result.imageDataUrl) {
            roundMessages.push({
              role: 'user',
              content: [
                { type: 'text', text: '（这是 read_image 返回的图片，请结合它回答）' },
                { type: 'image_url', image_url: { url: result.imageDataUrl } },
              ],
            })
            visionRound = true
          }
        }
        options.onToolActivity?.(null)
        if (options.nearBottom()) options.scrollBottom()
      }

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
      resetStreamEmotion()
      options.onToolActivity?.(null)
      options.onThinking?.(null)
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
