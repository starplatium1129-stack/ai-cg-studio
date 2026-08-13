/**
 * 桌面 Companion 的关系状态（纯 TS，无 DOM）。
 *
 * 这里只决定“角色此刻如何陪伴用户”，不产生台词、不调用 LLM/TTS，
 * 也不触碰 Live2D 作者动作。视图用状态驱动舞台光、状态提示与动效强度。
 */

export type CompanionPresence =
  | 'quiet'
  | 'available'
  | 'reaching-out'
  | 'attentive'
  | 'listening'
  | 'thinking'
  | 'speaking'

export interface CompanionPresenceInput {
  visible: boolean
  dnd: boolean
  quietHours: boolean
  speaking: boolean
  listening: boolean
  thinking: boolean
  composing: boolean
  hasReminder: boolean
}

export interface CompanionPresenceState {
  kind: CompanionPresence
  label: string
  live: boolean
}

const PRESENCE_LABELS: Record<CompanionPresence, string> = {
  quiet: '安静陪着你',
  available: '我在这里',
  'reaching-out': '有件事想告诉你',
  attentive: '在听你说',
  listening: '正在认真听',
  thinking: '正在想怎么回答',
  speaking: '正在和你说话',
}

export function resolveCompanionPresence(input: CompanionPresenceInput): CompanionPresenceState {
  let kind: CompanionPresence
  if (!input.visible || input.dnd || input.quietHours) kind = 'quiet'
  else if (input.speaking) kind = 'speaking'
  else if (input.listening) kind = 'listening'
  else if (input.thinking) kind = 'thinking'
  else if (input.composing) kind = 'attentive'
  else if (input.hasReminder) kind = 'reaching-out'
  else kind = 'available'

  return {
    kind,
    label: PRESENCE_LABELS[kind],
    live: kind !== 'quiet' && kind !== 'available',
  }
}
