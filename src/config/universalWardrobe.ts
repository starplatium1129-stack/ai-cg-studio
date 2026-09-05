export interface UniversalWardrobePreset {
  id: string
  label: string
  icon?: string
  description: string
  tags: string[]
}

/** 全角色通用·二次元经典特殊特典战袍预设（独立懒加载模块） */
export const UNIVERSAL_WARDROBE_PRESETS: UniversalWardrobePreset[] = [
  {
    id: 'virgin-killer-white',
    label: '纯白露背高领毛衣',
    description: '童贞杀手·侧乳大露背与短袜',
    tags: ['virgin_killer_sweater', 'backless_sweater', 'turtleneck_sweater', 'sleeveless_sweater', 'sideboob', 'bare_back', 'bare_shoulders', 'bare_legs', 'frilled_socks'],
  },
  {
    id: 'virgin-killer-black',
    label: '黑色修身露背毛衣',
    description: '冷艳修身·侧乳微露与腰窝线条',
    tags: ['virgin_killer_sweater', 'black_sweater', 'backless_sweater', 'turtleneck_sweater', 'sleeveless_sweater', 'sideboob', 'bare_back', 'bare_shoulders', 'bare_legs'],
  },
  {
    id: 'glossy-bunny',
    label: '黑色漆皮反光兔女郎',
    description: '经典反光胶衣·网袜与细高跟',
    tags: ['bunny_suit', 'glossy_latex', 'bunny_ears', 'bowtie', 'cuffs', 'bare_shoulders', 'cleavage', 'fishnet_thighhighs', 'high_heels'],
  },
  {
    id: 'sheer-bunny',
    label: '半透明透肉情趣兔女郎',
    description: '薄纱勒肉·胸口开孔与吊带黑丝',
    tags: ['sheer_bunny_suit', 'bunny_suit', 'bunny_ears', 'translucent_cloth', 'see-through', 'cleavage_cutout', 'bare_shoulders', 'garter_straps', 'black_thighhighs', 'stiletto_heels'],
  },
  {
    id: 'front-tie-bikini',
    label: '前系带蝴蝶结比基尼',
    description: '胸前系带细绳·海滨纯欲风情',
    tags: ['front-tie_bikini', 'triangle_bikini', 'striped_bikini', 'side-tie_panties', 'cleavage', 'bare_shoulders', 'bare_midriff', 'barefoot'],
  },
  {
    id: 'criss-cross-bikini',
    label: '黑色缠腰绑带水着',
    description: '腹部细绳交叉缠绕·性感微型比基尼',
    tags: ['criss-cross_bikini', 'black_bikini', 'wrap_bikini', 'side-tie_panties', 'midriff_straps', 'cleavage', 'bare_midriff', 'barefoot'],
  },
  {
    id: 'santa-capelet',
    label: '红白露肩雪绒圣诞装',
    description: '冬夜雪景·红色短斗篷与毛绒球',
    tags: ['santa_costume', 'red_dress', 'white_fur_trim', 'santa_hat', 'santa_capelet', 'off_shoulder', 'black_belt', 'white_thighhighs', 'black_boots'],
  },
  {
    id: 'sheer-babydoll',
    label: '前开襟透明薄纱睡袍',
    description: '极薄透肉·前襟轻敞与吊带蕾丝',
    tags: ['sheer_babydoll', 'open-front_negligee', 'translucent_cloth', 'see-through', 'falling_strap', 'bare_shoulders', 'cleavage', 'bare_legs', 'silk_slip'],
  },
  {
    id: 'lingerie-garter',
    label: '黑色蕾丝吊带袜战袍',
    description: '金属吊带扣·大腿勒痕与开档直视',
    tags: ['black_lace_lingerie', 'bra_lift', 'exposed_breasts', 'bare_breasts', 'nipples', 'areola', 'garter_straps', 'black_thighhighs', 'tight_straps', 'crotchless_panties', 'exposed_pussy', 'pussy_juice'],
  },
  {
    id: 'oversized-boyfriend-shirt',
    label: '松垮男友白衬衫',
    description: '下衣失踪·领口纽扣半解与香肩滑落',
    tags: ['oversized_shirt', 'boyfriend_shirt', 'white_shirt', 'unbuttoned', 'falling_strap', 'bare_shoulders', 'collarbone', 'bare_legs', 'bottomless'],
  },
]
