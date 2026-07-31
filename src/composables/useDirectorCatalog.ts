import type { CharKey } from '@/stores/promptBuilderStore'
import type { ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'

export interface OutfitBundle {
  id: string
  character: 'nene' | 'natsume'
  label: string
  tags: string[]
}

export const storyChips = [
  '放学后在樱花树下等人的宁宁',
  '第一次在海边看日出的夏目',
  '夏夜祭典穿浴衣看烟花',
  '雪天围围巾的温柔一瞬',
]

export const charOptions: Array<{ id: CharKey; iconName: ArchiveIconName; label: string }> = [
  { id: 'nene',    iconName: 'nene',    label: '宁宁' },
  { id: 'natsume', iconName: 'natsume', label: '夏目' },
  { id: 'triad',   iconName: 'triad',   label: '双人' },
]

export function isCharKey(value: unknown): value is CharKey {
  return value === 'nene' || value === 'natsume' || value === 'triad'
}

export const TAG_CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  Clothing: '服装',
  Action: '动作',
  Emotion: '情绪',
  Scene: '场景',
  Lighting: '光照',
  Appearance: '外观',
  Camera: '镜头',
  Style: '画风',
  Quality: '质量',
  Body: '身体',
  Mature: '成人',
  Character: '角色',
  'Official Outfit': '官方服装',
}

/**
 * UI catalog key normalization only. Prompt token policy stays inside
 * usePromptAssembly/promptPolicy so this view remains a consumer.
 */
export function normalizeCatalogKey(token: string): string {
  return String(token || '')
    .replace(/^\s*\[NEG\]\s*/i, '')
    .replace(/^\s*<lora:|>\s*$/gi, '')
    .replace(/^\s*\(+|\)+\s*$/g, '')
    .replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, '_')
}

export const OUTFIT_BUNDLES: OutfitBundle[] = [
  {
    id: 'nene-witch', character: 'nene', label: '宁宁 · 经典魔女服',
    tags: ['nene_witch_canonical', 'witch_hat', 'black_cape', 'criss-cross_halter', 'crop_top', 'strap_between_breasts', 'pink_bow', 'black_skirt', 'asymmetrical_legwear', 'striped_thighhighs', 'frilled_socks'],
  },
  {
    id: 'nene-school', character: 'nene', label: '宁宁 · 学院制服',
    tags: ['nene_school_uniform', 'school_uniform', 'blazer', 'yellow_bowtie', 'plaid_skirt', 'pleated_skirt', 'grey_skirt', 'black_thighhighs'],
  },
  {
    id: 'nene-sailor', character: 'nene', label: '宁宁 · 水手制服',
    tags: ['nene_sailor_uniform', 'grey_sailor_collar', 'black_shirt', 'sailor_shirt', 'serafuku'],
  },
  {
    id: 'nene-blue-pajamas', character: 'nene', label: '宁宁 · 蓝色睡衣',
    tags: ['nene_blue_pajamas', 'pajamas', 'animal_print', 'cat_print', 'long_sleeves'],
  },
  {
    id: 'nene-green-sleepwear', character: 'nene', label: '宁宁 · 绿色睡衣',
    tags: ['nene_green_sleepwear', 'sleepwear', 'nightgown', 'polka_dot', 'short_sleeves', 'twin_braids'],
  },
  {
    id: 'natsume-qipao', character: 'natsume', label: '夏目 · 官方旗袍',
    tags: ['natsume_official_qipao', 'chinese_clothes', 'china_dress', 'red_dress', 'floral_print', 'side_slit', 'long_sleeves', 'black_thighhighs', 'hair_bun', 'double_bun', 'hair_flower', 'red_flower'],
  },
  {
    id: 'natsume-cafe', character: 'natsume', label: '夏目 · 咖啡店制服',
    tags: ['natsume_cafe_uniform', 'white_shirt', 'suspenders', 'suspender_skirt', 'brown_skirt', 'long_sleeves', 'collared_shirt', 'purple_ribbon', 'hair_flower'],
  },
  {
    id: 'natsume-maid', character: 'natsume', label: '夏目 · 女仆服',
    tags: ['natsume_maid_uniform', 'maid', 'maid_apron', 'white_apron', 'maid_headdress', 'long_sleeves', 'frills'],
  },
  {
    id: 'natsume-sleepwear', character: 'natsume', label: '夏目 · 睡衣',
    tags: ['natsume_sleepwear', 'shirt', 'blue_shirt', 'pillow', 'on_bed'],
  },
]

export const OUTFIT_TAG_LABELS: Record<string, string> = {
  nene_witch_canonical: '宁宁魔女服主控制词',
  nene_school_uniform: '宁宁校服主控制词',
  nene_sailor_uniform: '宁宁水手服主控制词',
  nene_blue_pajamas: '宁宁蓝色睡衣主控制词',
  nene_green_sleepwear: '宁宁绿色睡衣主控制词',
  nene_red_cardigan_uniform: '宁宁红色开衫制服主控制词',
  natsume_official_qipao: '夏目旗袍主控制词',
  natsume_cafe_uniform: '夏目咖啡制服主控制词',
  natsume_maid_uniform: '夏目女仆服主控制词',
  natsume_sleepwear: '夏目睡衣主控制词',
}

export const R18_CONTROLS = [
  { character: 'nene', tag: 'nene_r18', label: '宁宁 R18' },
  { character: 'natsume', tag: 'natsume_r18', label: '夏目 R18' },
] as const

export const NON_MANUAL_TAGS = new Set([
  'masterpiece', 'best_quality', 'highly_detailed', 'absurdres', 'very_aesthetic',
  'amazing_quality', 'newest', 'ultra_detailed', 'highres', 'score_9', 'score_8_up',
  'worst_quality', 'low_quality', 'normal_quality', 'lowres', 'blurry', 'jpeg_artifacts',
  'text', 'watermark', 'logo', 'signature', 'bad_anatomy', 'bad_hands', 'extra_fingers',
  'missing_fingers', 'fused_fingers', 'extra_arms', 'extra_legs', 'deformed',
  'bad_proportions', 'duplicate', 'cropped', 'child', 'loli', 'underage',
])

export function useDirectorCatalog() {
  return {
    storyChips,
    charOptions,
    isCharKey,
    TAG_CATEGORY_LABELS,
    normalizeCatalogKey,
    OUTFIT_BUNDLES,
    OUTFIT_TAG_LABELS,
    R18_CONTROLS,
    NON_MANUAL_TAGS,
  }
}
