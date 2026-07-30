const EXACT_MEANINGS: Record<string, string> = {
  nene_r18: '宁宁成人状态门控词',
  natsume_r18: '夏目成人状态门控词',
  nene_witch_canonical: '宁宁经典魔女服主控制词',
  nene_school_uniform: '宁宁学院制服主控制词',
  nene_sailor_uniform: '宁宁水手制服主控制词',
  nene_blue_pajamas: '宁宁蓝色睡衣主控制词',
  nene_green_sleepwear: '宁宁绿色睡衣主控制词',
  nene_red_cardigan_uniform: '宁宁红色开衫制服主控制词',
  natsume_official_qipao: '夏目官方旗袍主控制词',
  natsume_cafe_uniform: '夏目咖啡馆制服主控制词',
  natsume_maid_uniform: '夏目女仆服主控制词',
  natsume_sleepwear: '夏目睡衣主控制词',
  looking_at_viewer: '直视镜头',
  looking_back: '回头看向镜头',
  direct_eye_contact: '与镜头直接对视',
  full_body: '全身构图',
  upper_body: '上半身构图',
  medium_shot: '中景构图',
  close_up: '近景特写',
  wide_shot: '广角远景',
  face_focus: '面部重点清晰',
  soft_lighting: '柔和光线',
  warm_lighting: '暖色光线',
  morning_light: '晨间光线',
  window_light: '窗边自然光',
  cinematic_composition: '电影感构图',
  official_visual_novel_cg_framing: '官方视觉小说 CG 构图',
  natural_body_proportions: '自然身体比例',
  clearly_different_faces: '角色脸部特征清晰区分',
  two_red_hairclips: '两枚红色发夹',
  mole_under_eye: '眼下泪痣',
  no_hair_ribbon: '不使用发带',
  very_long_black_hair: '极长黑发',
  golden_yellow_eyes: '金黄色眼睛',
  white_silver_hair: '银白色头发',
  very_long_low_twintails: '极长低双马尾',
  black_thighhighs: '黑色过膝袜',
  black_thighhigh_stockings: '黑色大腿袜',
  cherry_blossoms: '樱花',
  school_rooftop: '学校天台',
  cafe: '咖啡馆',
  bookstore_interior: '书店室内',
  bedroom: '卧室',
  sunset: '黄昏日落',
  golden_hour: '日落黄金时刻',
  rainy_night: '雨夜',
  starry_sky: '星空',
  subtle_blush: '轻微脸红',
  reserved_smile: '克制的微笑',
  shy_direct_eye_contact: '害羞地直视镜头',
  holding_hands: '牵手',
  on_bed: '在床上',
  side_view: '侧面视角',
  pov: '第一人称视角',
}

const WORD_MEANINGS: Record<string, string> = {
  adult: '成年', all: '全部', angle: '角度', angel: '天使', apron: '围裙', at: '在', back: '背部',
  background: '背景', beach: '海边', bed: '床', black: '黑色', blue: '蓝色', body: '身体', both: '双手',
  bow: '蝴蝶结', bookstore: '书店', brown: '棕色', bun: '发髻', camera: '镜头', campus: '校园',
  cafe: '咖啡馆', casual: '日常', chair: '椅子', china: '旗袍', chinese: '中式', city: '城市',
  classroom: '教室', clear: '晴朗', clothes: '服装', close: '近景', closed: '闭合', composition: '构图',
  contact: '接触', cream: '奶油色', cute: '可爱', dark: '深色', day: '白天', desk: '书桌',
  detailed: '细节丰富', dim: '昏暗', direct: '直接', double: '双重', dress: '连衣裙',
  even: '均匀', expression: '表情', eye: '眼睛', eyes: '眼睛', face: '脸部', flower: '花朵',
  focus: '重点', floral: '花卉', footwear: '鞋履', full: '全身', girl: '女孩', gold: '金色',
  golden: '金色', hair: '头发', hall: '大厅', hand: '手', hands: '双手', high: '高', holding: '拿着',
  indoors: '室内', jacket: '外套', lecture: '讲堂', light: '光线', lighting: '光照', long: '长',
  looking: '看向', low: '低', maid: '女仆', medium: '中景', morning: '早晨', natural: '自然',
  night: '夜晚', notes: '笔记', official: '官方', one: '一件', open: '打开', outfit: '服装',
  pants: '长裤', pantyhose: '连裤袜', pillow: '枕头', pink: '粉色', portrait: '肖像',
  proportions: '比例', qipao: '旗袍', red: '红色', reserved: '克制', ribbon: '发带', room: '房间',
  school: '学校', scene: '场景', seat: '座位', serious: '严肃', shirt: '衬衫', shot: '镜头',
  shy: '害羞', side: '侧面', simple: '简单', sky: '天空', skirt: '裙子', slit: '开衩',
  small: '小型', soft: '柔和', solo: '单人', standing: '站立', summer: '夏日', sunset: '日落',
  trim: '饰边', uniform: '制服', university: '大学', viewer: '镜头', warm: '暖色', white: '白色',
  wide: '广角', window: '窗边', with: '搭配', yellow: '黄色',
}

const GENERIC_MEANINGS = new Set(['场景词条', '场景成人词', 'v18 训练服装词'])

function cleanTag(tag: string): string {
  return String(tag || '')
    .replace(/^\s*<lora:|>\s*$/gi, '')
    .replace(/^\s*\(+|\)+\s*$/g, '')
    .replace(/:\s*-?\d+(?:\.\d+)?\s*$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, '_')
}

/** Returns the catalog Chinese label when present, otherwise a readable token glossary. */
export function tagMeaning(tag: string, catalogLabel = ''): string {
  const supplied = String(catalogLabel || '').trim()
  if (supplied && !GENERIC_MEANINGS.has(supplied)) return supplied

  const normalized = cleanTag(tag)
  if (EXACT_MEANINGS[normalized]) return EXACT_MEANINGS[normalized]

  const words = normalized.split('_').filter(Boolean)
  const translated = words.map(word => WORD_MEANINGS[word])
  if (translated.some(Boolean)) {
    return translated.map((meaning, index) => meaning || words[index]).join(' · ')
  }
  return '未收录释义'
}
