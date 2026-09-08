import type { SceneDraft } from '@/types/api'
import type { SceneBlueprint } from '@/utils/popularContent'

export interface MaintenanceRecord {
  id: string
  title: string
  category: string
  character: string
  characterName: string
  rating: string
  adult: boolean
  tier: string
  description: string
  tags: string[]
  facts: Array<{ label: string; value: string }>
  prompts: Array<{ label: string; value: string }>
  raw: SceneDraft | SceneBlueprint
  href?: string
}
const text = (value: unknown) => typeof value === 'string' ? value : ''
function facts(values: Array<[string, unknown]>) {
  return values.map(([label, value]) => ({ label, value: text(value) })).filter(item => item.value)
}
export function sceneMaintenanceRecord(scene: SceneDraft, characterName: string, tier = 'normal'): MaintenanceRecord {
  return {
    id: scene.id, title: scene.title, category: scene.category, character: scene.char, characterName,
    rating: scene.rating || 'All', adult: scene.mature === true || scene.rating === 'R18', tier,
    description: scene.story, tags: scene.tags || [], raw: scene,
    href: `/prompt-builder?scene=${encodeURIComponent(scene.id)}`,
    facts: facts([['地点', scene.location], ['时间', scene.time], ['镜头', scene.camera], ['光线', scene.lighting], ['情绪', scene.emotion], ['季节', scene.season], ['天气', scene.weather], ['尺寸', scene.recommendedSize], ['LoRA', scene.lora]]),
    prompts: [{ label: '正向提示词', value: scene.prompt }, { label: '负向提示词', value: scene.negative }, { label: 'Anima 描述', value: text(scene.animaCaption) }],
  }
}
export function blueprintMaintenanceRecord(blueprint: SceneBlueprint, characterName: string): MaintenanceRecord {
  return {
    id: blueprint.id, title: blueprint.title, category: blueprint.category,
    character: blueprint.characterId || '', characterName, tier: 'normal',
    rating: blueprint.sampleRating || (blueprint.adult ? 'R18' : 'All'), adult: blueprint.adult || blueprint.sampleRating === 'R18',
    description: [blueprint.description, blueprint.action].filter(Boolean).join('\n\n'), tags: blueprint.sceneTags || [], raw: blueprint,
    facts: facts([['地点', blueprint.location], ['时间', blueprint.timeOfDay], ['镜头', blueprint.camera], ['光线', blueprint.lighting], ['情绪', blueprint.mood], ['尺寸', blueprint.recommendedSize], ['服装 ID', blueprint.outfitId]]),
    prompts: [
      { label: '自然语言描述', value: blueprint.promptProse },
      { label: '正向词条', value: (blueprint.promptTokens || []).join(', ') },
      { label: '负向词条', value: (blueprint.negativeTokens || []).join(', ') },
      { label: '扩展描述', value: blueprint.nsfwProse || '' },
      { label: '扩展词条', value: (blueprint.nsfwTokens || []).join(', ') },
    ],
  }
}
