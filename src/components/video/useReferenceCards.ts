import { ref, type Ref } from 'vue'
import { getCharacterReferences } from '@/utils/characterReferenceData'
import type { VideoImageUploadResponse } from '@/api/videoApi'

/**
 * 分镜编辑器·角色参考卡（Ref2VA）编排（2026-08-22 自 ShotListEditor 下沉）。
 * 支持 1~4 个角色槽，每槽最多 4 张 4 视角参考图；负责参考图的自动装配
 * （角色→服装→4 视角基准图）、手动上传、身份锚点 prose 合并。
 */

export interface ReferenceImage {
  name: string
  url: string
}

export interface ReferenceCard {
  label: string
  characterId?: string
  outfitId?: string
  images: ReferenceImage[]
}

/** 镜头草稿中与本簇相关的最小结构（cast: 'all' | 角色序号串如 '12'）。 */
export interface ShotCastRef {
  cast?: string
}

export interface ReferenceCardsDeps {
  /** 多角色身份锚点合并结果（分镜提示词注入用），由宿主持有。 */
  identityCard: Ref<string>
  /** 本簇的用户可见错误回写（尺寸/上传失败等）。 */
  batchError: Ref<string>
  readBlobAsDataURL: (blob: Blob) => Promise<string>
  uploadVideoImage: (base64: string, kind?: 'reference', signal?: AbortSignal) => Promise<VideoImageUploadResponse>
}

const MAX_CARDS = 4
const MAX_IMAGES_PER_CARD = 4

export function useReferenceCards(deps: ReferenceCardsDeps) {
  const referenceCards = ref<ReferenceCard[]>([
    { label: '', images: [] },
    { label: '', images: [] },
  ])
  const referenceInputs = ref<HTMLInputElement[]>([])
  const loadingRefAssets = ref(false)
  const loadingRefCardIndex = ref<number | null>(null)

  function getCharOutfits(charId?: string) {
    if (!charId) return []
    const profile = getCharacterReferences(charId)
    return profile?.outfits || []
  }

  function addReferenceCard() {
    if (referenceCards.value.length >= MAX_CARDS) return
    referenceCards.value.push({ label: '', images: [] })
  }

  function removeReferenceCard(index: number) {
    if (referenceCards.value.length <= 1) return
    const card = referenceCards.value[index]
    if (card) {
      card.images.forEach(img => { if (img.url) URL.revokeObjectURL(img.url) })
    }
    referenceCards.value.splice(index, 1)
    updateMultiCharacterIdentity()
  }

  async function switchCardOutfit(cardIndex: number, outfitId: string) {
    const card = referenceCards.value[cardIndex]
    if (!card || !card.characterId) return
    await autoLoadCharacterReferences(card.characterId, cardIndex, outfitId)
  }

  async function autoLoadCharacterReferences(charId: string, cardIndex: number = 0, outfitId?: string) {
    const profile = getCharacterReferences(charId)
    if (!profile) return

    if (cardIndex < 0 || cardIndex >= referenceCards.value.length) return
    const targetCard = referenceCards.value[cardIndex]

    // 匹配特定 outfit 或默认 outfit
    let chosenOutfit = profile.outfits.find(o => o.outfitId === outfitId)
    if (!chosenOutfit) {
      chosenOutfit = profile.outfits.find(o => o.isDefault) || profile.outfits[0]
    }

    // 记录角色元信息
    targetCard.characterId = charId
    targetCard.outfitId = chosenOutfit?.outfitId || ''
    targetCard.label = profile.displayName + (chosenOutfit && !chosenOutfit.isDefault ? ` · ${chosenOutfit.outfitName}` : '')

    // 释放原有旧图
    targetCard.images.forEach((img) => {
      if (img.url) URL.revokeObjectURL(img.url)
    })
    targetCard.images = []

    loadingRefAssets.value = true
    loadingRefCardIndex.value = cardIndex
    try {
      // 自动加载全部 4 张基准图（特写 / 半身 / 全身 / 侧后背影）
      // 关键修复：加入时间戳与 no-cache，杜绝浏览器拉取旧缓存图片
      const targets = chosenOutfit?.references.slice(0, MAX_IMAGES_PER_CARD) || []
      for (const item of targets) {
        const imgUrl = `${item.url}?t=${Date.now()}`
        const resp = await fetch(imgUrl, { cache: 'no-cache' })
        if (!resp.ok) continue
        const blob = await resp.blob()
        const dataUrl = await deps.readBlobAsDataURL(blob)
        const comma = dataUrl.indexOf(',')
        if (comma < 0) continue
        const upload = await deps.uploadVideoImage(dataUrl.slice(comma + 1), 'reference')
        targetCard.images.push({
          name: upload.name,
          url: URL.createObjectURL(blob),
        })
      }
      updateMultiCharacterIdentity()
    } catch (error) {
      console.warn(`[ShotList] 自动装配角色 ${cardIndex + 1} 标准参考图失败:`, error)
    } finally {
      loadingRefAssets.value = false
      loadingRefCardIndex.value = null
    }
  }

  /**
   * 智能更新多角色身份锚点：
   * 将所有已装配角色的身份描述合并（单角色直接注入；多角色按 Role 1 / Role 2 结构化组织），
   * 包含对特定服装（outfit prose）的细粒度描述拼接。
   */
  function updateMultiCharacterIdentity() {
    const activeDescriptions: string[] = []
    referenceCards.value.forEach((card, idx) => {
      if (!card.characterId && !card.label) return
      const profile = card.characterId ? getCharacterReferences(card.characterId) : undefined
      const baseProse = profile?.identityProse || ''
      const outfitObj = profile?.outfits?.find(o => o.outfitId === card.outfitId)
      const outfitProse = outfitObj?.prose ? `, ${outfitObj.prose}` : ''
      const fullProse = (baseProse + outfitProse).trim()

      if (fullProse) {
        const displayName = profile?.displayName || card.label
        activeDescriptions.push(
          referenceCards.value.length > 1
            ? `[Character ${idx + 1} - ${displayName}]: ${fullProse}`
            : fullProse
        )
      }
    })

    if (activeDescriptions.length > 0) {
      deps.identityCard.value = activeDescriptions.join('\n\n')
    }
  }

  async function onCardCharacterSelected(cardIndex: number, event: Event) {
    const select = event.target as HTMLSelectElement
    const charId = select.value
    if (!charId) return

    // 装配参考图到对应卡槽
    await autoLoadCharacterReferences(charId, cardIndex)
  }

  async function onReferencePicked(cardIndex: number, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const card = referenceCards.value[cardIndex]
    if (card.images.length >= MAX_IMAGES_PER_CARD) {
      deps.batchError.value = '每个角色最多 4 张参考图（4 视角）'
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      deps.batchError.value = '参考图需 ≤20MB'
      return
    }
    try {
      const dataUrl = await deps.readBlobAsDataURL(file)
      const comma = dataUrl.indexOf(',')
      if (comma < 0) throw new Error('图片编码失败')
      const upload = await deps.uploadVideoImage(dataUrl.slice(comma + 1), 'reference')
      card.images.push({ name: upload.name, url: URL.createObjectURL(file) })
      deps.batchError.value = ''
    } catch (error) {
      deps.batchError.value = error instanceof Error ? error.message : '参考图上传失败'
    }
  }

  function pickReference(cardIndex: number) {
    referenceInputs.value[cardIndex]?.click()
  }

  function setReferenceInput(el: unknown, cardIndex: number) {
    if (el) referenceInputs.value[cardIndex] = el as HTMLInputElement
  }

  function removeReference(cardIndex: number, imageIndex: number) {
    const image = referenceCards.value[cardIndex].images[imageIndex]
    if (image?.url) URL.revokeObjectURL(image.url)
    referenceCards.value[cardIndex].images.splice(imageIndex, 1)
  }

  /** 镜头 → 参考图文件名数组（按出场角色合并参考卡，最多 9 张 Ref2VA）。 */
  function shotReferences(shot: ShotCastRef): string[] | undefined {
    if (!shot.cast) return undefined
    const collect = (cardIndex: number) => (referenceCards.value[cardIndex]?.images ?? []).map(image => image.name)

    let list: string[] = []
    if (shot.cast === 'all') {
      referenceCards.value.forEach((_, idx) => {
        list.push(...collect(idx))
      })
    } else if (/^\d+$/.test(shot.cast)) {
      const indices = shot.cast.split('').map(c => Number(c) - 1)
      indices.forEach(idx => {
        if (idx >= 0 && idx < referenceCards.value.length) {
          list.push(...collect(idx))
        }
      })
    }

    // 数组去重并限制在 Ref2VA 允许的 9 张以内
    const unique = Array.from(new Set(list)).slice(0, 9)
    return unique.length ? unique : undefined
  }

  return {
    referenceCards,
    referenceInputs,
    loadingRefAssets,
    loadingRefCardIndex,
    getCharOutfits,
    addReferenceCard,
    removeReferenceCard,
    switchCardOutfit,
    autoLoadCharacterReferences,
    onCardCharacterSelected,
    onReferencePicked,
    pickReference,
    setReferenceInput,
    removeReference,
    shotReferences,
  }
}
