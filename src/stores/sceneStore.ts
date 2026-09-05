import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  parsePopularCharacters,
  parseSceneBlueprints,
  type PopularCharacter,
  type SceneBlueprint,
} from '@/utils/popularContent.ts'

/**
 * 共享数据的唯一加载口。
 *
 * 存在的理由：审计发现 `scenes.json`（~892KB / gzip ~230KB / 实测 301 条，勿在注释固化条数）被 7 处
 * 独立 fetch，用 4 种不同 cache key —— 其中 SceneManagerView 用
 * `?v=' + Date.now()`，保证每次进页面都全量重传。同时这个为"单例缓存"而建的
 * store 有 0 个消费者。
 *
 * 现在所有视图都走这里：一次网络请求，一份内存副本，一个版本号。
 */

export interface Scene {
  id: string
  [key: string]: unknown
}

export interface CurationData {
  featured?: string[]
  tiers?: Record<string, string[]>
  curatedSceneIds?: string[]
  signatureSceneIds?: string[]
  personaCoreSceneIds?: string[]
  personaCoreReasons?: Record<string, string>
  [key: string]: unknown
}

export interface LoraMeta {
  id?: string
  name?: string
  [key: string]: unknown
}

export interface SceneIndex {
  version?: number
  total?: number
  shards?: Record<string, { file: string; count: number }>
  tiers?: { core?: string[] }
  orderedIds?: string[]
}

export interface TagMeta {
  en: string
  cn: string
  cat: string
  [key: string]: unknown
}

/**
 * 静态数据的缓存版本号。
 *
 * 服务端对 /data/*.json 已按 immutable 缓存，浏览器靠 ?v= 换 URL 拿新数据，
 * 因此这个值必须与 data/*.json 的内容一一对应：scripts/maintenance/
 * validate-content-contracts.js 会用数据内容的 sha1 派生期望值并校验，
 * 改过 data/*.json 后 `npm run validate` 会提示这里该改成什么。
 * 以前是手动计数（曾到 15），现在由内容锁定，不会再出现"改数据忘升版本"。
 */
export const DATA_VERSION = 1102515296

/** 带 response.ok 检查的 JSON 读取 —— 否则 HTML 错误页会被当数据解析 */
async function loadJson<T>(file: string, fallback: T, version: number): Promise<T> {
  const response = await fetch(`/data/${file}?v=${version}`)
  if (!response.ok) throw new Error(`${file} HTTP ${response.status}`)
  const data = await response.json()
  return (data ?? fallback) as T
}

const CORE_FILE = 'scenes-core.json'
const SHARD_FILES = {
  nene: 'scenes-nene.json',
  natsume: 'scenes-natsume.json',
  shared: 'scenes-shared.json',
} as const
type ShardChar = keyof typeof SHARD_FILES

function sceneNumber(scene: Scene): number {
  const match = /^sc(\d+)$/.exec(String(scene.id || ''))
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function sortScenes(list: Scene[]): Scene[] {
  return [...list].sort((left, right) => sceneNumber(left) - sceneNumber(right))
}

function mergeScenes(...lists: Array<Scene[] | undefined>): Scene[] {
  const seen = new Set<string>()
  const out: Scene[] = []
  for (const list of lists) {
    for (const scene of list || []) {
      if (!scene || !scene.id || seen.has(scene.id)) continue
      seen.add(scene.id)
      out.push(scene)
    }
  }
  return sortScenes(out)
}

export const useSceneStore = defineStore('scenes', () => {
  const scenes = ref<Scene[]>([])
  const curation = ref<CurationData>({})
  const characters = ref<Array<Record<string, unknown>>>([])
  const loras = ref<LoraMeta[]>([])
  const tags = ref<TagMeta[]>([])
  const presets = ref<Record<string, unknown> | unknown[]>([])
  const index = ref<SceneIndex | null>(null)
  const popularCharacters = ref<PopularCharacter[]>([])
  const sceneBlueprints = ref<SceneBlueprint[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)
  /** 完整数据已加载（三条角色分片齐了才算）；部分加载只算 partial。 */
  const loaded = ref(false)
  const loadedShards = ref<Set<ShardChar>>(new Set())
  /** 手动作废缓存时递增，用于绕过浏览器缓存（场景管理保存后要读到新数据） */
  const version = ref(DATA_VERSION)

  let inflight: Promise<void> | null = null
  /** 2026-08-16 审计：inflight 槽的代际计数——只有自己这一代的 finally 才能清槽，
   *  避免 force reload 与在途 load 并发时旧 promise 把新槽误清、触发重复全量加载。 */
  let inflightGeneration = 0
  let shardCache: Partial<Record<ShardChar, Scene[]>> = {}
  let metaLoaded = false
  let coreLoaded = false

  async function loadMeta(force = false): Promise<void> {
    if (metaLoaded && !force) return
    const v = version.value
    const [cu, ch, lo, tg, pr, ix, pop, bp] = await Promise.all([
      loadJson<CurationData>('curation.json', {}, v).catch(() => ({} as CurationData)),
      loadJson<Array<Record<string, unknown>>>('characters.json', [], v).catch(() => []),
      loadJson<LoraMeta[]>('loras.json', [], v).catch(() => []),
      loadJson<TagMeta[]>('tags.json', [], v).catch(() => []),
      loadJson<Record<string, unknown> | unknown[]>('presets.json', [], v).catch(() => []),
      loadJson<SceneIndex | null>('scenes-index.json', null, v).catch(() => null),
      loadJson('popular-characters.json', { characters: [] }, v)
        .then(raw => parsePopularCharacters(raw)).catch(() => []),
      loadJson('scene-blueprints.json', { blueprints: [] }, v)
        .then(raw => parseSceneBlueprints(raw)).catch(() => []),
    ])
    curation.value = cu ?? {}
    characters.value = Array.isArray(ch) ? ch : []
    loras.value = Array.isArray(lo) ? lo : []
    tags.value = Array.isArray(tg) ? tg : []
    presets.value = pr ?? []
    index.value = ix
    popularCharacters.value = pop
    sceneBlueprints.value = bp
    metaLoaded = true
  }

  async function loadShard(char: ShardChar): Promise<Scene[]> {
    if (shardCache[char]) return shardCache[char] as Scene[]
    const list = await loadJson<Scene[]>(SHARD_FILES[char], [], version.value)
    shardCache[char] = Array.isArray(list) ? list : []
    loadedShards.value = new Set([...loadedShards.value, char])
    return shardCache[char] as Scene[]
  }

  /** 只加载某角色所需的分片（shared + 目标角色），用于场景库按需浏览。 */
  async function loadCharacter(char: string, force = false): Promise<void> {
    if (inflight) return inflight
    const shard = char === 'natsume' ? 'natsume' : char === 'triad' || char === 'shared' ? 'shared' : 'nene'
    if (force) { shardCache[shard] = undefined; loadedShards.value = new Set() }
    loading.value = true
    error.value = null
    const generation = ++inflightGeneration
    inflight = (async () => {
      await loadMeta()
      const [shared, target] = await Promise.all([loadShard('shared'), loadShard(shard)])
      scenes.value = mergeScenes(shared, target)
    })()
      .catch((e) => { error.value = String((e as Error)?.message ?? e) })
      .finally(() => {
        loading.value = false
        if (generation === inflightGeneration) inflight = null
      })
    return inflight
  }

  /** 只加载默认"人设核心"视图所需的数据（index + shared + core 精选子集）。 */
  async function loadCore(force = false): Promise<void> {
    if (inflight) return inflight
    if (force) { shardCache = {}; loadedShards.value = new Set() }
    loading.value = true
    error.value = null
    const generation = ++inflightGeneration
    inflight = (async () => {
      await loadMeta()
      const [shared, core] = await Promise.all([
        loadShard('shared'),
        loadJson<Scene[]>(CORE_FILE, [], version.value),
      ])
      scenes.value = mergeScenes(shared, Array.isArray(core) ? core : [])
      coreLoaded = true
    })()
      .catch((e) => { error.value = String((e as Error)?.message ?? e) })
      .finally(() => {
        loading.value = false
        if (generation === inflightGeneration) inflight = null
      })
    return inflight
  }

  function ensureCharacter(char: string): Promise<void> {
    if (loaded.value) return Promise.resolve()
    const shard = char === 'natsume' ? 'natsume' : char === 'triad' || char === 'shared' ? 'shared' : 'nene'
    if (loadedShards.value.has(shard)) {
      // 目标分片已在手：直接用 shared + 目标分片重建视图，不发请求。
      const shared = shardCache.shared || []
      const target = shardCache[shard] || []
      scenes.value = mergeScenes(shared, target)
      return Promise.resolve()
    }
    return loadCharacter(char)
  }

  function ensureCore(): Promise<void> {
    if (loaded.value || coreLoaded) return Promise.resolve()
    return loadCore()
  }

  /**
   * 加载共享数据集。重复调用只发一次请求；已加载则直接返回。
   * @param force 场景管理保存后需要读回落盘结果时传 true
   */
  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    if (inflight && !force) return inflight
    if (force) version.value += 1

    loading.value = true
    error.value = null

    const generation = ++inflightGeneration
    inflight = (async () => {
      if (force) { shardCache = {}; loadedShards.value = new Set() }
      await loadMeta(force)
      const [shared, nene, natsume] = await Promise.all([
        loadShard('shared'),
        loadShard('nene'),
        loadShard('natsume'),
      ])
      scenes.value = mergeScenes(shared, nene, natsume)
      loaded.value = true
    })()
      .catch((e) => {
        error.value = String((e as Error)?.message ?? e)
      })
      .finally(() => {
        loading.value = false
        if (generation === inflightGeneration) inflight = null
      })

    return inflight
  }

  /** 场景管理写回 data/ 之后调用 */
  function reload() {
    loaded.value = false
    shardCache = {}
    loadedShards.value = new Set()
    metaLoaded = false
    return load(true)
  }

  function byId(id: string) {
    return scenes.value.find((s) => s.id === id) ?? null
  }

  const count = computed(() => scenes.value.length)

  return {
    scenes, curation, characters, loras, tags, presets, index,
    popularCharacters, sceneBlueprints,
    loading, error, loaded, loadedShards, version,
    load, loadCharacter, loadCore, ensureCharacter, ensureCore, reload, byId, count,
  }
})
