import { readonly, ref } from 'vue'
import { settingsRepository, INTERFACE_SOUND_SETTING } from '../storage/settingsRepository.ts'

export type InterfaceTone = 'tap' | 'confirm' | 'warning' | 'success'

const soundEnabled = ref(false)
let initialized = false
let audioContext: AudioContext | null = null

function initialize() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  soundEnabled.value = settingsRepository.get(INTERFACE_SOUND_SETTING) ?? false
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return null
  audioContext ||= new AudioCtor()
  return audioContext
}

export function playInterfaceTone(tone: InterfaceTone = 'tap', force = false): void {
  initialize()
  if (!soundEnabled.value && !force) return
  const ctx = context()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const frequencies: Record<InterfaceTone, [number, number]> = {
    tap: [520, 430], confirm: [620, 780], warning: [260, 210], success: [660, 880],
  }
  const [from, to] = frequencies[tone]
  oscillator.type = tone === 'warning' ? 'triangle' : 'sine'
  oscillator.frequency.setValueAtTime(from, now)
  oscillator.frequency.exponentialRampToValueAtTime(to, now + .045)
  gain.gain.setValueAtTime(.0001, now)
  gain.gain.exponentialRampToValueAtTime(.035, now + .008)
  gain.gain.exponentialRampToValueAtTime(.0001, now + .065)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + .075)
}

export function useInterfaceFeedback() {
  initialize()
  function setSoundEnabled(value: boolean) {
    soundEnabled.value = value
    settingsRepository.set(INTERFACE_SOUND_SETTING, value)
    if (value) playInterfaceTone('success', true)
  }
  function toggleSound() { setSoundEnabled(!soundEnabled.value) }
  return { soundEnabled: readonly(soundEnabled), setSoundEnabled, toggleSound, playInterfaceTone }
}
