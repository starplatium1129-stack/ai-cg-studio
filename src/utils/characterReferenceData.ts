import { shallowRef } from 'vue'

export interface CharacterReferenceItem {
  id: string
  name: string
  shotType: string
  fileName: string
  lens: string
  targetUsage: string[]
  url: string
}

export interface CharacterOutfitReference {
  outfitId: string
  outfitName: string
  isDefault: boolean
  isNsfw: boolean
  prose: string
  references: CharacterReferenceItem[]
}

export interface CharacterReferenceProfile {
  characterId: string
  displayName: string
  source: string
  identityProse: string
  outfits: CharacterOutfitReference[]
}

/**
 * 角色参考标准的数据本体位于 `/data/character-reference-view.json`
 * （45 角色 / 900+ 参考项）。历史上它以字面量内嵌在本模块里，
 * 导致 ~365KB 纯数据进入共享 JS chunk 且改数据必须重新构建前端；
 * 2026-08-21 起改为运行时加载，本模块只保留类型契约与加载器。
 *
 * 服务端对该文件按 no-cache + ETag 协商缓存下发（server.js PUBLIC_DATA_FILES
 * 特例），维护脚本更新 JSON 后刷新即生效，无需手动升版本号。
 */
const standards = shallowRef<Record<string, CharacterReferenceProfile>>({})
let loading: Promise<void> | null = null

/** 预取参考标准数据；视图挂载时调用一次。失败可重试（下次调用重新发起）。 */
export function ensureCharacterReferencesLoaded(): Promise<void> {
  if (!loading) {
    loading = fetch('/data/character-reference-view.json')
      .then((response) => {
        if (!response.ok) throw new Error(`character-reference-view ${response.status}`)
        return response.json() as Promise<Record<string, CharacterReferenceProfile>>
      })
      .then((data) => {
        standards.value = data
      })
      .catch((error) => {
        loading = null
        throw error
      })
  }
  return loading
}

/** 同步读取角色参考档案；数据未加载完成时返回 undefined（与未知角色同路径降级）。 */
export function getCharacterReferences(characterId: string): CharacterReferenceProfile | undefined {
  return standards.value[characterId]
}
