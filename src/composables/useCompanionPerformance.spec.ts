import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCompanionPerformance } from './useCompanionPerformance'
import type { CompanionReminder } from '@/utils/companionBehavior'
import { companionPerformance } from '@/config/companionPerformances'

let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-11T12:00:00')) })
afterEach(() => { wrapper?.unmount(); vi.useRealTimers() })
async function setup(initialAllowed = true) {
  const activeChar = ref('nene'), allowed = ref(initialAllowed), autoVoice = ref(true), voiceActive = ref(false)
  const reminders = ref<CompanionReminder[]>([{ id: 'greeting', at: Date.now(), kind: 'return', line: '中午好，记得休息。' }])
  const stage = ref({ setEmotion: vi.fn() })
  let activeMid: string | null = null
  const voice = {
    isActive: () => voiceActive.value, readyFor: vi.fn(() => true),
    ownsTurn: (mid: string) => activeMid === mid,
    startTurn: vi.fn((meta: { mid: string }) => { activeMid = meta.mid; voiceActive.value = true }), append: vi.fn(), finishTurn: vi.fn(),
    stop: vi.fn(() => { activeMid = null; voiceActive.value = false }), clearMessages: vi.fn(),
  }
  wrapper = mount(defineComponent({ setup() {
    useCompanionPerformance({ activeChar, reminders, stage, voice, autoVoice, voiceActive,
      allowed: () => allowed.value, voiceId: () => activeChar.value, affection: () => 65 })
    return () => null
  } }))
  await nextTick()
  return { activeChar, allowed, autoVoice, voiceActive, reminders, stage, voice }
}

it('binds a fresh greeting to the existing voice and emotion lifecycle exactly once', async () => {
  const { reminders, stage, voice, voiceActive } = await setup()
  expect(voice.startTurn).toHaveBeenCalledWith({ mid: 'companion-cue-greeting', character: 'nene', voice: 'nene' })
  expect(voice.append).toHaveBeenCalledWith('中午好，记得休息。')
  expect(stage.value.setEmotion).toHaveBeenCalledWith('happy')
  reminders.value = [...reminders.value]
  voiceActive.value = false
  await nextTick()
  expect(voice.startTurn).toHaveBeenCalledTimes(1)
  expect(voice.clearMessages).toHaveBeenCalledWith(['companion-cue-greeting'])
})

it('defers suppressed cues, then cancels owned audio when user activity or DND takes priority', async () => {
  const { allowed, voice } = await setup(false)
  expect(voice.startTurn).not.toHaveBeenCalled()
  allowed.value = true; await nextTick()
  expect(voice.startTurn).toHaveBeenCalledTimes(1)
  allowed.value = false
  expect(voice.stop).toHaveBeenCalledTimes(1)
  allowed.value = true; await nextTick()
  expect(voice.startTurn).toHaveBeenCalledTimes(1)
})

it('never stops unrelated chat audio and respects the automatic voice switch', async () => {
  const { allowed, autoVoice, voiceActive, voice, stage } = await setup(false)
  voiceActive.value = true; allowed.value = true; await nextTick()
  expect(voice.startTurn).not.toHaveBeenCalled()
  allowed.value = false; await nextTick()
  expect(voice.stop).not.toHaveBeenCalled()
  autoVoice.value = false; voiceActive.value = false; allowed.value = true; await nextTick()
  expect(stage.value.setEmotion).toHaveBeenCalledWith('happy')
  expect(voice.startTurn).not.toHaveBeenCalled()
})

it('releases cues on character change and cancels a stalled synthesis on its bounded timeout', async () => {
  const { activeChar, reminders, voice } = await setup()
  reminders.value = []; activeChar.value = 'natsume'
  expect(voice.stop).toHaveBeenCalledTimes(1)
  await nextTick()
  reminders.value = [{ id: 'next-character', at: Date.now(), kind: 'return', line: '下午好。' }]
  await nextTick()
  expect(voice.startTurn).toHaveBeenLastCalledWith(expect.objectContaining({ character: 'natsume' }))
  await vi.advanceTimersByTimeAsync(45000)
  expect(voice.stop).toHaveBeenCalledTimes(2)
  expect(voice.clearMessages).toHaveBeenLastCalledWith(['companion-cue-next-character'])
})

it('does not cancel or reset a later voice turn when a cue loses audio ownership', async () => {
  const { voice, stage, allowed } = await setup()
  voice.startTurn({ mid: 'user-requested-replay' })
  stage.value.setEmotion.mockClear()
  allowed.value = false
  await vi.advanceTimersByTimeAsync(45000)
  expect(voice.stop).not.toHaveBeenCalled()
  expect(stage.value.setEmotion).not.toHaveBeenCalled()
  expect(voice.ownsTurn('user-requested-replay')).toBe(true)
  expect(voice.clearMessages).toHaveBeenCalledWith(['companion-cue-greeting'])
})

it('does not replay stale/future events or invent an unknown performance', () => {
  const reminder: CompanionReminder = { id: 'event', at: Date.now(), kind: 'event', eventKind: 'service-down', line: '服务暂不可用。' }
  expect(companionPerformance(reminder, 90)).toEqual({ emotion: 'serious' })
  expect(companionPerformance({ ...reminder, at: Date.now() - 60001 }, 90)).toBeNull()
  expect(companionPerformance({ ...reminder, at: Date.now() + 1 }, 90)).toBeNull()
  expect(companionPerformance({ ...reminder, eventKind: undefined }, 90)).toBeNull()
})
