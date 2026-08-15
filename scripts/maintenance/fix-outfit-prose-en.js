/**
 * 修复 popular-characters.json 中 45 个衍生服装的中文/损坏 prose 与 tokens。
 * 背景：调研产出的衍生便服 prose 为「中文设计说明 + 括号英文短语」混合，
 * tokens 大量携带残渣（）、逗号），Anima 英文模型收到污染提示词导致服装乱画。
 * 本脚本将全部重写为干净英文 prose + 有效英文 tokens，并修正两个场景蓝图：
 *  - chen_arknights_r18_rooftop_kiss：R18 室外天台 → 室内公寓（用户：NSFW 场景放室内）
 *  - chen_arknights_night_market：promptProse 的 uniform 与休闲装矛盾 → casual outfit
 *
 * 用法：node scripts/maintenance/fix-outfit-prose-en.js
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const CHAR_FILE = path.join(ROOT, 'data', 'popular-characters.json')
const BP_FILE = path.join(ROOT, 'data', 'scene-blueprints.json')

// outfitId -> { prose, tokens }
const PROSE_FIXES = {
  // ===== 史尔特尔 =====
  ice_cream_cafe_casual: {
    prose: 'a sweet-cool street casual outfit: a loose oatmeal-grey cropped hoodie worn open over a tight black camisole, high-waisted charcoal pleated skirt with a metal-buckle belt, mismatched grey thigh-high socks and retro black-and-white chunky skate sneakers, small black crossbody bag',
    tokens: ['casual_clothes', 'hoodie', 'camisole', 'pleated_skirt', 'thighhighs', 'sneakers', 'crossbody_bag'],
  },
  lava_silk_loungewear: {
    prose: 'a luxurious silk loungewear set: a short black silk slip nightdress with champagne-pink trim and delicate black lace trim at the chest and hem, overlaid with a sheer translucent black silk robe slipping off one shoulder, barefoot',
    tokens: ['silk', 'nightdress', 'lace_trim', 'robe', 'slipping_off_shoulder', 'barefoot'],
  },
  crimson_velvet_evening_gown: {
    prose: 'a dark haute couture evening gown: a wine-red to ink-black gradient heavy velvet fitted long dress with a deep V-neck and open back, high side slit, subtle gold embroidery lining the hem, black choker necklace, elbow-length sheer black lace gloves, hair in a low French bun',
    tokens: ['evening_gown', 'velvet', 'deep_v_neckline', 'open_back', 'side_slit', 'choker', 'long_gloves'],
  },

  // ===== 凯尔希 =====
  rhodes_island_lounge_knit: {
    prose: 'a cozy lounge outfit: an oatmeal chunky-knit oversized turtleneck sweater with a relaxed dropped shoulder, over a sleeveless cotton camisole, paired with deep emerald wide-leg linen lounge trousers',
    tokens: ['chunky_knit', 'oversized', 'turtleneck', 'sweater', 'wide_leg_pants', 'linen', 'lounge'],
  },
  midnight_emerald_silk_robe: {
    prose: 'a deep emerald green silk dressing gown with subtle gold thread woven into the lapels, tied with a matching silk sash, worn over a simple black satin slip nightdress with a deep V back',
    tokens: ['silk', 'dressing_gown', 'satin', 'nightdress', 'deep_v_back', 'green'],
  },
  victorian_traveler_coat: {
    prose: 'a forest-green heavyweight wool greatcoat with dark brown velvet lapels and a detachable shoulder capelet, worn over a ruffled white stand-collar blouse with a burgundy satin ribbon tie',
    tokens: ['greatcoat', 'wool', 'capelet', 'ruffled_collar', 'blouse', 'ribbon_tie'],
  },

  // ===== 陈 =====
  street_gourmet_casual: {
    prose: 'a retro 90s Hong Kong street-style casual outfit: an open vintage floral-print shirt over a plain white tee, slim washed dark jeans, white canvas sneakers, and a small black crossbody sling bag',
    tokens: ['casual_clothes', 'vintage_shirt', 'floral_print', 'jeans', 'sneakers', 'crossbody_bag'],
  },
  morning_kendo_robe: {
    prose: 'a minimalist modern wushu training outfit: a loose white martial-arts gi jacket with dark teal accents, paired with dark teal wide-leg pleated hakama pants and a cloth obi belt',
    tokens: ['gi', 'hakama', 'pleated_skirt', 'martial_arts', 'training_clothes'],
  },
  lgd_detective_undercover: {
    prose: 'a classic hard-boiled detective undercover outfit: a dark charcoal trench coat over a black turtleneck and slim trousers, with polished black oxford leather shoes',
    tokens: ['trench_coat', 'turtleneck', 'black_clothes', 'detective', 'undercover'],
  },

  // ===== 艾雅法拉 =====
  cozy_sheep_fleece_loungewear: {
    prose: 'a fluffy oversized cream-and-tan sherpa fleece hoodie cardigan with a hood, worn like a cozy loungewear set with sheep pajamas, soft warm winter lounge look',
    tokens: ['sherpa_fleece', 'oversized', 'hoodie', 'cardigan', 'pajamas', 'loungewear'],
  },
  siesta_hotspring_yukata: {
    prose: 'a traditional Japanese onsen yukata with a pale floral pattern, light cotton fabric, tied with an obi sash, summer resort hot-spring robe',
    tokens: ['yukata', 'floral_pattern', 'cotton', 'obi', 'hot_spring'],
  },
  leithanien_volcanology_lab_coat: {
    prose: 'an intellectual volcanologist outfit: a white lab coat over a soft knit sweater and skirt, gold half-rim reading glasses, and a tiny silver hearing aid at the ear',
    tokens: ['lab_coat', 'academic', 'sweater', 'glasses', 'hearing_aid'],
  },

  // ===== 蕾缪安 =====
  baking_apron_loungewear: {
    prose: 'a cozy home baking outfit: a cream ribbed knit turtleneck sweater with the sleeves rolled to mid-arm, over a beige linen baking apron with a small apple emblem and big front pockets',
    tokens: ['ribbed_knit', 'turtleneck', 'sweater', 'apron', 'linen', 'baking'],
  },
  rehab_cozy_knitwear: {
    prose: 'a soft recovery lounge outfit: an oversized chunky sage-green cable-knit cardigan over a champagne silk camisole, paired with flowing lounge trousers',
    tokens: ['chunky_knit', 'cardigan', 'silk_camisole', 'lounge_pants', 'sage_green'],
  },
  silk_lace_morning_robe: {
    prose: 'a delicate morning loungewear set: a pearl-white silk slip nightdress with fine French lace trim at the neckline and hem, overlaid with a sheer champagne chiffon lace morning robe',
    tokens: ['silk', 'nightdress', 'lace_trim', 'chiffon', 'morning_robe', 'sheer'],
  },

  // ===== 夕 =====
  atelier_slouchy_loungewear: {
    prose: 'an oversized slouchy ink-grey hoodie printed with a cute hand-drawn ink spirit mascot and splatter calligraphy, loose cotton loungewear shorts, messy hair bun held with a calligraphy brush, paint smudges on sleeves',
    tokens: ['oversized_hoodie', 'slouchy', 'loungewear', 'hoodie', 'ink', 'messy_bun'],
  },
  ink_silk_nightdress: {
    prose: 'a luxurious emerald-and-pearl-white gradient silk slip nightdress with fine black ink-flower lace at the V neckline and a high side slit, overlaid with a sheer gossamer wide-sleeved robe trailing like mist',
    tokens: ['silk', 'nightdress', 'gradient', 'lace_trim', 'side_slit', 'sheer_robe'],
  },
  neo_cyber_ink_techwear: {
    prose: 'a deconstructed ink-techwear outfit: a black strappy high-neck crop tank top, a lightweight techwear hooded jacket with cyan reflective lines and ink-splatter print worn loose off one shoulder, high-waisted black utility cargo pants with magnetic straps, chunky high-top sneakers',
    tokens: ['techwear', 'crop_top', 'utility_pants', 'hooded_jacket', 'high_top_sneakers', 'cyberpunk'],
  },

  // ===== 泥岩 =====
  clay_artisan_apron: {
    prose: 'a pottery artisan outfit: a breathable ivory linen long-sleeve shirt with sleeves rolled to the elbows, over a dark khaki canvas work apron with leather pockets holding wooden carving tools, clay smudges on the apron and fingertips, loose comfortable trousers',
    tokens: ['apron', 'linen_shirt', 'rolled_sleeves', 'work_clothes', 'craftsman'],
  },
  rhodes_oversized_hoodie: {
    prose: 'a super oversized charcoal-grey Rhodes Island hoodie reaching mid-thigh with sleeves past the fingertips, subtle geometric logo on the chest, black athletic shorts hidden under the hem',
    tokens: ['oversized_hoodie', 'hoodie', 'charcoal', 'mengkawaii', 'loungewear'],
  },
  cozy_winter_knit_coat: {
    prose: 'an elegant winter outfit: a thick ivory chunky cable-knit turtleneck sweater, worn under an open dark camel long wool coat, with a soft cashmere scarf',
    tokens: ['cable_knit', 'turtleneck', 'sweater', 'wool_coat', 'scarf', 'winter_clothes'],
  },

  // ===== 芙洛丝（eunectes） =====
  slumber_blueprint_loungewear: {
    prose: 'a relaxed cozy oversized loungewear: a slouchy off-shoulder oversized light-grey hoodie slipping to one side to reveal the collarbone and a black thin-strap camisole, black lounge shorts, knit leg warmers',
    tokens: ['oversized_hoodie', 'off_shoulder', 'loungewear', 'lounge_shorts', 'leg_warmers'],
  },
  rainforest_safari_explorer: {
    prose: 'a rainforest safari utility outfit: an olive sports bralette under an open khaki short-sleeve utility shirt, quick-release climbing harness with metal carabiners at the waist, rugged cargo pants, explorer boots',
    tokens: ['safari', 'utility_shirt', 'cargo_pants', 'harness', 'explorer', 'adventure'],
  },
  gala_night_evening_dress: {
    prose: 'a luxury high-slit evening gown in deep emerald green and satin black panels, asymmetrical one-shoulder neckline with an ornate metal clasp and pendant chain',
    tokens: ['evening_gown', 'high_slit', 'one_shoulder', 'emerald_green', 'satin', 'formal'],
  },

  // ===== 澄闪 =====
  cozy_afternoon_knit_casual: {
    prose: 'a cozy autumn casual knit outfit: an oversized soft pink knit sweater with cream cable patterns, pink twintails peeking from a dark brown wool beret, folded pink cat ears visible, paired with a pleated skirt and tights',
    tokens: ['knit_sweater', 'oversized', 'beret', 'pleated_skirt', 'cat_ears', 'autumn'],
  },
  static_paw_cozy_cat_pajamas: {
    prose: 'a pastel pink-and-white fluffy cat-ear fleece pajama set: an oversized hooded hoodie with realistic cat-ear hood and golden lightning bolt print, matching fleece shorts, ultra soft loungewear',
    tokens: ['cat_ears', 'fleece', 'pajamas', 'hoodie', 'pink', 'lightning'],
  },
  salon_dreamer_work_apron: {
    prose: 'a vintage hair-salon stylist work outfit: high twin ponytails with cat-paw scrunchies, a clean light pink-and-white striped shirt, and a soft sage work apron with pockets, folding pink cat ears visible',
    tokens: ['apron', 'twin_ponytails', 'striped_shirt', 'stylist', 'cat_ears'],
  },

  // ===== 斯卡蒂 =====
  cozy_orca_loungewear: {
    prose: 'an oversized dark charcoal hoodie with a cute white orca silhouette print and sleeves past the fingertips, black cotton lounge shorts, plush slippers',
    tokens: ['oversized_hoodie', 'hoodie', 'charcoal', 'lounge_shorts', 'slippers', 'orca'],
  },
  quiet_barista_uniform: {
    prose: 'a quiet barista outfit: a crisp white button-up collared shirt with sleeves rolled to the forearm, over a dark black canvas waist apron with a red pen and notepad in the front pocket, charcoal tailored trousers',
    tokens: ['button_up_shirt', 'apron', 'barista', 'rolled_sleeves', 'white_shirt'],
  },
  oceanic_symphony_gown: {
    prose: 'a haute couture Aegir symphony gown: a midnight-blue to deep-black gradient velvet strapless gown with a high side slit and faint silver wave embroidery, a single sheer crimson chiffon train draped over one shoulder',
    tokens: ['evening_gown', 'velvet', 'strapless', 'side_slit', 'gradient', 'chiffon'],
  },

  // ===== 羽毛笔 =====
  sleepy_oversized_loungewear: {
    prose: 'an oversized dusty pink-lilac pullover hoodie with sleeves far past the fingertips, white cotton lounge shorts underneath, cozy sleepy loungewear',
    tokens: ['oversized_hoodie', 'pullover', 'pink', 'loungewear', 'mengkawaii'],
  },
  classic_bartender_apron: {
    prose: 'a classic bartender outfit: a dark brown canvas half apron with leather harness straps over a crisp white short-sleeve collared shirt with a crimson ribbon tie at the collar',
    tokens: ['apron', 'white_shirt', 'short_sleeves', 'ribbon_tie', 'bartender'],
  },
  dossoles_tropical_casual: {
    prose: 'a tropical resort casual outfit: a white off-shoulder ruffled crop top, high-waisted light-blue distressed denim shorts with a woven brown leather belt, strappy sandals',
    tokens: ['crop_top', 'off_shoulder', 'denim_shorts', 'tropical', 'sandals'],
  },

  // ===== 能天使 =====
  lazy_dorm_oversized_loungewear: {
    prose: 'an extra-oversized heather-grey crewneck sweatshirt with the hem falling to mid-thigh in a lazy shirt-dress look, red-and-white striped fluffy knee-high socks, tiny cotton shorts underneath',
    tokens: ['oversized_sweatshirt', 'crewneck', 'shirt_dress', 'kneehighs', 'loungewear'],
  },
  apple_pie_bakery_patissiere: {
    prose: 'a warm home-baking outfit: a cream loose-knit sweater, beige pleated mini skirt, brown cotton tights, and a vintage beige strap apron with a small apple print',
    tokens: ['loose_knit', 'sweater', 'pleated_skirt', 'apron', 'baking', 'tights'],
  },
  lungmen_streetwear_skater: {
    prose: 'a dynamic streetwear outfit: an oversized red-and-white colorblock hoodie over a translucent techwear utility vest, over-ear wireless headphones around the neck, black cargo pants and chunky sneakers',
    tokens: ['colorblock', 'hoodie', 'techwear', 'vest', 'headphones', 'streetwear'],
  },

  // ===== 铃兰 =====
  cozy_fluffy_pajamas: {
    prose: 'a pastel fleece loungewear set in cream white, butter yellow and peach pink: an extremely oversized fluffy hoodie with a hood and matching fleece shorts, soft cozy pajamas',
    tokens: ['fleece', 'pajamas', 'hoodie', 'pastel', 'loungewear'],
  },
  greenhouse_florist_smock: {
    prose: 'a cottagecore florist outfit: a linen pinafore apron dress in oat and coffee tones over an ivory puff-sleeve blouse, brass buttons and a front pocket, gardening smock',
    tokens: ['pinafore', 'apron_dress', 'puff_sleeves', 'blouse', 'cottagecore'],
  },
  higashi_summer_yukata: {
    prose: 'a Japanese summer festival yukata in pale mint green, pastel pink and ivory, printed with swimming red goldfish, light cotton fabric with an obi sash',
    tokens: ['yukata', 'summer_festival', 'floral_pattern', 'mint_green', 'obi'],
  },

  // ===== 佩丽卡 =====
  supervisor_lounge_knitwear: {
    prose: 'a cozy oversized chunky cream-white knit sweater with a relaxed neckline showing the collarbone, high-waist lounge trousers, soft indoor loungewear',
    tokens: ['oversized_knit', 'sweater', 'loungewear', 'cream', 'high_waist'],
  },
  endfield_techwear_street: {
    prose: 'a cyberpunk techwear street outfit: a cropped black-and-white techwear biker jacket over a ribbed charcoal crop tank top, high-waist techwear cargo pants with cyan line accents and straps, chunky sneakers',
    tokens: ['techwear', 'biker_jacket', 'crop_top', 'cargo_pants', 'cyberpunk'],
  },
  sub_zero_frostfield_parka: {
    prose: 'a heavy insulated arctic parka in glacier white and grey-blue panels with a fluffy white fur-lined hood, worn over a thermal turtleneck and insulated trousers, winter combat gear',
    tokens: ['parka', 'winter_coat', 'fur_trim', 'insulated', 'turtleneck', 'snow'],
  },

  // ===== 莱万汀 =====
  cozy_dorm_loungewear: {
    prose: 'a minimalist cozy loungewear for a private cabin: an oversized charcoal drop-shoulder hoodie with a tail slot at the back hem, soft cotton lounge shorts, over-knee cotton socks',
    tokens: ['oversized_hoodie', 'hoodie', 'loungewear', 'lounge_shorts', 'tail'],
  },
  street_cafe_sweet: {
    prose: 'a light techwear street outfit for a cafe visit: a black halter crop top under a slightly open cropped sheer grey techwear jacket, black high-waist pleated utility miniskirt with metal buckles and dark red lining, chunky sneakers',
    tokens: ['crop_top', 'techwear', 'pleated_skirt', 'miniskirt', 'streetwear'],
  },
  obsidian_formal_gown: {
    prose: 'a dramatic black-to-crimson gradient haute couture evening gown: a halter-neck deep plunge gown with an open back, the black tail emerging seamlessly from the open back, elegant high fashion',
    tokens: ['evening_gown', 'halter_neckline', 'deep_plunge', 'open_back', 'black', 'crimson'],
  },
}

// 场景蓝图修复
const BP_FIXES = {
  // 用户反馈：R18 场景应在室内（原为龙门高楼天台）
  chen_arknights_r18_rooftop_kiss: {
    title: '深夜窗畔',
    description: '深夜公寓，落地窗前的城市灯火。',
    location: '龙门高层公寓客厅',
    action: '倚着落地窗，回眸凝视',
    promptProse: "Late at night inside a private high-rise apartment in Lungmen, Ch'en leans back against the floor-to-ceiling window with no other people present, the glittering city lights far below and moonlight streaming through the glass as she holds the viewer's gaze.",
    sceneTags: ['apartment', 'interior', 'floor_to_ceiling_window', 'night', 'city_light', 'moonlight'],
  },
  // 场景描述写 her uniform 与休闲装矛盾
  chen_arknights_night_market: {
    promptProse: "In the lantern-lit night market of Lungmen, Ch'en pauses between stalls with no other people present, warm neon glow reflecting off her casual outfit as she scans the crowd with sharp golden eyes.",
  },
}

function main() {
  const chars = JSON.parse(fs.readFileSync(CHAR_FILE, 'utf8'))
  let fixed = 0
  for (const c of chars.characters) {
    for (const o of c.outfits || []) {
      const fix = PROSE_FIXES[o.id]
      if (!fix) continue
      o.prose = fix.prose
      o.tokens = fix.tokens
      fixed++
    }
  }
  fs.writeFileSync(CHAR_FILE, JSON.stringify(chars, null, 2) + '\n')
  console.log(`outfits fixed: ${fixed}`)

  const bp = JSON.parse(fs.readFileSync(BP_FILE, 'utf8'))
  let bpFixed = 0
  for (const b of bp.blueprints) {
    const fix = BP_FIXES[b.id]
    if (!fix) continue
    for (const [k, v] of Object.entries(fix)) {
      b[k] = v
    }
    bpFixed++
  }
  fs.writeFileSync(BP_FILE, JSON.stringify(bp, null, 2) + '\n')
  console.log(`blueprints fixed: ${bpFixed}`)

  // 复查：不应再有任何中文 prose
  const re = /[\u4e00-\u9fff]/
  const remain = []
  for (const c of chars.characters) {
    for (const o of c.outfits || []) {
      if (re.test(o.prose || '')) remain.push(`${c.id}.${o.id}`)
    }
  }
  console.log(`remaining chinese prose: ${remain.length}`)
  if (remain.length) console.log(' - ' + remain.join('\n - '))
}

main()
