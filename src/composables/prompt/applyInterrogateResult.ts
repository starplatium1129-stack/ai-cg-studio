import type { usePromptBuilderStore } from '@/stores/promptBuilderStore'
import { defaultOutfit, findBlueprint, findCharacter, findOutfit } from '@/utils/popularContent'

export async function applyInterrogateResult(pb: ReturnType<typeof usePromptBuilderStore>, result: unknown) {
  if (!result || typeof result !== 'object') return
  const { characterConflictNote, collectInterrogateContext, mergeInterrogatedTags } = await import('@/utils/interrogateMerge')
  const payload = result as { mode?: string; caption?: string; tags?: unknown; characterTags?: unknown; warning?: string }
  if (payload.mode === 'caption' && typeof payload.caption === 'string' && payload.caption.trim()) {
    pb.visualDescription = String(payload.caption).trim()
    pb.flash('已反推为自然语言，已填入画面描述（Krea2 直出，切人保留）')
    const warning = payload.warning
    if (warning) setTimeout(() => pb.flash(warning), 2600)
    return
  }
  const tags: string[] = Array.isArray(payload.tags) ? (payload.tags as string[]) : []
  const characterTags: string[] = Array.isArray(payload.characterTags) ? (payload.characterTags as string[]) : []
  // 三重去重 + 身份域冲突消解（studio：charPrompt+场景行；popular：角色词条+蓝图行）
  const subject = pb.subject
  const popularChar = subject.kind === 'popular' ? findCharacter(pb.popularCharacters, subject.characterId) : null
  const context = collectInterrogateContext(subject.kind === 'popular'
    ? {
        kind: 'popular',
        character: popularChar
          ? {
              identityTokens: popularChar.identityTokens,
              exactTokens: popularChar.exactTokens,
              outfitTokens: (findOutfit(popularChar, subject.outfitId) ?? defaultOutfit(popularChar))?.tokens,
            }
          : null,
        blueprintTokens: subject.blueprintId ? findBlueprint(pb.sceneBlueprints, subject.blueprintId)?.promptTokens ?? [] : [],
      }
    : {
        kind: 'studio',
        charPrompt: pb.charPrompt,
        scenePrompt: pb.activeScene?.prompt,
        sceneTags: pb.activeScene?.tags,
      })
  const merged = mergeInterrogatedTags({
    tags,
    manualTags: pb.manualTags,
    identityTokens: context.identityTokens,
    sceneTokens: context.sceneTokens,
  })
  for (const tag of merged.accepted) pb.toggleManualTag(tag)
  // 服装跨族：顶替角色默认服装，而不是追加到 manualTags —— 追加会被角色那 12 个
  // 服装 tag 与 "She wears ..." 散文淹没，参考图服装根本出不来（2026-08-29 实测）。
  // 仅 popular 需要：studio（宁宁/夏目）无默认服装注入，反推词直接生效。
  if (subject.kind === 'popular' && merged.outfitReplacement.length) {
    pb.setOutfitOverride(merged.outfitReplacement, merged.replacedOutfitGroup)
  }
  const note = characterConflictNote(characterTags, context.identityTokens)
  const parts: string[] = []
  if (merged.accepted.length) parts.push(`本地反推已叠加 ${merged.accepted.length} 个词条，可切人直出`)
  if (merged.duplicates.length) parts.push(`跳过已有词条 ${merged.duplicates.length} 个`)
  if (merged.outfitReplacement.length) {
    const from = merged.replacedOutfitGroup ? `（原${merged.replacedOutfitGroup}）` : ''
    parts.push(`已用参考图服装顶替角色默认服装${from}：${merged.outfitReplacement.slice(0, 3).join('、')}`)
  }
  if (merged.conflicts.length) {
    // 只列 tag 名（swimsuit）用户看不懂为什么被拦，故优先展示 reason
    // （含「反推出什么 / 当前是什么 / 怎么改」）。冲突含身份域与互斥组两类。
    const first = merged.conflicts[0]
    const detail = merged.conflicts.length === 1
      ? first.reason
      : `${first.reason} 等 ${merged.conflicts.length} 项`
    parts.push(`跳过冲突词条 ${merged.conflicts.length} 个：${detail}`)
  }
  if (note) parts.push(note)
  pb.flash(parts.length ? parts.join('；') : '反推完成，无新增词条')
  const warning = payload.warning
  if (warning) setTimeout(() => pb.flash(warning), 2600)
}

