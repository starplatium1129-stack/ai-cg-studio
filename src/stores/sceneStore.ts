import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Scene {
  id: string
  [key: string]: unknown
}

export interface CurationData {
  featured?: string[]
  tiers?: Record<string, string[]>
  [key: string]: unknown
}

export const useSceneStore = defineStore('scenes', () => {
  const scenes = ref<Scene[]>([])
  const curation = ref<CurationData>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  let fetchPromise: Promise<void> | null = null

  async function load() {
    if (scenes.value.length && Object.keys(curation.value).length) return
    if (fetchPromise) return fetchPromise
    loading.value = true
    fetchPromise = Promise.all([
      fetch('/data/scenes.json', { cache: 'no-cache' }).then(r => r.json()),
      fetch('/data/curation.json', { cache: 'no-cache' }).then(r => r.json()),
    ]).then(([sc, cu]) => {
      scenes.value = Array.isArray(sc) ? sc : (sc.scenes ?? [])
      curation.value = cu ?? {}
    }).catch(e => {
      error.value = String(e?.message ?? e)
    }).finally(() => {
      loading.value = false
      fetchPromise = null
    })
    return fetchPromise
  }

  function byId(id: string) {
    return scenes.value.find(s => s.id === id) ?? null
  }

  const count = computed(() => scenes.value.length)

  return { scenes, curation, loading, error, load, byId, count }
})
