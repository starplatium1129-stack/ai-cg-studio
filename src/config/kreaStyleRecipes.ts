// Krea 风格配方 —— 官方散文段结构的风格层（数据 + 纯函数，无 DOM）。
//
// 依据 Krea 2 官方配方（docs.krea.ai Turbo / github krea-2 prompting.md）：
//   1. 风格语言放最前（"Add style language early"）；
//   2. 每配方 = 前置风格短语 lead + 可选后置媒介词 medium；
//   3. R18 配方独立、显式声明，只有 adultEligibility === 'adult' 且成熟内容
//      开关同时开启时才可达，unknown / underage 永远不可达（fail closed）。
//
// 2026-08-30 Krea2 提示词调研报告（docs/krea2-prompt-research-2026-08-30.md）落地：
//   - 动漫向配方 lead 统一补「平涂词族」（§5.3）：Krea 2 默认偏厚涂/半写实，
//     'polished' 词又引导光泽，二次元出图「油、糊、厚」；对策是明写
//     flat cel shading / flat colors / crisp line art / clean linework。
//   - 真人/电影向配方补「光线材质语言」（§6.2）：film grain、softbox 等可测量
//     光学线索比 ultra detailed 有用；质量词（8k/masterpiece）一律不进入配方。
//
// 该模块只负责解析配方与资格判定，不关心引擎渲染；Krea 用 lead+medium 织入
// 散文段，Anima 只取 lead 作风格短语前缀，渲染仍由 createPromptPlan +
// renderPromptPlan 单一入口完成。

export type RecipeEngine = 'sd' | 'krea2' | 'anima'

export interface KreaStyleRecipe {
  id: string
  name: string
  /** 前置风格短语（放正文最前）。 */
  lead: string
  /** 可选后置媒介词（放散文段末尾）。 */
  medium?: string
  /** Concise model-native fragments. Legacy lead remains the Krea prose source. */
  sd?: string
  /** 成人配方：仅 adult 角色 + 成熟内容开关同时放行。 */
  adult: boolean
}

/** 资格判定只依赖角色的成人资格形状，避免与 popularContent 循环依赖。 */
export interface StyleEligibility {
  adultEligibility: 'adult' | 'unknown' | 'underage'
}

/** 蓝图 hint 只做结构性声明，交给本模块解析。 */
export interface StyleBlueprintHint {
  kreaStyleHint?: string
  animaStyleHint?: string
}

/** 已解析可用的风格：lead 必填，medium/adult 可选。 */
export interface ResolvedStyle {
  lead: string
  medium?: string
  sd?: string
  adult?: boolean
}

export const KREA_STYLE_RECIPES: readonly KreaStyleRecipe[] = Object.freeze([
  // ── 动漫/插画向（平涂词族 lead，2026-08-30 调研 §5.3 落地）─────────────
  { id: 'anime_key_visual', name: 'Anime 主视觉', lead: 'A vibrant anime key visual with crisp line art, flat cel shading and saturated colors', sd: 'anime key visual, clean lineart, flat cel shading, saturated colors', medium: 'anime key visual', adult: false },
  { id: 'vn_event_cg', name: '视觉小说事件 CG', lead: 'A polished visual novel event CG with refined cel shading, flat colors and crisp character work', sd: 'visual novel event CG, refined cel shading, flat colors, crisp character work', medium: 'visual novel event CG', adult: false },
  { id: 'light_novel_cover', name: '轻小说封面', lead: 'A polished light novel cover illustration with clean line art, flat colors and a clear character-forward composition', sd: 'light novel cover, clean lineart, flat colors, character-focused composition, polished illustration', medium: 'light novel cover illustration', adult: false },
  { id: 'cinematic_film_still', name: '电影感剧照', lead: 'A cinematic film still with dramatic depth, natural film grain and a carefully balanced frame', sd: 'cinematic lighting, dramatic depth, film grain, balanced composition', medium: 'film still', adult: false },
  { id: 'soft_daily_illustration', name: '柔和日常插画', lead: 'A soft, warm daily-life illustration with gentle tones, clean linework and an unhurried mood', sd: 'soft daily illustration, warm gentle tones, clean linework', medium: 'daily-life illustration', adult: false },
  { id: 'fantasy_painting', name: '奇幻厚涂绘画', lead: 'A richly detailed fantasy painting with painterly brushwork and atmospheric depth', sd: 'fantasy painting, painterly brushwork, atmospheric depth', medium: 'fantasy painting', adult: false },
  { id: 'anime_promo_art', name: 'Anime 宣传主图', lead: 'A striking anime promo art with bold dynamic composition, flat cel shading and vivid color contrast', sd: 'anime promo art, dynamic composition, flat cel shading, vivid colors', medium: 'anime promo art', adult: false },
  { id: 'dreamy_pastel', name: '梦幻粉彩', lead: 'A dreamy pastel illustration bathed in soft diffused light with smooth flat colors', sd: 'dreamy pastel, soft diffused light, smooth flat colors', medium: 'dreamy pastel art', adult: false },
  { id: 'moody_night_scene', name: '氛围夜景', lead: 'A moody night scene with deep shadows, flat colors and a quiet atmospheric glow', sd: 'moody night scene, deep shadows, flat colors, atmospheric glow', medium: 'nocturne illustration', adult: false },
  { id: 'cel_1990s', name: '1990s 赛璐璐动画', lead: 'A 1990s cel anime illustration with bold outlines, crisp line art and nostalgic flat colors', sd: '1990s cel anime, bold outlines, crisp lineart, nostalgic flat colors', medium: 'retro cel anime illustration', adult: false },
  { id: 'shoujo_manga', name: '少女漫画', lead: 'A delicate shoujo manga illustration with expressive eyes, clean line art and airy romantic framing', sd: 'shoujo manga, expressive eyes, clean lineart, romantic framing', medium: 'shoujo manga illustration', adult: false },
  { id: 'soft_watercolor', name: '柔和水彩', lead: 'A soft watercolor illustration with translucent washes and paper texture', sd: 'soft watercolor, translucent washes, paper texture', medium: 'watercolor illustration', adult: false },
  { id: 'ink_wash_darkbrush', name: '水墨·暗刷', lead: 'An ink wash and dark brush illustration with expressive monochrome texture', sd: 'ink wash, dark brush, monochrome texture', medium: 'ink wash illustration', adult: false },
  { id: 'neon_abstract', name: '霓虹抽象', lead: 'A neon abstract artwork with luminous gradients and energetic graphic shapes', sd: 'neon abstract, luminous gradients, graphic shapes', medium: 'neon abstract artwork', adult: false },
  { id: 'rainy_window', name: '雨窗氛围', lead: 'A rainy-window atmosphere with diffused reflections, clean linework and intimate quiet light', sd: 'rainy window, diffused reflections, clean linework, intimate light', medium: 'rainy-window illustration', adult: false },
  { id: 'vintage_tarot', name: '复古塔罗海报', lead: 'A vintage tarot poster with ornate symbolism, crisp line art, aged print texture, and restrained colors', sd: 'vintage tarot, ornate symbolism, crisp lineart, aged print texture', medium: 'vintage tarot poster', adult: false },
  // ── 成人配方（动漫平涂词族同样适用，避免厚涂写实）───────────────────────
  { id: 'r18_sensual_cg', name: '成人·私密光影', lead: 'An explicit nude illustration: a completely naked mature woman with her bare breasts and nipples clearly visible, clean cel shading and flat colors, intimate warm lighting and a soft-focus finish', medium: 'sophisticated mature illustration', adult: true },
  { id: 'r18_elegant_boudoir', name: '成人·典雅闺阁', lead: 'An explicit nude boudoir scene: a fully naked mature woman, bare breasts fully exposed, rendered with clean cel shading, flat colors, tasteful restraint and warm candlelight', medium: 'refined adult illustration', adult: true },
])

/** 各引擎缺省配方：场景模式与「自动」时使用，蓝图 hint 优先于它。 */
const ENGINE_DEFAULT: Readonly<Record<RecipeEngine, string>> = Object.freeze({
  sd: 'anime_key_visual',
  krea2: 'vn_event_cg',
  anima: 'anime_key_visual',
})

export function defaultRecipeId(engine: RecipeEngine): string {
  return ENGINE_DEFAULT[engine]
}

export function findStyleRecipe(
  recipes: readonly KreaStyleRecipe[],
  id: string | null | undefined,
): KreaStyleRecipe | null {
  if (!id) return null
  return recipes.find(recipe => recipe.id === id) ?? null
}

/** 成人配方 fail closed：必须 adult 角色 + 成熟内容开关同时满足。 */
export function recipeEligible(
  recipe: KreaStyleRecipe,
  character: StyleEligibility | null,
  opts: { adultEnabled?: boolean } = {},
): boolean {
  if (!recipe.adult) return true
  if (opts.adultEnabled !== true) return false
  return character?.adultEligibility === 'adult'
}

/** 对指定角色可见的配方（unknown / underage 永远看不到成人配方）。 */
export function eligibleStyleRecipes(
  recipes: readonly KreaStyleRecipe[],
  character: StyleEligibility | null,
  opts: { adultEnabled?: boolean } = {},
): KreaStyleRecipe[] {
  return recipes.filter(recipe => recipeEligible(recipe, character, opts))
}

/** 按引擎取蓝图 hint（缺省字段可选，未声明返回 undefined）。 */
export function styleHintForEngine(
  blueprint: StyleBlueprintHint | null,
  engine: RecipeEngine,
): string | undefined {
  return blueprint ? (engine === 'krea2' ? blueprint.kreaStyleHint : blueprint.animaStyleHint) : undefined
}

/**
 * 解析最终风格：手选配方 > 蓝图 hint > 引擎缺省。
 * - 手选 / hint 命中配方且资格不满足 → 返回 null（fail closed，绝不降级成成人词）。
 * - 手选 id 无效 → 回落到引擎缺省。
 * - hint 是自由风格短语（未命中配方）→ 直接作为前置短语，无媒介词、非成人。
 * - 缺省配方总是合法非成人配方，保证场景模式与「自动」恒有风格开头。
 */
export function resolveStyleRecipe(
  recipes: readonly KreaStyleRecipe[],
  engine: RecipeEngine,
  blueprint: StyleBlueprintHint | null,
  selection: string | null,
  character: StyleEligibility | null,
  opts: { adultEnabled?: boolean } = {},
): ResolvedStyle | null {
  const hint = styleHintForEngine(blueprint, engine)
  const requested = selection || hint || ENGINE_DEFAULT[engine]
  const recipe = findStyleRecipe(recipes, requested)
  if (recipe) {
    if (!recipeEligible(recipe, character, opts)) return null
    return { lead: recipe.lead, medium: recipe.medium, sd: recipe.sd, adult: recipe.adult || undefined }
  }
  if (selection) {
    // 手选 id 无效：fail closed 回落到引擎缺省，不让未知 id 变成空 prompt 风格。
    return resolveStyleRecipe(recipes, engine, null, null, character, opts)
  }
  if (hint) {
    if (String(hint).trim()) return { lead: String(hint).trim(), adult: false }
    return null
  }
  return null
}
