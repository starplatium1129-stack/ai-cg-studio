import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useVideoStore, type VideoCtxPayload } from './videoStore'

/**
 * videoStore 契约测试：
 *  - 跨页交接载荷的存/取/一次性消费
 *  - sessionStorage 持久与水合（模拟刷新后新 store 实例）
 *  - 分镜列表追加与角标派生
 */

function makeCtx(overrides: Partial<VideoCtxPayload> = {}): VideoCtxPayload {
  return {
    imageId: `img-${Math.random().toString(36).slice(2, 8)}`,
    prompt: 'a test prompt',
    story: 'a story',
    blueprintId: null,
    characterId: 'nene',
    sceneId: null,
    ...overrides,
  }
}

describe('videoStore · 单图出视频交接', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('空状态下 consume 返回 null 且不写存储', () => {
    const store = useVideoStore()
    expect(store.consumeImageCtx()).toBeNull()
    expect(sessionStorage.getItem('aics_video_ctx')).toBeNull()
  })

  it('stage 后可消费，消费即清除（一次性语义）', () => {
    const store = useVideoStore()
    const ctx = makeCtx({ imageId: 'img-once' })
    expect(store.stageImageCtx(ctx)).toBe(true)
    expect(store.pendingImageCtx?.imageId).toBe('img-once')

    const taken = store.consumeImageCtx()
    expect(taken?.imageId).toBe('img-once')
    expect(store.pendingImageCtx).toBeNull()
    expect(sessionStorage.getItem('aics_video_ctx')).toBeNull()
    expect(store.consumeImageCtx()).toBeNull()
  })

  it('stage 失败（存储抛错）时状态回滚为空', () => {
    const store = useVideoStore()
    const quotaStorage = {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      },
    } as unknown as Storage
    vi.stubGlobal('sessionStorage', quotaStorage)
    try {
      expect(store.stageImageCtx(makeCtx())).toBe(false)
      expect(store.pendingImageCtx).toBeNull()
      expect(store.appendShotCtx(makeCtx())).toBe(0)
      expect(store.shotsPending).toBe(0)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('新实例从 sessionStorage 水合（模拟路由跳转/刷新后的视频页）', () => {
    const ctx = makeCtx({ imageId: 'img-hydrate' })
    sessionStorage.setItem('aics_video_ctx', JSON.stringify(ctx))

    // 模拟全新 Pinia 实例（等价于页面刷新后重新 createApp）
    setActivePinia(createPinia())
    const fresh = useVideoStore()
    expect(fresh.pendingImageCtx?.imageId).toBe('img-hydrate')

    // 损坏载荷不致命：回退为空
    sessionStorage.setItem('aics_video_ctx', '{broken json')
    setActivePinia(createPinia())
    expect(useVideoStore().pendingImageCtx).toBeNull()
  })
})

describe('videoStore · 分镜短片批量交接', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setActivePinia(createPinia())
  })

  it('append 累积并驱动 shotsPending 角标；consume 取走全部并清零', () => {
    const store = useVideoStore()
    expect(store.shotsPending).toBe(0)

    expect(store.appendShotCtx(makeCtx())).toBe(1)
    expect(store.appendShotCtx(makeCtx({ characterId: 'natsume' }))).toBe(2)
    expect(store.shotsPending).toBe(2)

    const taken = store.consumeShotCtxs()
    expect(taken.map(c => c.characterId)).toEqual(['nene', 'natsume'])
    expect(store.shotsPending).toBe(0)
    expect(sessionStorage.getItem('aics_video_shots_ctx')).toBeNull()
  })

  it('stageShotCtxs 整批替换（bridgeShotsToVideo 的批量路径）', () => {
    const store = useVideoStore()
    store.appendShotCtx(makeCtx())

    const batch = [makeCtx(), makeCtx(), makeCtx()]
    expect(store.stageShotCtxs(batch)).toBe(true)
    expect(store.shotsPending).toBe(3)
    expect(store.consumeShotCtxs().length).toBe(3)
  })

  it('水合过滤非法条目（缺 imageId 的历史脏数据）', () => {
    sessionStorage.setItem('aics_video_shots_ctx', JSON.stringify([
      makeCtx({ imageId: 'img-good' }),
      { prompt: 'no imageId here' },
      'garbage',
    ]))
    setActivePinia(createPinia())
    const store = useVideoStore()
    expect(store.shotsPending).toBe(1)
    expect(store.consumeShotCtxs()[0].imageId).toBe('img-good')
  })
})
