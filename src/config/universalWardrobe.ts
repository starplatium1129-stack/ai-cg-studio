export interface UniversalWardrobePreset {
  id: string
  label: string
  icon?: string
  description: string
  tags: string[]
}

/** 全角色通用·二次元经典特殊特典战袍预设（独立懒加载模块） */
export const UNIVERSAL_WARDROBE_PRESETS: UniversalWardrobePreset[] = [
  // --- 泳装篇：四大二次元经典现象级名场面 ---
  {
    id: 'wet-shirt-bikini',
    label: '海滩湿透透光白衬衫水着',
    description: '夏日名场面·湿透半透明白衬衫紧贴·内衬比基尼若隐若现',
    tags: ['wet_white_shirt', 'see-through_shirt', 'bikini_under_clothes', 'drenched', 'triangle_bikini', 'side-tie_panties', 'cleavage', 'bare_legs', 'barefoot'],
  },
  {
    id: 'competition-swimsuit',
    label: '纯白高叉竞泳水着 (死库水)',
    description: '线条与紧绷勒肉极致·深V拉链反光材质·平坦小腹与大腿根部弧度',
    tags: ['white_competition_swimsuit', 'competition_swimsuit', 'highleg_swimsuit', 'glossy_fabric', 'cleavage', 'bare_legs', 'barefoot'],
  },
  {
    id: 'micro-string-bikini',
    label: '极简微型细绳系带比基尼',
    description: '极致极简布料·纤细绳结与侧系带·深邃马甲线与纯欲风情',
    tags: ['micro_bikini', 'string_bikini', 'minimal_fabric', 'triangle_bikini', 'side-tie_panties', 'cleavage', 'bare_midriff', 'barefoot'],
  },
  {
    id: 'cutout-monokini',
    label: '黑色挂脖镂空连体泳装',
    description: '御姐天花板·腰腹大面积菱形镂空·挂脖深V与露腰反差',
    tags: ['monokini', 'halterneck_swimsuit', 'black_bikini', 'side_cutout', 'cleavage_cutout', 'bare_midriff', 'bare_hips', 'barefoot'],
  },

  // --- 毛衣/战袍篇：同人现象级神装 ---
  {
    id: 'keyhole-sweater',
    label: '心形开胸高领修身毛衣',
    description: '同人霸榜战袍·高领无袖罗纹针织·胸口心形开孔饱满深沟',
    tags: ['keyhole_sweater', 'heart_cutout', 'cleavage_opening', 'sleeveless_turtleneck', 'ribbed_sweater', 'bare_shoulders', 'bare_legs'],
  },
  {
    id: 'virgin-killer-white',
    label: '纯白童贞杀手露背毛衣',
    description: '传世经典·无袖侧乳微露·大露背至腰窝弧度',
    tags: ['virgin_killer_sweater', 'backless_sweater', 'turtleneck_sweater', 'sleeveless_sweater', 'sideboob', 'bare_back', 'bare_shoulders', 'bare_legs', 'frilled_socks'],
  },
  {
    id: 'virgin-killer-black',
    label: '黑色冷艳修身露背毛衣',
    description: '极致修身显瘦·黑色针织与腰臀比·侧乳与背部肌肤反差',
    tags: ['virgin_killer_sweater', 'black_sweater', 'backless_sweater', 'turtleneck_sweater', 'sleeveless_sweater', 'sideboob', 'bare_back', 'bare_shoulders', 'bare_legs'],
  },

  // --- 兔女郎与紧身胶衣篇 ---
  {
    id: 'glossy-bunny',
    label: '黑色漆皮高光经典兔女郎',
    description: '正统派·高叉反光紧身胶衣·绒毛兔尾·网袜与细高跟',
    tags: ['bunny_suit', 'glossy_latex', 'bunny_ears', 'bowtie', 'cuffs', 'bare_shoulders', 'cleavage', 'fishnet_thighhighs', 'high_heels'],
  },
  {
    id: 'sheer-bunny',
    label: '半透明透肉薄纱兔女郎',
    description: '勒肉情趣·深V开孔透薄软纱·金属吊带袜扣与尖头细跟',
    tags: ['sheer_bunny_suit', 'bunny_suit', 'bunny_ears', 'translucent_cloth', 'see-through', 'cleavage_cutout', 'bare_shoulders', 'garter_straps', 'black_thighhighs', 'stiletto_heels'],
  },
  {
    id: 'sleek-bodysuit',
    label: '紧身无痕连体瑜伽衣 (Catsuit)',
    description: '无痕第二层肌肤·深凹大露背·蜜桃臀与饱满腰臀比',
    tags: ['sleeveless_bodysuit', 'skin-tight', 'form-fitting', 'backless_bodysuit', 'bare_shoulders', 'cleavage', 'bare_legs', 'barefoot'],
  },

  // --- 居家女友/男友风篇：纯欲下衣失踪 ---
  {
    id: 'boyfriend-jersey',
    label: '下衣失踪·男友宽大运动球衣',
    description: '元气纯欲·宽大深色篮球无袖背心·滑落香肩与底裤失踪露白腿',
    tags: ['oversized_jersey', 'basketball_jersey', 'sleeveless_jersey', 'falling_strap', 'bare_shoulders', 'collarbone', 'bare_legs', 'bottomless', 'barefoot'],
  },
  {
    id: 'oversized-boyfriend-shirt',
    label: '下衣失踪·松垮男友白衬衫',
    description: '清晨微光·领口纽扣半解·香肩滑落与修长裸腿',
    tags: ['oversized_shirt', 'boyfriend_shirt', 'white_shirt', 'unbuttoned', 'falling_strap', 'bare_shoulders', 'collarbone', 'bare_legs', 'bottomless'],
  },

  // --- 节日与私密睡袍/情趣篇 ---
  {
    id: 'sheer-babydoll',
    label: '前开襟透明薄纱蕾丝睡袍',
    description: '极薄透肉·前襟轻敞与细吊带·隐现雪肌与大腿绝对领域',
    tags: ['sheer_babydoll', 'open-front_negligee', 'translucent_cloth', 'see-through', 'falling_strap', 'bare_shoulders', 'cleavage', 'bare_legs', 'silk_slip'],
  },
  {
    id: 'lingerie-garter',
    label: '黑色蕾丝吊带袜高开叉战袍',
    description: '情趣天花板·大腿金属吊带勒痕·托胸蕾丝与私密直视',
    tags: ['black_lace_lingerie', 'bra_lift', 'exposed_breasts', 'bare_breasts', 'nipples', 'areola', 'garter_straps', 'black_thighhighs', 'tight_straps', 'crotchless_panties', 'exposed_pussy', 'pussy_juice'],
  },
  {
    id: 'santa-capelet',
    label: '红白露肩雪绒圣诞装',
    description: '冬夜约会·红白毛绒短斗篷·露肩抹胸红裙与过膝白丝',
    tags: ['santa_costume', 'red_dress', 'white_fur_trim', 'santa_hat', 'santa_capelet', 'off_shoulder', 'black_belt', 'white_thighhighs', 'black_boots'],
  },
]
