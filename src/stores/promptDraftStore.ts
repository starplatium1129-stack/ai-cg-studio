import { defineStore } from 'pinia'
import { parsePromptBuilderDraft, type PromptBuilderDraft, type SDParams, isSDParamKey } from '@/utils/promptBuilderPersistence'
import { normalizeArtistStyleIds } from '@/config/artistStyles'
import { storageWriteMessage } from '@/utils/storageWriteError'
import { sceneLighting, sceneShot, sceneColorMood, sceneComposition, sceneRecommendedSize } from '@/utils/sceneInference'

export const usePromptDraftStore = defineStore('promptDraft', () => {
  const DRAFT_KEY = 'aics_pb_last_draft'
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * @param onError 写入失败回调（2026-08-30 UX 审计）。原先 `catch {}` 静默吞掉，
   *   配额写满时用户以为草稿已存、刷新即丢。调用方应把它接到 toast/flash 上。
   */
  function saveDraft(
    snapshot: () => PromptBuilderDraft,
    dataReady: { value: boolean },
    onError?: (message: string) => void,
  ) {
    if (!dataReady.value) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot()))
      } catch (e) {
        console.warn('[draft] 草稿写入失败', e)
        onError?.(storageWriteMessage(e, '草稿'))
      }
    }, 280)
  }

  function restoreDraft(apply: (d: PromptBuilderDraft) => void): boolean {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return false
      const d = parsePromptBuilderDraft(JSON.parse(raw))
      if (!d) return false
      apply(d)
      return true
    } catch { return false }
  }

  function snapshotDraftBuilder(
    story: { value: string },
    visualDescription: { value: string },
    char: { value: string },
    sceneId: { value: string | null },
    activeScene: { value: { title?: string } | null },
    selections: { emotion: string[]; shot: string | null; lighting: string | null; composition: string | null },
    colorMood: { value: string | null },
    manualTags: { value: Set<string> },
    artistStyleIds: { value: string[] },
    sceneBaseStory: { value: string },
    directorMode: { value: 'basic' | 'pro' },
    sdParams: SDParams,
    sdParamsTouched: { value: Set<keyof SDParams> },
    projectId: { value: string },
    subject: { value: { kind: string; characterId?: string; outfitId?: string; blueprintId?: string | null } },
  ): PromptBuilderDraft {
    const subjectSnapshot = subject.value.kind === 'popular'
      ? { subject: 'popular' as const, characterId: subject.value.characterId, outfitId: subject.value.outfitId, blueprintId: subject.value.blueprintId, noLora: true }
      : { subject: 'studio' as const, noLora: false }
    return {
      updatedAt: Date.now(),
      story: story.value,
      visualDescription: visualDescription.value,
      char: char.value as never,
      sceneId: sceneId.value,
      sceneTitle: activeScene.value?.title ?? null,
      selections: { emotion: [...selections.emotion], shot: selections.shot, lighting: selections.lighting, composition: selections.composition },
      colorMood: colorMood.value,
      manualTags: [...manualTags.value],
      artistStyleIds: [...artistStyleIds.value],
      sceneBaseStory: sceneBaseStory.value,
      directorMode: directorMode.value,
      sdParams: { ...sdParams },
      sdParamsTouched: [...sdParamsTouched.value],
      projectId: projectId.value,
      ...subjectSnapshot,
    }
  }

  function applyDraftToState(
    d: PromptBuilderDraft,
    state: {
      story: { value: string }
      visualDescription: { value: string }
      char: { value: string }
      sceneId: { value: string | null }
      sceneBaseStory: { value: string }
      selections: { emotion: string[]; shot: string | null; lighting: string | null; composition: string | null }
      colorMood: { value: string | null }
      manualTags: { value: Set<string> }
      artistStyleIds: { value: string[] }
      directorMode: { value: 'basic' | 'pro' }
      sdParams: SDParams
      sdParamsTouched: { value: Set<keyof SDParams> }
      projectId: { value: string }
      subject: { value: { kind: string; characterId?: string; outfitId?: string; blueprintId?: string | null } }
      scenes: { value: Array<{ id: string; story?: string; [k: string]: unknown }> }
      lastRecommendedSize: { value: string }
    },
  ) {
    if (typeof d.story === 'string') state.story.value = d.story
    if (typeof d.visualDescription === 'string') state.visualDescription.value = d.visualDescription
    if (d.char) state.char.value = d.char
    if (d.sceneId !== undefined) {
      state.sceneId.value = d.sceneId
      const currentScene = state.scenes.value.find(s => s.id === d.sceneId)
      if (currentScene) {
        state.lastRecommendedSize.value = sceneRecommendedSize(currentScene as never)
        const isUnmodifiedScene = (!d.story || d.story === currentScene.story) && (d.sceneBaseStory === currentScene.story || !d.sceneBaseStory)
        if (isUnmodifiedScene) {
          state.sceneBaseStory.value = (currentScene.story as string) ?? ''
          state.story.value = (currentScene.story as string) ?? state.story.value
          state.selections.shot = sceneShot(currentScene as never)
          state.selections.lighting = sceneLighting(currentScene as never)
          state.selections.composition = sceneComposition(currentScene as never)
          state.colorMood.value = sceneColorMood(currentScene as never)
          if (d.manualTags) state.manualTags.value = new Set(d.manualTags)
          state.artistStyleIds.value = normalizeArtistStyleIds(d.artistStyleIds)
          if (d.directorMode) state.directorMode.value = d.directorMode
          if (d.sdParams) Object.assign(state.sdParams, d.sdParams)
          if (Array.isArray(d.sdParamsTouched) && d.sdParamsTouched.length) {
            state.sdParamsTouched.value = new Set(d.sdParamsTouched.filter(key => isSDParamKey(key)) as Array<keyof SDParams>)
          }
          if (typeof d.projectId === 'string') state.projectId.value = d.projectId
          if (d.subject === 'popular' && d.characterId && d.outfitId) {
            state.subject.value = { kind: 'popular', characterId: d.characterId, outfitId: d.outfitId, blueprintId: d.blueprintId ?? null } as never
          } else {
            state.subject.value = { kind: 'studio' } as never
          }
          return
        }
      }
    }
    if (d.sceneBaseStory !== undefined) state.sceneBaseStory.value = d.sceneBaseStory
    if (d.selections) {
      state.selections.emotion = d.selections.emotion ?? []
      state.selections.shot = d.selections.shot ?? null
      state.selections.lighting = d.selections.lighting ?? null
      state.selections.composition = d.selections.composition ?? null
    }
    if (typeof d.colorMood === 'string' || d.colorMood === null) state.colorMood.value = d.colorMood
    if (d.manualTags) state.manualTags.value = new Set(d.manualTags)
    state.artistStyleIds.value = normalizeArtistStyleIds(d.artistStyleIds)
    if (d.directorMode) state.directorMode.value = d.directorMode
    if (d.sdParams) Object.assign(state.sdParams, d.sdParams)
    if (Array.isArray(d.sdParamsTouched) && d.sdParamsTouched.length) {
      state.sdParamsTouched.value = new Set(d.sdParamsTouched.filter(key => isSDParamKey(key)) as Array<keyof SDParams>)
    }
    if (typeof d.projectId === 'string') state.projectId.value = d.projectId
    if (d.subject === 'popular' && d.characterId && d.outfitId) {
      state.subject.value = { kind: 'popular', characterId: d.characterId, outfitId: d.outfitId, blueprintId: d.blueprintId ?? null } as never
    } else {
      state.subject.value = { kind: 'studio' } as never
    }
  }

  return { saveDraft, restoreDraft, snapshotDraftBuilder, applyDraftToState }
})
