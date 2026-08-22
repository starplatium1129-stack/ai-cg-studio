import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSceneStore, DATA_VERSION } from './sceneStore'

/**
 * sceneStore 数据装载契约：
 *  - fetch 按 ?v=<DATA_VERSION> 拉取分片与元数据
 *  - 多分片合并按 sc 序号排序且跨片去重（先到先得）
 *  - 按需加载只拉目标角色分片；inflight 去重；失败落 error 态
 */

type Json = unknown
const calls: string[] = []
let routes: Record<string, Json> = {}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input)
    calls.push(url)
    const file = url.replace(/^\/data\//, '').replace(/\?.*$/, '')
    if (!(file in routes)) {
      return { ok: false, status: 404, json: async () => null } as Response
    }
    return { ok: true, status: 200, json: async () => routes[file] } as Response
  }))
}

function scene(id: string, extra: Record<string, unknown> = {}) {
  return { id, title: id, ...extra }
}

beforeEach(() => {
  calls.length = 0
  routes = {}
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('sceneStore · 全量加载', () => {
  it('load() 拉齐三分片与元数据，合并去重并按 sc 序号升序', async () => {
    routes = {
      'scenes-shared.json': [scene('sc090', { char: 'triad' }), scene('sc010')],
      'scenes-nene.json': [scene('sc080'), scene('sc090', { title: '重复的应被丢弃' })],
      'scenes-natsume.json': [scene('sc100')],
      'curation.json': {},
      'characters.json': [],
      'loras.json': [],
      'tags.json': [],
      'presets.json': [],
      'popular-characters.json': { characters: [] },
      'scene-blueprints.json': { blueprints: [] },
    }
    stubFetch()
    const store = useSceneStore()
    await store.load()

    expect(store.loaded).toBe(true)
    expect(store.scenes.map(s => s.id)).toEqual(['sc010', 'sc080', 'sc090', 'sc100'])
    // 重复 id：shared 先注册，nene 分片里的重复项被丢弃
    expect(store.scenes.find(s => s.id === 'sc090')?.title).toBe('sc090')
    // 所有请求都带缓存版本号
    expect(calls.every(u => u.includes(`v=${DATA_VERSION}`))).toBe(true)
  })

  it('force 重载会递增版本号绕过浏览器缓存', async () => {
    routes = {
      'scenes-shared.json': [], 'scenes-nene.json': [], 'scenes-natsume.json': [],
      'curation.json': {}, 'characters.json': [], 'loras.json': [], 'tags.json': [],
      'presets.json': [], 'popular-characters.json': { characters: [] }, 'scene-blueprints.json': { blueprints: [] },
    }
    stubFetch()
    const store = useSceneStore()
    await store.load()
    await store.load(true)

    const versions = new Set(calls.map(u => u.split('v=')[1]))
    expect(versions.has(String(DATA_VERSION))).toBe(true)
    expect(versions.has(String(DATA_VERSION + 1))).toBe(true)
  })
})

describe('sceneStore · 按需加载与并发去重', () => {
  beforeEach(() => {
    routes = {
      'scenes-shared.json': [scene('sc001', { char: 'triad' })],
      'scenes-nene.json': [scene('sc002')],
      'scenes-natsume.json': [scene('sc003')],
      'curation.json': {}, 'characters.json': [], 'loras.json': [], 'tags.json': [],
      'presets.json': [], 'popular-characters.json': { characters: [] }, 'scene-blueprints.json': { blueprints: [] },
    }
  })

  it('loadCharacter 只拉 shared + 目标分片', async () => {
    stubFetch()
    const store = useSceneStore()
    await store.loadCharacter('natsume')

    expect(calls.some(u => u.includes('scenes-natsume.json'))).toBe(true)
    expect(calls.some(u => u.includes('scenes-nene.json'))).toBe(false)
    expect(store.scenes.map(s => s.id).sort()).toEqual(['sc001', 'sc003'])
  })

  it('inflight 去重：并发调用只发一轮请求', async () => {
    stubFetch()
    const store = useSceneStore()
    await Promise.all([store.loadCharacter('nene'), store.loadCharacter('nene'), store.loadCharacter('nene')])

    const neneCalls = calls.filter(u => u.includes('scenes-nene.json')).length
    expect(neneCalls).toBe(1)
  })

  it('ensureCharacter 命中已加载分片时零请求重建视图', async () => {
    stubFetch()
    const store = useSceneStore()
    await store.loadCharacter('nene')
    calls.length = 0

    await store.ensureCharacter('nene')
    expect(calls.length).toBe(0)
    expect(store.scenes.map(s => s.id)).toContain('sc002')
  })

  it('分片拉取失败落 error 态并结束 loading', async () => {
    stubFetch()
    routes = {} // 全部 404
    const store = useSceneStore()
    await store.loadCharacter('nene')

    expect(store.loading).toBe(false)
    expect(store.error).toBeTruthy()
    expect(store.loaded).toBe(false)
  })
})
