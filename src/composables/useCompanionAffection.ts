import { ref, computed } from 'vue'
import {
  COMPANION_AFFECTION_KEY,
} from '@/utils/storageKeys'
import {
  getAffectionLevel,
  pickAffectionMotion,
  type AffectionLevelInfo,
  type AffectionMotionEntry,
} from '@/utils/companionAffection'

export interface CharacterAffectionState {
  score: number
  lastInteractedAt?: number
}

export type AffectionStoreState = Record<string, CharacterAffectionState>

const DEFAULT_SCORES: Record<string, number> = {
  natsume: 15,
  nene: 25,
}

const state = ref<AffectionStoreState>(loadInitialState())

function loadInitialState(): AffectionStoreState {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(COMPANION_AFFECTION_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed
    }
  } catch (err) {
    console.warn('[useCompanionAffection] Failed to load affection state:', err)
  }
  return {}
}

function saveState() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(COMPANION_AFFECTION_KEY, JSON.stringify(state.value))
  } catch (err) {
    console.warn('[useCompanionAffection] Failed to save affection state:', err)
  }
}

export function useCompanionAffection() {
  function getScore(character: string): number {
    const charState = state.value[character]
    if (charState && typeof charState.score === 'number') {
      return Math.max(0, Math.min(100, charState.score))
    }
    return DEFAULT_SCORES[character] ?? 10
  }

  function getLevelInfo(character: string): AffectionLevelInfo {
    return getAffectionLevel(getScore(character))
  }

  function addScore(character: string, delta: number, _reason?: string): { oldScore: number; newScore: number; levelUp: boolean } {
    const current = getScore(character)
    const next = Math.max(0, Math.min(100, current + delta))
    const oldLevel = getAffectionLevel(current).level
    const newLevel = getAffectionLevel(next).level

    state.value = {
      ...state.value,
      [character]: {
        score: next,
        lastInteractedAt: Date.now(),
      },
    }
    saveState()

    return {
      oldScore: current,
      newScore: next,
      levelUp: newLevel > oldLevel,
    }
  }

  function setScore(character: string, score: number) {
    const valid = Math.max(0, Math.min(100, Math.round(score)))
    state.value = {
      ...state.value,
      [character]: {
        score: valid,
        lastInteractedAt: Date.now(),
      },
    }
    saveState()
  }

  function resetScore(character: string) {
    const defaultScore = DEFAULT_SCORES[character] ?? 10
    setScore(character, defaultScore)
  }

  /**
   * 针对点击互动挑选合适的动作并应用好感度加成
   */
  function dispatchInteractiveMotion(character: string, group: string): {
    index: number
    entry?: AffectionMotionEntry
    bonusAwarded?: number
  } {
    const currentScore = getScore(character)
    const picked = pickAffectionMotion(character, group, currentScore)

    if (!picked) {
      return { index: 0 }
    }

    let bonusAwarded: number | undefined
    if (picked.entry.bonus && picked.entry.bonus > 0) {
      addScore(character, picked.entry.bonus, `互动动作 ${picked.entry.name}`)
      bonusAwarded = picked.entry.bonus
    }

    return {
      index: picked.index,
      entry: picked.entry,
      bonusAwarded,
    }
  }

  return {
    getScore,
    getLevelInfo,
    addScore,
    setScore,
    resetScore,
    dispatchInteractiveMotion,
    allScores: computed(() => state.value),
  }
}

