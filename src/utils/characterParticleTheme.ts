import type { ParticleShapeId } from './particleShapes'

/**
 * 角色 → 粒子主题映射（2026-08-16）：
 * 角色场景库 / 角色档案 / 导演台的粒子场共用这一份「每个角色有自己的粒子轮廓
 * 与主色」的语义。优先级：角色级覆盖 → 作品级默认 → 按 id 稳定散列兜底，
 * 同一角色在任何页面拿到的主题一致，新增角色无需改代码即可获得稳定主题。
 */
export interface CharacterParticleTheme {
  shape: ParticleShapeId
  /** tone-2 粒子高亮色；消费方写入实例级 `--archive-blue` 覆盖。 */
  accent: string
  /** 背景光环主色；消费方可写入实例级 `--character-aura` 覆盖。 */
  aura: string
}

interface ThemeSeed {
  shape: ParticleShapeId
  /** 1-2 个品牌色，缺省由补全函数配对。 */
  colors?: [string] | [string, string]
}

/** 角色级覆盖：形状尽量贴合角色意象（雷电=spark、女仆萌系=heart、魔女之夜=moon…）。 */
const CHARACTER_SEEDS: Record<string, ThemeSeed> = {
  // 工作室角色
  nene: { shape: 'moon', colors: ['#b895ff', '#f4a6d7'] },
  natsume: { shape: 'lantern', colors: ['#f2bb68', '#8b6258'] },
  // 热门角色
  rem_rezero: { shape: 'heart', colors: ['#5a96ff', '#d28cf0'] },
  emilia_rezero: { shape: 'spark', colors: ['#cdb4ff', '#e8f0ff'] },
  raiden_shogun: { shape: 'spark', colors: ['#9455ff', '#ebb94b'] },
  sakurajima_mai: { shape: 'moon', colors: ['#5a78f0', '#f0a0d2'] },
  tokisaki_kurumi: { shape: 'moon', colors: ['#dc1e3c', '#dcaa3c'] },
  frieren: { shape: 'spark', colors: ['#64d2f0', '#d2ebff'] },
  artoria_pendragon: { shape: 'frame', colors: ['#2d87ff', '#f5c84b'] },
  tohsaka_rin: { shape: 'spark', colors: ['#e0457a', '#64beff'] },
  illyasviel_von_einzbern: { shape: 'heart', colors: ['#ffb3d9', '#ffe9f4'] },
  misaka_mikoto: { shape: 'spark', colors: ['#ffa028', '#64beff'] },
  hatsune_miku: { shape: 'spark', colors: ['#39c5bb', '#a8f0ea'] },
  yuzuriha_inori: { shape: 'heart', colors: ['#ff73a0', '#78d2ff'] },
  yukinoshita_yukino: { shape: 'moon', colors: ['#a8c8ff', '#f0f4ff'] },
  elaina: { shape: 'moon', colors: ['#b39ddb', '#e6dcff'] },
  makima: { shape: 'frame', colors: ['#d9435f', '#e8b04b'] },
  roxy_migurdia: { shape: 'book', colors: ['#5b7bd6', '#a8c0f0'] },
  kitagawa_marin: { shape: 'heart', colors: ['#ff5c8a', '#ffd166'] },
  kisara_engage_kiss: { shape: 'heart', colors: ['#ff6fa5', '#ffb3c8'] },
  surtr_arknights: { shape: 'spark', colors: ['#ff5b45', '#ffb36b'] },
  kaltsit_arknights: { shape: 'frame', colors: ['#7fe3d2', '#cfeee6'] },
  chen_arknights: { shape: 'frame', colors: ['#ffd166', '#ff9a3d'] },
  eyjafjalla_arknights: { shape: 'mountain', colors: ['#ff7a3d', '#ffd0a3'] },
  lemuen_arknights: { shape: 'lantern', colors: ['#ffe9b0', '#d9c48a'] },
  dusk_arknights: { shape: 'book', colors: ['#8a7bff', '#cdb9ff'] },
  mudrock_arknights: { shape: 'mountain', colors: ['#b0937a', '#e3cdb8'] },
}

/** 作品级默认：同作品新角色先拿到贴合作品气质的形状。 */
const FRANCHISE_SEEDS: Record<string, ThemeSeed> = {
  'Arknights': { shape: 'mountain', colors: ['#8fd3c7', '#cfeee6'] },
  'Re:Zero': { shape: 'heart', colors: ['#5a96ff', '#d28cf0'] },
  'Fate': { shape: 'frame', colors: ['#ffd76a', '#f5c84b'] },
  'Fate/stay night': { shape: 'frame', colors: ['#ffd76a', '#f5c84b'] },
  'Genshin Impact': { shape: 'spark', colors: ['#9455ff', '#ebb94b'] },
}

const FALLBACK_SHAPES: ParticleShapeId[] = ['atelier', 'heart', 'cup', 'moon', 'book', 'mountain', 'lantern', 'frame', 'spark']
const FALLBACK_ACCENTS = ['#8fb7ff', '#f4a6d7', '#7fe3d2', '#ffd166', '#c9a0ff', '#ff9a8d', '#a8e6c9', '#ffb3d9']

function hashString(value: string): number {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return hash >>> 0
}

function completeTheme(id: string, seed: ThemeSeed): CharacterParticleTheme {
  const hash = hashString(id)
  const colors = seed.colors ?? []
  const accent = colors[0] ?? FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length]
  const aura = colors[1] ?? FALLBACK_ACCENTS[(hash >>> 3) % FALLBACK_ACCENTS.length]
  return { shape: seed.shape, accent, aura }
}

export function characterParticleTheme(id: string, franchise?: string): CharacterParticleTheme {
  if (!id) {
    return { shape: FALLBACK_SHAPES[0], accent: FALLBACK_ACCENTS[0], aura: FALLBACK_ACCENTS[1] }
  }
  const characterSeed = CHARACTER_SEEDS[id]
  if (characterSeed) return completeTheme(id, characterSeed)
  const franchiseSeed = franchise ? FRANCHISE_SEEDS[franchise] : undefined
  if (franchiseSeed) return completeTheme(id, franchiseSeed)
  return completeTheme(id, { shape: FALLBACK_SHAPES[hashString(id) % FALLBACK_SHAPES.length] })
}
