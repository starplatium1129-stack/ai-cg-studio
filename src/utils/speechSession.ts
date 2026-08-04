/**
 * 语音会话状态机（纯 TS，无 DOM）。
 *
 * 对标 ZcChat2 的 SpeechInteractionController + SpeechSessionPolicy：
 * 唤醒词激活连续对话 → 会话内直接说话 → 结束词退出。
 * 本模块只做确定性判定与状态转移，采集/识别由 useVoiceInput 驱动，
 * 安静时段与勿扰的抑制由调用方在启动自动监听前检查。
 */

import type { SpeechInputConfig } from './speechInputConfig'

export type SpeechSessionState =
  | 'disabled'        // 语音输入未启用
  | 'waitingForWake'  // 自动监听中，等待唤醒词
  | 'capturing'       // 正在采集（外部 useVoiceInput 驱动）
  | 'recognizing'     // 正在识别（外部 useVoiceInput 驱动）
  | 'waitingForReply' // 已提交，等待角色回复
  | 'continuousReady' // 连续会话中，等待下一轮语音
  | 'ending'          // 已命中结束词，等最后一轮回复完成

export type SessionTextAction = 'submit' | 'end' | 'ignore'

export interface SpeechSessionHandle {
  /** 应用配置并重置会话（enabled/wakeEnabled 变化时调用） */
  applyConfig(config: SpeechInputConfig, fallbackWakeWord?: string): void
  state(): SpeechSessionState
  /** 连续会话是否激活（waitingForReply/continuousReady/ending） */
  isSessionActive(): boolean
  /** 当前是否可以开始一次采集（手动长按或自动监听） */
  canStartCapture(): boolean
  /** 当前是否需要持续自动监听（空闲且已启用自动监听） */
  shouldAutoListen(): boolean
  /** 唤醒词判定：识别文本命中唤醒词 → 激活会话 */
  onWakeText(text: string): boolean
  /** 会话内识别文本判定：结束词 → 'end'；非空 → 'submit'；空 → 'ignore' */
  onSessionText(text: string): SessionTextAction
  /** 外部采集开始（useVoiceInput 已进入 capturing） */
  markCapturing(): void
  /** 外部采集结束进入识别 */
  markRecognizing(): void
  /** 提交后回复链路忙（等待角色回复） */
  markReplyBusy(): void
  /** 回复链路空闲：按当前态恢复（continuousReady 或回 waitingForWake） */
  markReplyIdle(): void
  /** 会话手动退出（如用户主动关闭连续对话） */
  endSession(): void
  reset(): void
}

function normalizeWords(words: string[]): string[] {
  return [...new Set(words.map(word => word.trim()).filter(word => word.length > 0))]
}

export function createSpeechSession(): SpeechSessionHandle {
  let config: SpeechInputConfig | null = null
  let wakeWords: string[] = []
  let endWords: string[] = []
  let state: SpeechSessionState = 'disabled'

  function toWaiting(): void {
    state = config?.wakeEnabled ? 'waitingForWake' : 'disabled'
  }

  return {
    applyConfig(next: SpeechInputConfig, fallbackWakeWord?: string): void {
      config = next
      const wake = normalizeWords(next.wakeWords)
      if (wake.length === 0 && fallbackWakeWord && fallbackWakeWord.trim()) {
        wake.push(fallbackWakeWord.trim())
      }
      wakeWords = wake
      endWords = normalizeWords(next.endWords)
      if (endWords.length === 0) endWords = ['结束对话']
      toWaiting()
    },

    state(): SpeechSessionState {
      return state
    },

    isSessionActive(): boolean {
      return state === 'waitingForReply' || state === 'continuousReady' || state === 'ending'
    },

    canStartCapture(): boolean {
      if (!config?.enabled) return false
      // 手动长按不受唤醒开关约束；回复/收尾期间拒绝新采集。
      return state !== 'waitingForReply' && state !== 'ending'
    },

    shouldAutoListen(): boolean {
      if (!config?.enabled || !config.wakeEnabled) return false
      return state === 'waitingForWake' || state === 'continuousReady'
    },

    onWakeText(text: string): boolean {
      const trimmed = text.trim()
      if (!trimmed) return false
      const hit = wakeWords.some(word => trimmed === word || trimmed.includes(word))
      if (!hit) return false
      if (state === 'waitingForWake' || state === 'continuousReady') {
        state = 'continuousReady'
      }
      return true
    },

    onSessionText(text: string): SessionTextAction {
      const trimmed = text.trim()
      if (!trimmed) return 'ignore'
      if (state === 'ending') return 'ignore'
      if (endWords.some(word => trimmed === word || trimmed.includes(word))) {
        state = 'ending'
        return 'end'
      }
      if (state === 'waitingForReply' || state === 'recognizing' || state === 'capturing') {
        return 'ignore'
      }
      state = 'waitingForReply'
      return 'submit'
    },

    markCapturing(): void {
      if (state === 'waitingForWake' || state === 'continuousReady') {
        state = 'capturing'
      }
    },

    markRecognizing(): void {
      if (state === 'capturing') state = 'recognizing'
    },

    markReplyBusy(): void { /* 回复期由外部 busy 驱动，状态不变 */ },

    markReplyIdle(): void {
      if (state === 'waitingForReply') {
        state = 'continuousReady'
      } else if (state === 'ending') {
        toWaiting()
      }
    },

    endSession(): void {
      toWaiting()
    },

    reset(): void {
      toWaiting()
    },
  }
}
