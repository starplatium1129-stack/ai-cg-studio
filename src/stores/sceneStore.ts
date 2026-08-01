import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 共享数据的唯一加载口。
 *
 * 存在的理由：审计发现 `scenes.json`（892KB / gzip 230KB / 297 条）被 7 处
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
export const DATA_VERSION = 1373702618

/** 带 response.ok 检查的 JSON 读取 —— 否则 HTML 错误页会被当数据解析 */
async function loadJson<T>(file: string, fallback: T, version: number): Promise<T> {
  const response = await fetch(`/data/${file}?v=${version}`)
  if (!response.ok) throw new Error(`${file} HTTP ${response.status}`)
  const data = await response.json()
  return (data ?? fallback) as T
}

export const useSceneStore = defineStore('scenes', () => {
  const scenes = ref<Scene[]>([])
  const curation = ref<CurationData>({})
  const characters = ref<Array<Record<string, unknown>>>([])
  const loras = ref<LoraMeta[]>([])
  const tags = ref<TagMeta[]>([])
  const presets = ref<Record<string, unknown> | unknown[]>([])

  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)
  /** 手动作废缓存时递增，用于绕过浏览器缓存（场景管理保存后要读到新数据） */
  const version = ref(DATA_VERSION)

  let inflight: Promise<void> | null = null

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
    const v = version.value

    inflight = (async () => {
      // 允许部分失败：场景库拿不到才算致命，其余降级为空
      const [sc, cu, ch, lo, tg, pr] = await Promise.all([
        loadJson<Scene[]>('scenes.json', [], v),
        loadJson<CurationData>('curation.json', {}, v).catch(() => ({} as CurationData)),
        loadJson<Array<Record<string, unknown>>>('characters.json', [], v).catch(() => []),
        loadJson<LoraMeta[]>('loras.json', [], v).catch(() => []),
        loadJson<TagMeta[]>('tags.json', [], v).catch(() => []),
        loadJson<Record<string, unknown> | unknown[]>('presets.json', [], v).catch(() => []),
      ])

      scenes.value = Array.isArray(sc) ? sc : ((sc as { scenes?: Scene[] }).scenes ?? [])
      curation.value = cu ?? {}
      characters.value = Array.isArray(ch) ? ch : []
      loras.value = Array.isArray(lo) ? lo : []
      tags.value = Array.isArray(tg) ? tg : []
      presets.value = pr ?? []
      loaded.value = true
    })()
      .catch((e) => {
        error.value = String((e as Error)?.message ?? e)
      })
      .finally(() => {
        loading.value = false
        inflight = null
      })

    return inflight
  }

  /** 场景管理写回 data/ 之后调用 */
  function reload() {
    loaded.value = false
    return load(true)
  }

  function byId(id: string) {
    return scenes.value.find((s) => s.id === id) ?? null
  }

  const count = computed(() => scenes.value.length)

  return {
    scenes, curation, characters, loras, tags, presets,
    loading, error, loaded, version,
    load, reload, byId, count,
  }
})
