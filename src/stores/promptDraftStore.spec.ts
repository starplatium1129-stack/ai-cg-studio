import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePromptDraftStore } from './promptDraftStore'
import type { PromptBuilderDraft } from '@/utils/promptBuilderPersistence'

describe('promptDraftStore · 草稿防抖保存与恢复', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('dataReady=false 时不写入草稿（避免重建期空快照覆盖）', () => {
    const store = usePromptDraftStore()
    store.saveDraft(() => ({ updatedAt: Date.now(), story: 'x', subject: 'studio' } as PromptBuilderDraft), { value: false })
    vi.runAllTimers()
    expect(localStorage.getItem('aics_pb_last_draft')).toBeNull()
  })

  it('280ms 防抖：连点只落最后一份，早于防抖窗的旧快照不落盘', () => {
    const store = usePromptDraftStore()
    store.saveDraft(() => ({ updatedAt: 1, story: '第一版', subject: 'studio' } as PromptBuilderDraft), { value: true })
    vi.advanceTimersByTime(100)
    store.saveDraft(() => ({ updatedAt: 2, story: '第二版', subject: 'studio' } as PromptBuilderDraft), { value: true })
    vi.runAllTimers()
    const raw = localStorage.getItem('aics_pb_last_draft')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).story).toBe('第二版')
  })

  it('restoreDraft：无草稿返回 false 不触发 apply', () => {
    const store = usePromptDraftStore()
    const apply = vi.fn()
    expect(store.restoreDraft(apply)).toBe(false)
    expect(apply).not.toHaveBeenCalled()
  })

  it('restoreDraft：有效草稿触发 apply 并返回 true；坏 JSON 安全失败', () => {
    const store = usePromptDraftStore()
    localStorage.setItem('aics_pb_last_draft', JSON.stringify({ updatedAt: Date.now(), story: '黄昏的电车站', subject: 'studio' }))
    const apply = vi.fn()
    expect(store.restoreDraft(apply)).toBe(true)
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ story: '黄昏的电车站' }))

    localStorage.setItem('aics_pb_last_draft', '{ not json')
    expect(store.restoreDraft(vi.fn())).toBe(false)
  })

  it('applyDraftToState：场景未改动时联动场景派生字段（镜头/光线/构图/氛围）', () => {
    const store = usePromptDraftStore()
    const state = {
      story: { value: '' },
      visualDescription: { value: '' },
      char: { value: 'nene' as string },
      sceneId: { value: null as string | null },
      sceneBaseStory: { value: '' },
      selections: { emotion: [] as string[], shot: null as string | null, lighting: null as string | null, composition: null as string | null },
      colorMood: { value: null as string | null },
      manualTags: { value: new Set<string>() },
      artistStyleIds: { value: [] as string[] },
      directorMode: { value: 'basic' as 'basic' | 'pro' },
      sdParams: {} as Record<string, unknown>,
      sdParamsTouched: { value: new Set<string>() },
      projectId: { value: '' },
      subject: { value: { kind: 'studio' } },
      scenes: { value: [{ id: 'sc999', story: '深夜主卧的约定' }] },
      lastRecommendedSize: { value: '' },
    }
    store.applyDraftToState({
      updatedAt: Date.now(),
      story: '深夜主卧的约定',
      char: 'nene',
      sceneId: 'sc999',
      sceneBaseStory: '深夜主卧的约定',
      selections: { emotion: [], shot: null, lighting: null, composition: null },
      colorMood: null,
      manualTags: ['tag_a'],
      artistStyleIds: ['artist:azur'],
      directorMode: 'pro',
      sdParams: { width: 512 } as PromptBuilderDraft['sdParams'],
      sdParamsTouched: ['width'],
      projectId: 'p1',
      subject: 'studio',
      subjectKind: 'studio',
    } as unknown as PromptBuilderDraft, state as never)
    expect(state.sceneId.value).toBe('sc999')
    expect(state.story.value).toBe('深夜主卧的约定')
    expect(state.sceneBaseStory.value).toBe('深夜主卧的约定')
    // 场景联动：推荐尺寸/镜头/构图由 sceneInference 派生（fixture 无光照字段 → lighting 为 null 属正常）。
    expect(state.lastRecommendedSize.value).toBeTruthy()
    expect(state.subject.value).toEqual({ kind: 'studio' })
    expect(state.directorMode.value).toBe('pro')
    expect([...state.manualTags.value]).toEqual(['tag_a'])
  })

  it('applyDraftToState：popular 主题草稿恢复角色/服装/蓝图绑定', () => {
    const store = usePromptDraftStore()
    const state = {
      story: { value: '' },
      visualDescription: { value: '' },
      char: { value: 'nene' as string },
      sceneId: { value: null as string | null },
      sceneBaseStory: { value: '' },
      selections: { emotion: [] as string[], shot: null as string | null, lighting: null as string | null, composition: null as string | null },
      colorMood: { value: null as string | null },
      manualTags: { value: new Set<string>() },
      artistStyleIds: { value: [] as string[] },
      directorMode: { value: 'basic' as 'basic' | 'pro' },
      sdParams: {} as Record<string, unknown>,
      sdParamsTouched: { value: new Set<string>() },
      projectId: { value: '' },
      subject: { value: { kind: 'studio' } },
      scenes: { value: [] },
      lastRecommendedSize: { value: '' },
    }
    store.applyDraftToState({
      updatedAt: Date.now(),
      story: '',
      char: 'nene',
      sceneId: null,
      subject: 'popular',
      characterId: 'ayachi-nene',
      outfitId: 'nene_school_uniform',
      blueprintId: 'bp01',
      selections: { emotion: [], shot: null, lighting: null, composition: null },
      manualTags: [],
      artistStyleIds: [],
      directorMode: 'pro',
      sdParams: {},
      sdParamsTouched: [],
      projectId: '',
    } as unknown as PromptBuilderDraft, state as never)
    expect(state.subject.value).toEqual({
      kind: 'popular',
      characterId: 'ayachi-nene',
      outfitId: 'nene_school_uniform',
      blueprintId: 'bp01',
    })
  })
})
