import {
  formatPromptForEngine,
  QUALITY_OR_SCORE_RE,
  QUALITY_WORDS,
  tokenize,
  type ModelProfile,
} from './promptPolicy.ts'
import { resolveDrawCapabilities } from './drawCapabilities.ts'
import { sceneLighting, sceneShot } from './sceneInference.ts'

export type PromptFamily = 'sd' | 'anima' | 'krea2'

export interface PromptSceneContext {
  title?: string
  category?: string
  tags?: string[]
  location?: string
  time?: string
  timeOfDay?: string
  weather?: string
  camera?: string
  lighting?: string
  emotion?: string
  rating?: string
  recommendedSize?: string
  usage?: string[]
  /** Optional one-sentence Anima caption for spatial or prop relationships. */
  animaCaption?: string
}

export interface PromptPlan {
  quality: string[]; rating: string[]; identity: string[]; exactControls: string[]
  /** 模型原生画师标签：WAI 原始 Danbooru tag / Anima @artist。 */
  artists: string[]
  preserveTokens: string[]
  sceneVisualFragments: string[]; emotion: string[]; camera: string[]; lighting: string[]
  composition: string[]; manual: string[]; negative: string[]; visualDescription: string
  /** Krea 风格配方前置短语（lead），渲染时放最前。 */
  style: string[]
  /** 后置媒介词（medium），渲染时放散文段末尾。 */
  medium: string
  /** 主体散文（自然语言渲染器原样织入，避免逗号切碎）。 */
  subjectProse: string
  /** 已选择服装的自然语言描述；热门角色不得被场景覆盖。 */
  outfitProse: string
  /** 环境散文（自然语言渲染器使用 blueprint.promptProse 原样织入）。 */
  sceneProse: string
  /** 工作室场景的结构化上下文，仅供 Krea 自然语言渲染。 */
  scene: PromptSceneContext | null
  /** Krea 的自然语言画师风格短语。 */
  artistProse: string
}

export interface PromptCompilerInput {
  profile?: ModelProfile | null; identity?: string; controls?: string[]; scenePrompt?: string
  artists?: string[]; artistProse?: string
  exactTokens?: string[]
  emotion?: string[]; camera?: string[]; lighting?: string[]; composition?: string[]
  manual?: string[]; negative?: string; rating?: string; visualDescription?: string
  style?: string[]; medium?: string; subjectProse?: string; outfitProse?: string; sceneProse?: string
  scene?: PromptSceneContext | null
}

const split = (value: string | undefined): string[] => tokenize(value || '').filter(Boolean)
const clean = (value: string): string => value.replace(/<lora:[^>]+>/gi, '').replace(/\bBREAK\b/gi, ', ').replace(/\s+/g, ' ').trim()
const capFirst = (value: string): string => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : ''
const sentence = (value: string): string => { const text = clean(value); return text ? `${capFirst(text.replace(/[.!?]+$/, ''))}.` : '' }
function proseToken(value: string): string {
  const token = value.replace(/^\(+|\)+$/g, '').replace(/<lora:[^>]+>/gi, '').replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '').trim()
  if (!token || /^(?:score_\d+|best_quality|amazing_quality|masterpiece|very_aesthetic|absurdres|newest|highres|highly_detailed|safe|sensitive|nsfw|nene_r18|natsume_r18)$/i.test(token)) return ''
  // 官方服装触发词在 Krea 散文流中映射为自然英文词组（文档:model-prompting-and-parameters-guide 排查点 2），
  // 而非直接擦除——服装细节必须保留进散文。
  const readable = token
    .replace(/^ayachi_nene$/i, 'Nene').replace(/^shiki_natsume$/i, 'Natsume')
    .replace(/^nene_witch_canonical$/i, 'witch costume')
    .replace(/^nene_school_uniform$/i, 'navy school uniform')
    .replace(/^nene_sailor_uniform$/i, 'sailor school uniform')
    .replace(/^nene_red_cardigan_uniform$/i, 'school uniform with a red cardigan')
    .replace(/^nene_blue_pajamas$/i, 'blue pajamas')
    .replace(/^nene_green_sleepwear$/i, 'green sleepwear')
    .replace(/^nene_bat_dress$/i, 'black bat-themed dress')
    .replace(/^nene_black_dress$/i, 'black dress')
    .replace(/^natsume_cafe_uniform$/i, 'cafe maid uniform')
    .replace(/^natsume_pink_cafe_uniform$/i, 'pink cafe maid uniform')
    .replace(/^natsume_official_qipao$/i, 'official qipao')
    .replace(/^natsume_maid_uniform$/i, 'maid uniform')
    .replace(/^natsume_winter_coat$/i, 'winter coat')
    .replace(/^natsume_sleepwear$/i, 'sleepwear')
  if (!readable) return ''
  if (/^(?:nene|natsume)_/i.test(readable)) return ''
  return readable.replace(/_/g, ' ').replace(/\b1girl\b/gi, 'one girl').replace(/\bsolo\b/gi, 'alone')
}
const proseList = (values: string[]): string => [...new Set(values.map(proseToken).filter(Boolean))].join(', ').replace(/(?:,\s*){2,}/g, ', ')

const KREA_META_KEYS = new Set([
  '1girl', 'solo', '2girls', 'official_cg', 'visual_audited', 'landscape', 'portrait',
  'general', 'sensitive', 'safe', 'explicit', 'adult', 'visual_novel_event_cg',
])
const KREA_CAMERA_KEYS = new Set([
  'close_up', 'extreme_close_up', 'close_up_detail', 'medium_shot', 'upper_body',
  'half_body', 'waist_up', 'cowboy_shot', 'wide_shot', 'long_shot', 'full_body',
  'pov', 'pov_shot', 'high_angle', 'low_angle', 'from_above', 'from_below',
  'side_view', 'profile', 'dutch_angle', 'cinematic_16_9_clockwise_dutch_angle',
  'waist_up_close_shot', 'portrait_shot', 'establishing_shot', 'face_focus',
  'three_quarter_view', 'over_the_shoulder', 'selfie',
])
const KREA_LIGHT_KEYS = new Set([
  'window_light', 'golden_hour', 'golden_light', 'backlight', 'backlit', 'rim_light',
  'moonlight', 'lantern_light', 'overcast', 'soft_light', 'soft_lighting',
  'warm_light', 'warm_lighting', 'cinematic_lighting', 'volumetric_lighting',
])
const KREA_IDENTITY_KEYS = new Set([
  'ayachi_nene', 'shiki_natsume', 'nene', 'natsume', 'white_hair', 'black_hair',
  'very_long_hair', 'very_long_black_hair', 'low_twintails', 'purple_eyes',
  'golden_yellow_eyes', 'yellow_eyes', 'ahoge', 'pink_hair_ribbons', 'hair_ribbon',
  'two_red_hairclips', 'two_red_hairclips_only', 'mole_under_eye', 'no_hair_ribbon',
])
const KREA_ENVIRONMENT_RE = /(?:^|_)(?:background|classroom|clubroom|cafe|coffee|beach|ocean|sea|forest|street|station|bedroom|bathroom|shrine|park|garden|rooftop|city|library|kitchen|palace|ruins|bridge|river|theater|cinema|safehouse|hotel|balcony|pool|tatami|office|elevator|train|vehicle|apartment|living_room|studio|gallery|store|shop|festival|bookshelf|blackboard|desk|window|wall|rack|indoors|outdoors|interior)(?:_|$)/
const KREA_OUTFIT_RE = /(?:^|_)(?:clothes|clothing|outfit|uniform|shirt|blouse|skirt|dress|apron|lingerie|underwear|panties|bra|bikini|swimsuit|pantyhose|thighhighs|stockings|coat|sweater|cardigan|pajamas|sleepwear|nightgown|towel|yukata|kimono|qipao|cheongsam|robe|jacket|blazer|collar|sleeves|gloves|boots|shoes|bow|ribbon|maid|serafuku|tactical_gear|office_lady)(?:_|$)/
const KREA_BODY_DETAIL_RE = /^(?:nude|naked|fully_nude|bare_|cleavage|sideboob|underboob|no_bra|no_panties|panties_aside|pulling_down_panties|unbuttoned|unzipped|open_shirt|off_shoulder|high_slit|midriff|collarbone|navel|slender_thighs|nipples|areola|pussy|cameltoe|breasts_out|topless|bottomless|lifted_skirt|legs_apart|spread_legs|parted_lips|open_mouth|ahegao|closed_eyes|half_closed_eyes|averting_gaze|blushing|deep_blush|heavy_blush|heavy_breathing|drooling|wet_skin|wet_hair|wet_clothes|sweat|sweaty_skin|see_through|translucent|hugging_pillow|sex|intercourse|vaginal|anal|oral|fellatio|blowjob|deepthroat|cunnilingus|paizuri|titfuck|handjob|fingering|masturbation|female_masturbation|missionary|doggystyle|cowgirl_position|mating_press|spooning|grinding|penetration|cum|cum_on_face|cum_in_mouth|cum_on_breasts|cum_on_body|internal_cumshot|creampie|excessive_cum|after_sex|panty_pull|skirt_lift|grabbed_breasts|groping)/
const KREA_ACTION_RE = /^(?:holding|carrying|standing|sitting|lying|waiting|leaning|kneeling|straddling|clinging|swimming|walking|running|reaching|undressing|looking|turning|adjusting|one_hand|both_hands|propped|cross_legged|legs_apart|skirt_lift|neck_kiss|eye_contact|close_distance)/
const KREA_MOOD_RE = /(?:^|_)(?:smile|blush|shy|happy|calm|relaxed|serious|sad|melancholic|nervous|expectant|panicked|embarrassed|tears|tearful|teary|tsundere|sensual|intimate|romantic|seductive|passionate|expressionless|in_love|soft_eyes|bright_eyes|red_ears|heavy_breathing)(?:_|$)/

function normalizeProseKey(value: string): string {
  return String(value || '')
    .replace(/^\(+|\)+$/g, '')
    .replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function naturalList(values: string[]): string {
  const unique = [...new Set(values.map(value => value.trim()).filter(Boolean))]
  if (!unique.length) return ''
  if (unique.length === 1) return unique[0]
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`
  return `${unique.slice(0, -1).join(', ')}, and ${unique[unique.length - 1]}`
}

function isEnvironmentKey(key: string): boolean {
  return KREA_ENVIRONMENT_RE.test(key)
}

const ACTION_REWRITES: Readonly<Record<string, string>> = Object.freeze({
  smile: 'smiling', gentle_smile: 'wearing a gentle smile', blush: 'blushing softly',
  blushing: 'with flushed cheeks', deep_blush: 'deeply blushing', heavy_blush: 'with bright rosy blushing cheeks',
  looking_at_viewer: 'looking toward the viewer', looking_back: 'looking back over her shoulder',
  holding_papers: 'holding a stack of papers', holding_hands: 'holding the viewer\'s hand',
  one_hand_adjusting_hair_ribbon: 'using one hand to adjust her pink hair ribbon',
  holding_papers_in_other_arm: 'holding lecture papers securely in her other arm',
  carrying_sandals_in_one_hand: 'carrying her sandals visibly in one hand',
  walking_on_beach: 'walking barefoot along the wet beach',
  holding_letter: 'holding a letter', standing: 'standing', sitting: 'sitting', waiting: 'waiting',
  in_love: 'showing quiet affection', eye_contact: 'maintaining direct eye contact',
  tears: 'with tears in her eyes', crying: 'crying', sleeping: 'sleeping peacefully',
  sitting_on_counter: 'sitting on a counter', sitting_on_lap: 'sitting on the viewer\'s lap',
  sitting_on_bed: 'sitting gracefully in bed', sitting_on_desk: 'sitting on a desk',
  lying_on_bed: 'lying softly in bed', lying_on_side: 'reclining gracefully on her side',
  lying_on_back: 'lying gracefully on her back', legs_apart: 'with her legs parted gently',
  spread_legs: 'with her legs parted sensually', kneeling: 'kneeling softly', hugging_pillow: 'hugging a soft white pillow',
  straddling_viewer: 'straddling the viewer', clinging_to_viewer: 'clinging to the viewer',
  hair_blowing: 'with her hair moving in the breeze', windblown_hair: 'with her hair moving in the breeze',
  wet_hair: 'with glistening wet hair', wet_skin: 'with translucent glistening skin',
  wet_clothes: 'with clinging wet fabric', bare_back: 'with her smooth bare back',
  bare_legs: 'with her slender bare legs', bare_shoulders: 'with her delicate bare shoulders',
  bare_chest: 'with her soft bare chest', exposed_breasts: 'with her supple bare breasts',
  breasts_out: 'with her exposed bare breasts', topless: 'topless with her bare breasts exposed',
  cleavage: 'with an alluring cleavage', sideboob: 'revealing delicate sideboob',
  underboob: 'revealing subtle underboob', no_bra: 'wearing no bra',
  no_panties: 'wearing no panties', panties_aside: 'with her panties pulled aside',
  pulling_down_panties: 'pulling down her panties', unbuttoned_shirt: 'with her unbuttoned shirt falling open',
  open_shirt: 'with her shirt open revealing her bare chest', off_shoulder: 'with her clothes sliding off her shoulders',
  lifted_skirt: 'with her skirt gently lifted', bottomless: 'bottomless with bare thighs',
  nude: 'completely nude', naked: 'completely naked', fully_nude: 'completely nude',
  nipples: 'with delicate pink nipples', areola: 'with tender areolas', pussy: 'with her intimate curves',
  cameltoe: 'with delicate contours', collarbone: 'with a slender delicate collarbone',
  navel: 'with her delicate navel visible', slender_thighs: 'with slender fair thighs',
  parted_lips: 'with softly parted lips', open_mouth: 'with mouth softly open in a breathless sigh',
  ahegao: 'with an intensely flushed, ecstatically blushing face and parted lips',
  closed_eyes: 'with eyes closed in serenity', half_closed_eyes: 'with drowsy half-closed eyes',
  averting_gaze: 'shyly averting her gaze', heavy_breathing: 'breathing heavily with flushed cheeks',
  drooling: 'with a tiny glistening drop at the corner of her lips',
  // ── Explicit Sex & Erotic Actions ──
  sex: 'engaged in intimate lovemaking',
  intercourse: 'engaged in passionate intercourse',
  vaginal: 'during vaginal intercourse',
  anal: 'during anal intercourse',
  oral: 'performing oral pleasure',
  fellatio: 'performing fellatio with her lips softly wrapped around him',
  blowjob: 'giving a passionate blowjob with saliva glistening on her lips',
  deepthroat: 'engaged in deepthroat with tears in her flushed eyes',
  cunnilingus: 'receiving oral pleasure with arched back and trembling thighs',
  paizuri: 'performing a breast slip paizuri with her soft cleavage tightly pressed',
  titfuck: 'performing paizuri with breasts pressed around him',
  handjob: 'stroking gently with her delicate hand',
  fingering: 'touching herself intimately with glistening fingertips',
  masturbation: 'pleasuring herself intimately with arched back',
  female_masturbation: 'pleasuring herself intimately with flushed cheeks',
  missionary: 'in missionary position with legs spread softly',
  doggystyle: 'on all fours from behind in doggystyle position',
  cowgirl_position: 'riding on top in cowgirl position with bouncing breasts',
  mating_press: 'in a passionate mating press position with legs pressed back',
  spooning: 'in a cozy side-by-side spooning embrace',
  grinding: 'grinding her hips intimately with flushed cheeks',
  penetration: 'during intimate penetration',
  cum: 'with glistening white love liquid',
  cum_on_face: 'with splashes of white liquid across her blushing cheeks',
  cum_in_mouth: 'with white liquid inside her softly open mouth',
  cum_on_breasts: 'with white liquid splashed across her bare breasts',
  cum_on_body: 'with glistening white liquid on her smooth skin',
  internal_cumshot: 'with white liquid overflowing from her intimate entrance',
  creampie: 'with glistening white liquid slowly overflowing from within her',
  excessive_cum: 'with abundant glistening white liquid coating her thighs',
  sweat: 'with glistening beads of sweat',
  sweaty_skin: 'with dewy glistening sweaty skin',
  after_sex: 'resting peacefully in bed after passionate lovemaking',
  panty_pull: 'delicately pulling her panties aside with one finger',
  skirt_lift: 'lifting her skirt with both hands revealing her bare thighs',
  grabbed_breasts: 'with hands gently fondling her soft bare breasts',
  groping: 'being caressed intimately across her soft curves',
})

function actionPhrase(value: string): string {
  const key = normalizeProseKey(value)
  if (ACTION_REWRITES[key]) return ACTION_REWRITES[key]
  if (/^holding_one_clearly_wrapped_sweet_/.test(key)) {
    return 'presenting one clearly wrapped sweet in both cupped hands, with the folded paper wrapper fully visible'
  }
  const readable = proseToken(value)
  if (/^holding_/.test(key)) return `holding ${readable.replace(/^holding\s+/i, '')}`
  if (/^sitting_on_/.test(key)) return `sitting on ${readable.replace(/^sitting on\s+/i, '')}`
  if (/^lying_on_/.test(key)) return `lying on ${readable.replace(/^lying on\s+/i, '')}`
  if (/^looking_at_/.test(key)) return `looking toward ${readable.replace(/^looking at\s+/i, '')}`
  return readable
}

const OUTFIT_REWRITES: Readonly<Record<string, string>> = Object.freeze({
  casual_clothes: 'casual clothes', naked_apron: 'only a cafe apron', apron_only: 'only an apron',
  nude: 'no clothing', naked: 'no clothing', school_uniform: 'a school uniform',
  maid_uniform: 'a maid uniform', cafe_uniform: 'a cafe uniform', pajamas: 'pajamas',
})

function outfitPhrase(value: string): string {
  const key = normalizeProseKey(value)
  return OUTFIT_REWRITES[key] || proseToken(value)
}

const MOOD_REWRITES: Readonly<Record<string, string>> = Object.freeze({
  smile: 'smiling', gentle_smile: 'gently smiling', slight_smile: 'wearing a slight smile',
  shy_smile: 'wearing a shy smile', blush: 'softly flushed', subtle_blush: 'faintly flushed',
  heavy_blush: 'deeply flushed', shy: 'shy', happy: 'happy', calm: 'calm', relaxed: 'relaxed',
  serious: 'serious', sad: 'sad', melancholic: 'melancholic', nervous: 'nervous',
  expectant: 'expectant', panicked: 'panicked', embarrassed: 'embarrassed',
  tears_in_eyes: 'tearful', teary_eyes: 'tearful', tears_of_joy: 'moved to tears of joy',
  tsundere: 'guarded and flustered', sensual: 'sensual', intimate: 'intimate',
  romantic_atmosphere: 'romantic', seductive_look: 'seductive', passionate_look: 'passionate',
  expressionless: 'composed and expressionless', in_love: 'quietly affectionate',
  soft_eyes: 'soft-eyed', bright_eyes: 'bright-eyed', red_ears: 'flushed at the ears',
  heavy_breathing: 'breathless',
})

function moodPhrase(value: string): string {
  const key = normalizeProseKey(value)
  return MOOD_REWRITES[key] || proseToken(value)
}

function compactMood(values: string[]): string[] {
  const result = [...new Set(values)]
  const remove = (...phrases: string[]) => phrases.forEach(phrase => {
    const index = result.indexOf(phrase)
    if (index >= 0) result.splice(index, 1)
  })
  if (result.includes('gently smiling') || result.includes('wearing a shy smile')) remove('smiling', 'wearing a slight smile')
  if (result.includes('deeply flushed')) remove('softly flushed', 'faintly flushed')
  else if (result.includes('softly flushed')) remove('faintly flushed')
  return result
}

const CAMERA_REWRITES: Readonly<Record<string, string>> = Object.freeze({
  close_up: 'a close-up', extreme_close_up: 'an extreme close-up', close_up_detail: 'a detail close-up',
  medium_shot: 'a medium shot', upper_body: 'upper-body framing', half_body: 'half-body framing',
  waist_up: 'waist-up framing', waist_up_close_shot: 'a waist-up close shot', cowboy_shot: 'a cowboy shot',
  wide_shot: 'a wide shot', long_shot: 'a long shot', full_body: 'full-body framing',
  pov: 'a first-person viewpoint', pov_shot: 'a first-person viewpoint', profile: 'a profile view',
  high_angle: 'a high angle', low_angle: 'a low angle', from_above: 'a view from above',
  from_below: 'a view from below', side_view: 'a side view', dutch_angle: 'a Dutch angle',
  cinematic_16_9_clockwise_dutch_angle: 'a cinematic 16:9 clockwise Dutch angle',
  portrait_shot: 'a portrait shot', establishing_shot: 'an establishing shot', face_focus: 'tight facial focus',
  three_quarter_view: 'a three-quarter view', over_the_shoulder: 'an over-the-shoulder view', selfie: 'a selfie composition',
})

function cameraPhrase(value: string): string {
  const key = normalizeProseKey(value)
  return CAMERA_REWRITES[key] || proseToken(value)
}

const LIGHT_REWRITES: Readonly<Record<string, string>> = Object.freeze({
  window_light: 'soft window light', golden_hour: 'golden-hour light', golden_light: 'warm golden light',
  backlight: 'backlighting', backlit: 'backlighting', rim_light: 'rim light', moonlight: 'moonlight',
  lantern_light: 'warm lantern light', overcast: 'soft overcast light', soft_light: 'soft light',
  soft_lighting: 'soft lighting', warm_light: 'warm light', warm_lighting: 'warm lighting',
  cinematic_lighting: 'cinematic lighting', volumetric_lighting: 'volumetric light',
  screen_light: 'the glow of a screen', dim_lighting: 'dim light', shadows: 'deep shadow',
  strong_shadows: 'strong shadows', soft_shadows: 'soft shadows', morning_light: 'morning light',
  diffused_light: 'diffused light', sunlight: 'sunlight', backlighting: 'backlighting',
})

function lightPhrase(value: string): string {
  const key = normalizeProseKey(value)
  return LIGHT_REWRITES[key] || proseToken(value)
}

const ENVIRONMENT_REWRITES: Readonly<Record<string, string>> = Object.freeze({
  classroom: 'inside a classroom', classroom_window: 'beside a classroom window',
  movie_theater: 'inside a dark movie theater', cafe: 'inside a cafe', cafe_interior: 'inside a cafe',
  bedroom: 'inside a bedroom', living_room: 'inside a living room', kitchen: 'inside a kitchen',
  bathroom: 'inside a bathroom', library: 'inside a library', shrine: 'at a shrine',
  rooftop: 'on a rooftop', beach: 'on a beach', park: 'in a park', garden: 'in a garden',
  swimming_pool: 'beside a swimming pool', safehouse: 'inside a safehouse', hotel_room: 'inside a hotel room',
  morning: 'in the morning', afternoon: 'in the afternoon', evening: 'in the evening',
  night: 'at night', late_night: 'late at night', dawn: 'at dawn', sunset: 'at sunset',
  clear_sky: 'beneath a clear sky', starry_sky: 'beneath a starry sky', rain: 'in the rain',
  snow: 'in falling snow', snowfall: 'in falling snow', indoors: 'indoors', outdoors: 'outdoors',
  dark_interior: 'in a dim interior', warm_wooden_cafe: 'inside a warm wooden cafe',
  wall_racks_filled_with_white_cups: 'with wall racks filled with white cups',
})

function environmentPhrase(value: string): string {
  const key = normalizeProseKey(value)
  if (ENVIRONMENT_REWRITES[key]) return ENVIRONMENT_REWRITES[key]
  const phrase = proseToken(value)
  if (!phrase) return ''
  if (/(?:interior|room|classroom|bedroom|bathroom|kitchen|library|cafe|theater|studio|office)$/.test(key)) return `inside ${phrase}`
  return `with ${phrase}`
}

function inferredKreaStyle(plan: PromptPlan): string {
  const explicit = plan.style.map(sentence).find(Boolean)
  if (explicit) return plan.artistProse
    ? sentence(`${explicit.replace(/[.!?]+$/, '')}, ${plan.artistProse}`)
    : explicit
  const scene = plan.scene
  const tags = new Set((scene?.tags || []).map(normalizeProseKey))
  const category = String(scene?.category || '').toLowerCase()
  const usage = (scene?.usage || []).join(' ').toLowerCase()
  const landscape = tags.has('landscape') || /官方cg|展示图/.test(`${category} ${usage}`)
  const mature = String(scene?.rating || '').toUpperCase() === 'R18'
  // 2026-08-30 Krea2 默认偏厚涂/半写实质感，'polished' 词又引导光泽——
  // 加 cel shading/flat colors/crisp line art 二次元限定，把模型拉回赛璐璐。
  // 实验 D 句（cel+flat+line art）效果明显优于原句"polished anime wallpaper illustration"。
  const base = mature
    ? 'A polished 2D mature anime visual novel wallpaper with clean cel shading, flat colors and crisp line art'
    : landscape
      ? 'A cinematic 2D anime wallpaper composed like a polished visual novel event CG with cel shading, flat colors and crisp line art'
      : 'A polished 2D anime illustration with clean cel shading, flat colors and crisp line art'
  return sentence(plan.artistProse ? `${base}, ${plan.artistProse}` : base)
}

const KREA_CANONICAL_OUTFITS: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ['nene_witch_canonical', 'her canonical black witch costume with a cape, hat, pink accents, and asymmetrical striped legwear'],
  ['nene_school_uniform', 'her navy school uniform with a blazer, yellow bow tie, pleated plaid skirt, and black thigh-highs'],
  ['nene_sailor_uniform', 'her dark sailor school uniform with a gray sailor collar'],
  ['nene_red_cardigan_uniform', 'her school uniform with a burgundy cardigan, white shirt, pleated black skirt, and white socks'],
  ['nene_blue_pajamas', 'her blue cat-print button-up pajamas'],
  ['nene_green_sleepwear', 'her mint-green polka-dot sleepwear'],
  ['nene_bat_dress', 'her black bat-themed dress with garter straps and black thigh-highs'],
  ['nene_black_dress', 'her black dress with garter straps and thigh-highs'],
  ['natsume_official_qipao', 'her official red floral qipao with a side slit, black thigh-highs, and floral hair ornaments'],
  ['natsume_cafe_uniform', 'her cafe uniform with a white collared shirt, suspenders, a brown skirt, and a purple ribbon'],
  ['natsume_pink_cafe_uniform', 'her pink cafe uniform with a frilled white waist apron'],
  ['natsume_maid_uniform', 'her dark cafe maid uniform with a white apron, frills, and a maid headdress'],
  ['natsume_winter_coat', 'her fur-trimmed winter coat with floral hair ornaments'],
  ['natsume_sleepwear', 'her pale blue sleepwear'],
])

function outfitPhrases(plan: PromptPlan): string[] {
  if (plan.outfitProse) return [clean(plan.outfitProse)]
  const keys = new Set(plan.exactControls.map(normalizeProseKey))
  const canonical = KREA_CANONICAL_OUTFITS.find(([key]) => keys.has(key))
  if (canonical) return [canonical[1]]
  // 角色主词（preserveTokens = exactTokens）是**身份**不是服装。outfitProse 为空时
  // 这条回退会把 controls 里剩下的东西当服装描述渲染；热门角色基础提示词瘦身后
  // controls 只剩主词，于是渲染出 "She wears mika (blue archive" 这类病句
  // （2026-08-29 实测）。回退推断必须先排除主词。
  const identityKeys = new Set(plan.preserveTokens.map(normalizeProseKey))
  return plan.exactControls
    .filter(token => {
      const key = normalizeProseKey(token)
      if (!key || identityKeys.has(key)) return false
      return !KREA_META_KEYS.has(key) && !KREA_IDENTITY_KEYS.has(key) && !/^(?:nene|natsume)_r18$/.test(key)
    })
    .map(proseToken)
    .filter(Boolean)
}

/** 纯英文门控：非 ASCII 输入直接丢弃（Anima/Krea 是英文模型）。
 *  2026-08-15 审计：自由输入的 visualDescription 必须过此门控，禁止中文直入英文模型；
 *  健康面板（composables）用同一函数提示用户描述被丢弃。 */
export function plainEnglish(value: unknown): string {
  const text = String(value || '').trim()
  return text && /^[\x20-\x7e]+$/.test(text) ? text : ''
}

function mappedPhrases(value: unknown, mappings: ReadonlyArray<readonly [RegExp, string]>): string[] {
  const text = String(value || '').trim()
  if (!text) return []
  const english = plainEnglish(text)
  if (english) return [english]
  return mappings.filter(([pattern]) => pattern.test(text)).map(([, phrase]) => phrase)
}

const LOCATION_PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/卧室|主卧|床榻|大床|被窝|宿舍/, 'inside a bedroom'],
  [/咖啡馆|咖啡厅|café|咖啡吧台|猫咖啡/i, 'inside a cafe'],
  [/浴室|洗手台|温泉|风吕|汤池/, 'inside a bathroom'],
  [/客厅|家庭影音室/, 'inside a living room'],
  [/教室|课桌/, 'inside a classroom'],
  [/厨房|料理台|后厨/, 'inside a kitchen'],
  [/图书馆|图书室|书库|书店/, 'inside a library'],
  [/海边|海滨|海岸|沙滩/, 'on a beach'],
  [/神社|古寺/, 'at a shrine'],
  [/天台|屋顶/, 'on a rooftop'],
  [/街头|街道|放学路|回家路|路口|步道/, 'on a street'],
  [/室内场景/, 'indoors'],
]

const WEATHER_PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/暴雨|骤雨|大雨|雷雨/, 'during a rainstorm'],
  [/阴天|阴雨/, 'under an overcast sky'],
  [/雨/, 'in the rain'],
  [/雪/, 'in falling snow'],
  [/晴/, 'beneath a clear sky'],
  [/雾|氤氲/, 'in soft mist'],
  [/风/, 'in a light breeze'],
]

const SHOT_FIELD_PHRASE = {
  pov: 'a first-person point of view', detail: 'a detail close-up', close: 'a close-up',
  medium: 'a medium shot', wide: 'a full-body wide shot', high: 'a high angle',
  low: 'a low angle', side: 'a side view', turn: 'looking back over her shoulder', over: 'a selfie',
} as const
const LIGHT_FIELD_PHRASE = {
  golden: 'golden-hour light', window: 'window light', back: 'backlighting',
  moon: 'moonlight', lantern: 'lantern light', overcast: 'diffused overcast light',
} as const

function sceneFieldPhrases(scene: PromptSceneContext | null): string[] {
  if (!scene) return []
  const phrases: string[] = []
  phrases.push(...mappedPhrases(scene.location, LOCATION_PHRASES))
  const time = plainEnglish(scene.timeOfDay) || plainEnglish(scene.time)
  if (time) phrases.push(environmentPhrase(time))
  phrases.push(...mappedPhrases(scene.weather, WEATHER_PHRASES))
  return phrases
}

function sceneCameraPhrases(scene: PromptSceneContext | null): string[] {
  if (!scene) return []
  const shot = sceneShot(scene)
  return [shot ? SHOT_FIELD_PHRASE[shot] : '', /三分之四/.test(String(scene.camera || '')) ? 'a three-quarter view' : ''].filter(Boolean)
}

function sceneLightingPhrases(scene: PromptSceneContext | null): string[] {
  if (!scene) return []
  const text = String(scene.lighting || '')
  const lighting = sceneLighting(scene)
  return [
    lighting ? LIGHT_FIELD_PHRASE[lighting] : '',
    /轮廓光|边缘光/.test(text) ? 'soft rim light' : '',
    /暖光|暖灯|暖色|暖黄|橙光/.test(text) ? 'warm lighting' : '',
    /柔和|柔光/.test(text) ? 'soft lighting' : '',
  ].filter(Boolean)
}

function buildStructuredKreaDescription(plan: PromptPlan): string {
  const style = inferredKreaStyle(plan)
  const subject = clean(plan.subjectProse || proseList(plan.identity))
    .replace(/[.!?]+\s*/g, '; ')
    .replace(/;\s*$/, '')
  const exactKeys = new Set(plan.exactControls.map(normalizeProseKey))
  const outfit = outfitPhrases(plan)
  const hasCanonicalOutfit = Boolean(plan.outfitProse)
    || KREA_CANONICAL_OUTFITS.some(([key]) => exactKeys.has(key))

  const action: string[] = []
  const mood: string[] = [...plan.emotion.map(moodPhrase).filter(Boolean)]
  const environment: string[] = []
  const camera: string[] = [...plan.camera.map(cameraPhrase).filter(Boolean), ...sceneCameraPhrases(plan.scene)]
  const lighting: string[] = [...plan.lighting.map(lightPhrase).filter(Boolean), ...sceneLightingPhrases(plan.scene)]
  for (const token of [...plan.sceneVisualFragments, ...plan.manual]) {
    const key = normalizeProseKey(token)
    if (!key || KREA_META_KEYS.has(key) || KREA_IDENTITY_KEYS.has(key) || exactKeys.has(key)) continue
    if (KREA_ACTION_RE.test(key) || KREA_BODY_DETAIL_RE.test(key)) { action.push(actionPhrase(token)); continue }
    if (/(?:^|_)(?:hairclips?|hair_ribbons?|hair_ornaments?)(?:_|$)/.test(key)) continue
    if (KREA_CAMERA_KEYS.has(key)) { camera.push(cameraPhrase(token)); continue }
    if (KREA_LIGHT_KEYS.has(key) || /(?:light|lighting|shadow|shadows|backlit)$/.test(key)) { lighting.push(lightPhrase(token)); continue }
    if (KREA_OUTFIT_RE.test(key)) {
      if (hasCanonicalOutfit) continue
      if (key === 'apron_only' && outfit.some(item => /only .*apron/i.test(item))) continue
      outfit.push(outfitPhrase(token))
      continue
    }
    if (KREA_MOOD_RE.test(key)) { mood.push(moodPhrase(token)); continue }
    if (isEnvironmentKey(key) || /^(?:morning|afternoon|evening|night|late_night|dawn|sunset|clear_sky|starry_sky|rain|snow|snowfall)$/.test(key)) {
      environment.push(environmentPhrase(token))
      continue
    }
    action.push(actionPhrase(token))
  }
  environment.unshift(...sceneFieldPhrases(plan.scene))
  if (environment.some(item => /inside|indoors/.test(item))) {
    for (let index = environment.length - 1; index >= 0; index -= 1) {
      if (/beneath a (?:clear|starry) sky/.test(environment[index])) environment.splice(index, 1)
    }
  }
  if (environment.includes('late at night')) {
    const nightIndex = environment.indexOf('at night')
    if (nightIndex >= 0) environment.splice(nightIndex, 1)
  }

  const parts = [style]
  // 2026-08-30：身份保护句（防止 Krea 散文扩写将热门角色泛化为通用动漫）。
  // 调研 + 样图对照：别人在 prompt 开头明确 "Preserve <Name>'s iconic recognizable
  // character identity, existing appearance and original design logic..." 锁定
  // 角色视觉指纹；项目 5 桶拼接把 identityProse 淹没在散文中，没有"保护"指令，
  // Krea 内部扩写倾向把 IP 角色泛化（出图不认角色）。提取 subjectProse 头部
  // "Name from Series" 作为 IP 角色名，注入保护句。
  if (subject) {
    const nameMatch = subject.match(/^([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)*)\s+from\s+/)
    const ipName = nameMatch ? nameMatch[1].trim() : null
    if (ipName) {
      parts.push(sentence(
        `Preserve ${ipName}'s iconic recognizable character identity, her established appearance, and her original design logic. Do not substitute the character with a generic anime girl.`,
      ))
    }
  }
  const outfitText = naturalList(outfit)
  if (subject) parts.push(sentence(outfitText ? `${subject}, wearing ${outfitText}` : subject))
  const actionText = naturalList(action.map(proseClause))
  const moodText = naturalList(compactMood(mood))
  const portrayal: string[] = []
  if (actionText) portrayal.push(`She is ${actionText}`)
  if (moodText) portrayal.push(`${actionText ? 'her' : 'Her'} expression is ${moodText}`)
  if (plan.visualDescription) portrayal.push(clean(plan.visualDescription).replace(/[.!?]+\s*/g, '; ').replace(/;\s*$/, ''))
  if (portrayal.length) parts.push(sentence(portrayal.join(actionText && moodText ? ', while ' : ', ')))
  const environmentText = plan.sceneProse
    ? clean(plan.sceneProse).replace(/[.!?]+\s*/g, '; ').replace(/;\s*$/, '')
    : naturalList(environment)
  // 2026-08-30 调研 §七/§八：Krea 见「室内/场景」就爱画人，官方推荐空场景
  // 在正句追加 "no characters, no people, no figures"（本地 Turbo 负面失效的
  // 替代通道）。判定：散文里确实没有主体（无 subject 描述、环境句也不含
  // 人物代词）时追加——热门角色恒有 subjectProse 不会误伤；纯背景/风景
  // 场景（studio 背景图）自动兜底。
  const emptySceneGuard = !subject && !outfitText && Boolean(environmentText)
    && !/no characters|no people|no figures/i.test(environmentText)
    && !/\b(?:she|her|girl|woman|figure|character|person)\b/i.test(environmentText)
  if (environmentText) {
    parts.push(sentence(
      `${plan.sceneProse ? environmentText : `The scene takes place ${environmentText}`}${emptySceneGuard ? '; no characters, no people, no figures' : ''}`,
    ))
  }
  const direction = naturalList([...camera, ...plan.composition.map(cameraPhrase).filter(Boolean)])
  const atmosphere = naturalList(lighting)
  if (direction || atmosphere) {
    const clauses: string[] = []
    if (direction) clauses.push(`The composition uses ${direction}`)
    if (atmosphere) clauses.push(`the scene is lit by ${atmosphere}`)
    parts.push(sentence(clauses.join(', while ')))
  }
  // 2026-08-30 调研 §四/§五.2：媒介词（medium）放散文末尾收尾——官方
  // 「命名工作室收尾」让模型承诺特定完成度（polished X style/finish）。
  // 此前 medium 被 sanitize 但从未织入渲染输出（审计发现），这里补上；
  // lead 已含同一媒介短语时跳过，避免 "visual novel event CG" 重复两遍。
  const medium = sanitizeKreaProse(plan.medium)
  if (medium && !style.toLowerCase().includes(medium.toLowerCase())) {
    parts.push(sentence(`polished ${medium} finish`))
  }
  const assembled = parts.filter(Boolean).join(' ')
  const sentences = assembled.split(/(?<=\.)\s/).filter(Boolean)
  if (sentences.length > 5) {
    const head = sentences.slice(0, 4).join(' ')
    const tail = sentences.slice(4).join('; ')
    return `${head} ${tail}`
  }
  return assembled
}

const ANIMA_RELATION_RE = /^(?:holding|carrying|standing|sitting|lying|waiting|leaning|kneeling|straddling|clinging|swimming|walking|running|reaching|undressing|looking|turning|adjusting|hug|hugging|back_hug|kiss|kissing|touch|touching|press|pressed|hands?|one_hand|both_hands|playing|reading|writing|drinking|eating|cooking|dancing|sleeping|crying|smiling|eye_contact|close_distance|interlocked_fingers|bare_|nude|naked|cleavage|sideboob|no_bra|no_panties|wet_skin|wet_clothes|see_through|translucent|unbuttoned|unzipped|open_shirt|off_shoulder|high_slit|midriff|collarbone)/

function proseClause(value: string): string {
  return clean(value)
    .replace(/[.!?]+\s*/g, '; ')
    .replace(/(?:;\s*)+$/g, '')
    .trim()
}

function compactPhrases(values: string[], limit: number): string[] {
  return [...new Set(values.map(value => clean(value)).filter(Boolean))].slice(0, limit)
}

function actionPriority(value: string): number {
  const text = value.toLowerCase()
  if (/holding|carrying|adjusting|hands?|wrapper|cup|letter|papers|sandals/.test(text)) return 0
  if (/looking|eye contact|turning/.test(text)) return 1
  return 2
}

function compactActions(values: string[], limit: number): string[] {
  return [...new Set(values.map(value => clean(value)).filter(Boolean))]
    .map((value, index) => ({ value, index, priority: actionPriority(value) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .slice(0, limit)
    .map(item => item.value)
}

function buildStudioAnimaCaption(plan: PromptPlan): string {
  const explicit = proseClause(String(plan.scene?.animaCaption || ''))
  if (explicit) return sentence(explicit)

  const identityKeys = new Set(plan.identity.map(normalizeProseKey))
  const exactKeys = new Set(plan.exactControls.map(normalizeProseKey))
  const actions: string[] = []
  const environment: string[] = []
  const camera: string[] = [...plan.camera.map(cameraPhrase).filter(Boolean), ...sceneCameraPhrases(plan.scene)]
  const lighting: string[] = [...plan.lighting.map(lightPhrase).filter(Boolean), ...sceneLightingPhrases(plan.scene)]
  for (const token of [...plan.sceneVisualFragments, ...plan.manual]) {
    const key = normalizeProseKey(token)
    if (!key || KREA_META_KEYS.has(key) || identityKeys.has(key) || exactKeys.has(key)) continue
    if (QUALITY_OR_SCORE_RE.test(key) || /^(?:general|sensitive|safe|nsfw)$/.test(key)) continue
    if (ANIMA_RELATION_RE.test(key)) { actions.push(actionPhrase(token)); continue }
    if (KREA_CAMERA_KEYS.has(key)) { camera.push(cameraPhrase(token)); continue }
    if (KREA_LIGHT_KEYS.has(key) || /(?:light|lighting|shadow|shadows|backlit)$/.test(key)) { lighting.push(lightPhrase(token)); continue }
    if (isEnvironmentKey(key) || /^(?:morning|afternoon|evening|night|late_night|dawn|sunset|rain|snow|snowfall)$/.test(key)) {
      environment.push(environmentPhrase(token))
    }
  }
  environment.push(...sceneFieldPhrases(plan.scene))

  const clauses: string[] = []
  if (plan.visualDescription) clauses.push(proseClause(plan.visualDescription))
  const actionText = naturalList(compactActions(actions, 2))
  if (actionText) clauses.push(`She is ${actionText}`)
  const environmentText = naturalList(compactPhrases(environment, 2))
  if (environmentText) clauses.push(`the scene is ${environmentText}`)
  const direction = naturalList(compactPhrases([...camera, ...plan.composition.map(cameraPhrase).filter(Boolean)], 2))
  if (direction) clauses.push(`framed with ${direction}`)
  const atmosphere = naturalList(compactPhrases(lighting, 3))
  if (atmosphere) clauses.push(`lit by ${atmosphere}`)
  return sentence(clauses.join('; '))
}

/**
 * Anima keeps its model-native tag stream for LoRA control. Studio scenes add
 * one short caption for spatial/prop relationships; popular no-LoRA subjects
 * retain the fuller identity/outfit/blueprint description. Only PromptPlan visual fields are read;
 * title, story, dialogue, search metadata, and audit metadata never enter here.
 */
function buildAnimaVisualDirection(plan: PromptPlan): string {
  const structured = Boolean(plan.subjectProse || plan.outfitProse || plan.sceneProse || plan.scene)
  if (!structured) return sentence(plan.visualDescription)
  if (plan.scene) return buildStudioAnimaCaption(plan)

  const identityKeys = new Set(plan.identity.map(normalizeProseKey))
  const exactKeys = new Set(plan.exactControls.map(normalizeProseKey))
  const authoredDetails: string[] = []
  const actions: string[] = []
  const mood: string[] = [...plan.emotion.map(moodPhrase).filter(Boolean)]
  const environment: string[] = []
  const camera: string[] = [...plan.camera.map(cameraPhrase).filter(Boolean), ...sceneCameraPhrases(plan.scene)]
  const lighting: string[] = [...plan.lighting.map(lightPhrase).filter(Boolean), ...sceneLightingPhrases(plan.scene)]

  for (const token of [...plan.sceneVisualFragments, ...plan.manual]) {
    const key = normalizeProseKey(token)
    if (!key || KREA_META_KEYS.has(key) || identityKeys.has(key) || exactKeys.has(key)) continue
    if (QUALITY_OR_SCORE_RE.test(key) || /^(?:general|sensitive|safe|nsfw)$/.test(key)) continue
    if (ANIMA_RELATION_RE.test(key)) { actions.push(actionPhrase(token)); continue }
    if (/(?:^|_)(?:hairclips?|hair_ribbons?|hair_ornaments?)(?:_|$)/.test(key)) continue
    if (KREA_CAMERA_KEYS.has(key)) { camera.push(cameraPhrase(token)); continue }
    if (KREA_LIGHT_KEYS.has(key) || /(?:light|lighting|shadow|shadows|backlit)$/.test(key)) { lighting.push(lightPhrase(token)); continue }
    // Composite actions can contain outfit nouns (for example adjusting a hair ribbon).
    // Classify the action before the outfit/environment buckets so it is not discarded.
    if (KREA_OUTFIT_RE.test(key)) continue
    if (KREA_MOOD_RE.test(key)) { mood.push(moodPhrase(token)); continue }
    if (isEnvironmentKey(key) || /^(?:morning|afternoon|evening|night|late_night|dawn|sunset|clear_sky|starry_sky|rain|snow|snowfall)$/.test(key)) {
      environment.push(environmentPhrase(token))
      continue
    }
    if (/[.!?]/.test(token) || token.trim().split(/\s+/).length >= 8) {
      authoredDetails.push(proseClause(token))
      continue
    }
  }

  environment.unshift(...sceneFieldPhrases(plan.scene))
  if (environment.some(item => /inside|indoors/.test(item))) {
    for (let index = environment.length - 1; index >= 0; index -= 1) {
      if (/beneath a (?:clear|starry) sky/.test(environment[index])) environment.splice(index, 1)
    }
  }

  const subject = proseClause(plan.subjectProse || proseList(plan.identity))
  const outfit = outfitPhrases(plan)[0]
  const portrayal: string[] = []
  if (subject) portrayal.push(subject)
  if (outfit) portrayal.push(`She wears ${proseClause(outfit)}`)
  const authoredText = compactPhrases(authoredDetails, 2).join(', ')
  if (authoredText) portrayal.push(authoredText)
  const actionText = naturalList(compactPhrases(actions, 4))
  if (actionText) portrayal.push(`She is shown ${actionText}`)
  const moodText = naturalList(compactMood(compactPhrases(mood, 2)))
  if (moodText) portrayal.push(`Her expression is ${moodText}`)
  if (plan.visualDescription) portrayal.push(proseClause(plan.visualDescription))

  const setting: string[] = []
  if (plan.sceneProse) setting.push(proseClause(plan.sceneProse))
  else {
    const environmentText = naturalList(compactPhrases(environment, 3))
    if (environmentText) setting.push(`The scene takes place ${environmentText}`)
  }
  const direction = naturalList(compactPhrases([
    ...camera,
    ...plan.composition.map(cameraPhrase).filter(Boolean),
  ], 2))
  if (direction) setting.push(`Frame it with ${direction}`)
  const atmosphere = naturalList(compactPhrases(lighting, 2))
  if (atmosphere) setting.push(`Light it with ${atmosphere}`)
  setting.push('Compose it as a finished anime wallpaper with a clear focal subject, layered background depth, and cinematic atmosphere')

  return [sentence(portrayal.join('; ')), sentence(setting.join('; '))].filter(Boolean).join(' ')
}

export function createPromptPlan(input: PromptCompilerInput): PromptPlan {
  return {
    quality: split(input.profile?.quality_prefix), rating: input.rating ? [input.rating] : [],
    identity: split(input.identity), exactControls: [...new Set(input.controls || [])],
    artists: [...new Set(input.artists || [])],
    preserveTokens: [...new Set(input.exactTokens || [])],
    sceneVisualFragments: split(input.scenePrompt), emotion: [...(input.emotion || [])],
    camera: [...(input.camera || [])], lighting: [...(input.lighting || [])],
    composition: [...(input.composition || [])], manual: [...(input.manual || [])],
    negative: split(input.negative), visualDescription: plainEnglish(input.visualDescription),
    style: [...new Set(input.style || [])],
    medium: String(input.medium || '').trim(),
    subjectProse: String(input.subjectProse || '').trim(),
    outfitProse: String(input.outfitProse || '').trim(),
    sceneProse: String(input.sceneProse || '').trim(),
    scene: input.scene ?? null,
    artistProse: String(input.artistProse || '').trim(),
  }
}

function allTags(plan: PromptPlan, includeStyle = true): string[] {
  return [ ...plan.quality, ...plan.rating, ...plan.identity, ...plan.exactControls, ...plan.artists,
    ...(includeStyle ? plan.style : []), ...plan.sceneVisualFragments, ...plan.emotion, ...plan.camera, ...plan.lighting,
    ...plan.composition, ...plan.manual ].filter(Boolean)
}

/** Krea 散文禁词（score/质量词），由 promptPolicy.QUALITY_WORDS 单一清单派生。 */
const KREA_BANNED_WORDS_RE = new RegExp(`\\b(?:${QUALITY_WORDS.join('|')}|score_\\d+)\\b`, 'gi')

/**
 * Krea 2 散文统一净化 —— krea2 渲染分支入口的唯一强制点（与「负面恒空」并列）。
 * 三条铁律：禁 (tag:1.5) 权重语法、禁下划线 token、禁 score/质量词。
 * subjectProse/outfitProse/sceneProse/visualDescription/artistProse/style/medium
 * 全部先过这里，禁止在调用方各自擦除（2026-08-15 审计：此前 sceneProse 等只过
 * clean()，场景模板里的 (xxx:1.5) 会以字面文本进入 Krea）。
 */
function sanitizeKreaProse(value: string): string {
  return String(value || '')
    .replace(/<lora:[^>]+>/gi, '')
    .replace(/\bBREAK\b/gi, ', ')
    .replace(/\(([^()\n]*[a-z][^()\n]*):\s*-?\d+(?:\.\d+)?\s*\)/gi, '$1')
    .replace(KREA_BANNED_WORDS_RE, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function renderPromptPlan(plan: PromptPlan, family: PromptFamily, profile?: ModelProfile | null): { prompt: string; negative: string } {
  const capabilities = resolveDrawCapabilities(family, profile)
  if (capabilities.promptFormat === 'natural-language') {
    const proseSafe: PromptPlan = {
      ...plan,
      subjectProse: sanitizeKreaProse(plan.subjectProse),
      outfitProse: sanitizeKreaProse(plan.outfitProse),
      sceneProse: sanitizeKreaProse(plan.sceneProse),
      visualDescription: sanitizeKreaProse(plan.visualDescription),
      artistProse: sanitizeKreaProse(plan.artistProse),
      style: plan.style.map(sanitizeKreaProse).filter(Boolean),
      medium: sanitizeKreaProse(plan.medium),
    }
    return { prompt: buildStructuredKreaDescription(proseSafe), negative: '' }
  }
  let tags = allTags(plan)
  if (capabilities.promptFormat === 'anima-tags') {
    // Anima Aesthetic：正层全部去掉质量词与 score 词。
    if (profile?.strip_quality_tokens === true) {
      tags = tags.filter(token => !QUALITY_OR_SCORE_RE.test(String(token || '').trim()))
    }
    const formatted = formatPromptForEngine(
      tags.join(', '),
      'anima',
      plan.preserveTokens.concat(profile?.exact_tokens || []),
      profile?.exact_prefixes || [],
    )
    const direction = buildAnimaVisualDirection(plan)
    // 换行是可审计的标签/散文边界，不参与模型 token 去重或精确 LoRA 控制。
    return { prompt: [formatted, direction].filter(Boolean).join('\n'), negative: '' }
  }
  return { prompt: tags.join(', '), negative: plan.negative.join(', ') }
}
