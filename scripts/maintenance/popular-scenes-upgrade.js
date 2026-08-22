'use strict';
/**
 * 热门角色场景库二次优化迁移脚本（2026-08-23）
 *
 * 目标（对齐用户验收标准）：
 *   ① 服装覆盖：每位角色的每套服装至少被 1 个场景引用（补海梦 cosplay 缺口）
 *   ② 分类覆盖：每角色 ≥1 名场景(iconic) + ≥1 日常(daily)；成人侧 ≥1 特殊NSFW(special_nsfw)
 *      —— 全部落为可机审的 coverageTags 显式标注
 *   ③ 风格统一：13 条非法 kreaStyleHint「adult-sensual」修复为 r18_* 配方 id
 *   ④ 壁纸级质感：全量蓝图注入画质/光影 token；原型场景追加一句壁纸级氛围散文；
 *      recommendedSize 升至高分辨率（1152x1536 / 1536x1152，旧底模由视图层 closestSupportedSize 收敛）
 *
 * 幂等：重复运行自动跳过已应用项。用法：node scripts/maintenance/popular-scenes-upgrade.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', 'data', 'scene-blueprints.json');

// ── ① 名场面策展（43 角色 × 恰好 1 个原作标志性瞬间）────────────────────────
const ICONIC = {
  alisa_mikhailovna_kujou: 'alya_classroom_window_blush',     // 窗边俄语低语=本篇招牌
  artoria_pendragon: 'artoria_moonlit_city',                  // 「请问，你是我的御主吗？」
  chen_arknights: 'chen_arknights_lungmen_patrol',            // 龙门近卫局巡街
  dusk_arknights: 'dusk_arknights_painting_studio',           // 泼墨画卷·万千水墨腾空起(S3)
  elaina: 'elaina_cloud_flying',                              // 魔女之旅·云端飞行
  emilia_rezero: 'emilia_rezero_court',                       // 王选宫廷
  eunectes_arknights: 'eunectes_arknights_wrench_pose',       // 扳手英姿·森蚺工坊
  exusiai_arknights: 'exusiai_arknights_package_run',         // 极速派送·企鹅物流
  eyjafjalla_arknights: 'eyjafjalla_arknights_craters_edge',  // 火山口边缘·火山学家
  fern_frieren: 'fern_forest_staff_casting',                  // 晨雾森林极速魔法
  frieren: 'frieren_graveyard',                               // 辛美尔之墓·全作题眼
  goldenglow_arknights: 'goldenglow_arknights_library_desk',  // 理发沙龙前台
  hatsune_miku: 'hatsune_miku_concert',                       // 初音演唱会舞台
  illyasviel_von_einzbern: 'illyasviel_grail_war',            // 圣杯战争·Berserker 之主
  jeanne_alter: 'jalter_flaming_ruins_flag',                  // 邪龙黑旗·烈焰废墟
  kaltsit_arknights: 'kaltsit_arknights_mon3tr_shadow',       // Mon3tr 降临
  kisara_engage_kiss: 'kisara_battle_night',                  // 都市恶魔战斗·恶魔形态
  kitagawa_marin: 'kitagawa_marin_convention',                // 漫展高光·黑江雫 Cosplay
  laevatain_arknights: 'laevatain_arknights_lava_forge',      // 熔岩工坊·炎剑之名
  lemuen_arknights: 'lemuen_arknights_laterano_church',       // 拉特兰教堂·圣徒狙击手
  makima: 'makima_dominion_night',                            // 支配之夜·恶魔真身
  matou_sakura: 'sakura_emiya_kitchen_cooking',               // 卫宫家厨房·间桐樱的归处
  mimori_byakuya: 'byakuya_magical_combat_alley',             // 雨中小巷魔法少女变身
  misaka_mikoto: 'misaka_mikoto_electric_battle',             // 超电磁炮·电光战场
  mudrock_arknights: 'mudrock_arknights_armor_workshop',      // 装甲整备·萨卡兹佣兵
  perlica_arknights: 'perlica_arknights_endfield_lab',        // 终末地实验室
  quillpen_arknights: 'quillpen_arknights_post_office',       // 多索雷斯调酒
  raiden_shogun: 'raiden_shogun_tenshukaku',                  // 天守阁内廷·无想的一心
  rem_rezero: 'rem_rezero_mansion',                           // 宅邸女仆·蕾姆的本职
  reze_chainsaw: 'reze_ferris_wheel_fireworks',               // 摩天轮烟花·炸弹恶魔之恋
  roxy_migurdia: 'roxy_migurdia_academy',                     // 魔法学院·水圣级导师
  saint_cecilia: 'cecilia_church_stained_glass_praying',      // 彩绘玻璃下的祈祷
  sakurajima_mai: 'sakurajima_mai_library',                   // 野生兔女郎·图书馆奇遇
  skadi_arknights: 'skadi_arknights_abyss_shore',             // 深渊海岸·阿戈尔猎人
  surtr_arknights: 'surtr_arknights_volcano_ruins',           // 黄昏灭世·莱瓦汀巨剑
  suzuran_arknights: 'suzuran_arknights_wildflower_field',    // 花田铃兰
  sylphiette: 'sylphiette_buena_village_tree',                // 布耶纳村大树·童年之约
  tohsaka_rin: 'tohsaka_rin_mansion',                         // 远坂工坊·红宝石魔术充能
  tokisaki_kurumi: 'tokisaki_kurumi_moon_clocktower',         // 月下钟楼·刻刻帝
  yor_forger: 'yor_moonlit_rooftop_stiletto',                 // 荆棘公主·月下双针
  yuigahama_yui: 'yui_service_club_sunset',                   // 侍奉部活动室·夕阳红茶
  yukinoshita_yukino: 'yukinoshita_yukino_clubroom',          // 侍奉部教室·雪之下
  yuzuriha_inori: 'yuzuriha_inori_stage',                     // 歌姬舞台·Departures
};

// ── ② 日常补标（分类不含「日常」字样但内容确属日常生活的场景）───────────────
const DAILY_EXTRA = {
  dusk_arknights: ['dusk_arknights_tea_and_ink', 'dusk_arknights_rain_courtyard'],   // 煮茶研墨 / 檐下听雨
  exusiai_arknights: ['exusiai_arknights_wing_rest'],                                 // 长椅小憩
  laevatain_arknights: ['laevatain_arknights_icecream_break', 'laevatain_arknights_canteen_hotpot'],
  perlica_arknights: ['perlica_arknights_canteen_routine'],                           // 舰内食堂
};
// 分类名命中即视为日常（现代日常/温馨日常/泰拉日常/日常羁绊/现代校园…）
const DAILY_CATEGORY_RE = /日常|羁绊|校园/;

// ── ③ 特殊 NSFW 策展 ────────────────────────────────────────────────────────
// 已有显式特殊元素、只需打标的场景（token 已含 focus 类标签）
const SPECIAL_TAG_ONLY = [
  'tokisaki_kurumi_r18_armpit',            // 腋下 focus
  'frieren_r18_elf_ears',                  // 精灵耳尖触碰
  'artoria_r18_nape',                      // 颈后与散发
  'yuzuriha_inori_r18_navel',              // 脐部 focus
  'misaka_mikoto_r18_thighs',              // 大腿 focus
  'kisara_engage_kiss_r18_thigh_bandage',  // 绷带大腿
  'suzuran_arknights_r18_tails_wrap',      // 九尾环绕
  'skadi_arknights_r18_cabin_rope',        // 半脱作战服
];
// 需要定向补强特殊元素的场景：tokens 追加 + nsfwProse 追加一句
const SPECIAL_ENHANCE = {
  dusk_arknights_r18_studio_scrolls: {
    tokens: ['barefoot', '5_toes', 'detailed_toes', 'detailed_feet', 'foot_focus'],
    prose: 'The eye travels down the unrolled scrolls to her elegantly outstretched feet, ink-washed toes curling softly as candlelight traces their delicate lines.',
  },
  surtr_arknights_r18_lava_glow: {
    tokens: ['armpit_focus', 'arms_up', 'stretching_pose'],
    prose: 'She stretches both arms overhead to tie up her hair, baring her underarms to the molten glow in an unhurried, teasing display.',
  },
  kaltsit_arknights_r18_desk_night: {
    tokens: ['black_gloves', 'elbow_gloves', 'glove_focus', 'partially_clothed'],
    prose: 'Only her black elbow gloves remain on as she leans over the desk, gloved fingers tracing idle lines while everything else has been set aside.',
  },
  chen_arknights_r18_apartment: {
    tokens: ['necktie_loosened', 'uniform_half_off', 'partially_clothed'],
    prose: 'Her uniform hangs half-off with the necktie pulled loose, collar open just enough to blur the line between duty and desire.',
  },
  eyjafjalla_arknights_r18_dorm_blanket: {
    tokens: ['oversized_sweater_pulled_up', 'sweater_only', 'partially_clothed'],
    prose: 'An oversized wool sweater is all she wears, hem tugged up high as she burrows into the blanket with a shy, wool-warmed flush.',
  },
  lemuen_arknights_r18_bedroom_wing: {
    tokens: ['wing_focus', 'wings_spread', 'feather_details'],
    prose: 'Her wings spread slowly across the sheets, every feather catching lamplight as they tremble with quiet, sacred intimacy.',
  },
  mudrock_arknights_r18_bed_hands: {
    tokens: ['hand_focus', 'interlocked_fingers', 'palm_kiss'],
    prose: 'The frame lingers on interlocked fingers and a kiss pressed into her scarred palm, tenderness mapped line by line.',
  },
  eunectes_arknights_r18_mech_seat: {
    tokens: ['tail_coil', 'snake_tail_wrapped', 'straddling_seat'],
    prose: 'Her powerful snake tail coils loosely around the pilot seat and your waist, pulling you into a possessive, scaly embrace.',
  },
  goldenglow_arknights_r18_greenhouse_night: {
    tokens: ['animal_ear_focus', 'cat_tail_caress', 'fluffy_tail'],
    prose: 'A careful hand sinks into her impossibly fluffy tail, and her ears flick helplessly as a full-body shiver gives away how much she loves it.',
  },
  exusiai_arknights_r18_bed_late: {
    tokens: ['halo_focus', 'halo_touched', 'floating_halo'],
    prose: 'Fingertips brush her floating halo and she melts instantly, the ring pulsing soft light with every shivery breath.',
  },
  quillpen_arknights_r18_couch_letter: {
    tokens: ['belly_focus', 'hand_on_belly', 'navel'],
    prose: 'A warm palm rests over the soft curve of her belly, tracing slow circles that make her squirm and giggle into the cushions.',
  },
  laevatain_arknights_r18_quarters_flame: {
    tokens: ['dragon_tail_coil', 'tail_tip_touch', 'tiptoes'],
    prose: 'The hot tip of her dragon tail traces idle patterns along the bedding while she rises on tiptoes, embers of warmth following every touch.',
  },
};
// 兜底启发式：nsfwTokens/id/title 命中即打标（覆盖其余 23 位角色）
const SPECIAL_HEURISTIC_RE = /feet|toe|sole|foot_|footjob|collar|leash|bondag|blindfold|shibari|handcuff|pantyhose|exhibit|public_|voyeur|toys|vibrator|femdom|facesitt|edging|orgasm_denial|spank|pegging|anal|deepthroat|throat|armpit|navel|thigh_focus|leg_focus|back_focus|nape|bandage|tail_wrap|wing_focus|halo_focus|belly_focus|hand_focus|glove_focus|tail_coil/i;

// ── ④ 风格 hint 修复（adult-sensual 不是合法配方 id，会被当自由短语拼进提示词开头）──
const HINT_FIX = {
  sakurajima_mai_r18_hotel: 'r18_elegant_boudoir',
  sakurajima_mai_r18_pantyhose: 'r18_sensual_cg',
  frieren_r18_inn_bath: 'r18_sensual_cg',
  makima_r18_collar_leash: 'r18_sensual_cg',
  tohsaka_rin_r18_black_thighhighs: 'r18_sensual_cg',
  kitagawa_marin_r18_toes: 'r18_sensual_cg',
  kaltsit_arknights_r18_cabin_robe: 'r18_elegant_boudoir',
  dusk_arknights_r18_studio_scrolls: 'r18_elegant_boudoir',
  laevatain_arknights_r18_quarters_flame: 'r18_elegant_boudoir',
  alya_r18_bedroom_soles_foreshortening: 'r18_sensual_cg',
  sylphiette_r18_bedroom_soles_foreshortening: 'r18_sensual_cg',
  jalter_r18_throne_spread_legs: 'r18_sensual_cg',
  fern_r18_inn_bed_spread_pout: 'r18_sensual_cg',
};

// ── ⑤ 壁纸级质感层 ─────────────────────────────────────────────────────────
// 2026-08-23 复核修正（用户质询驱动）：质量词属于 profile 装配层（presets.json 的
// quality_prefix 全句恰好一次），且 anima-aesthetic-v1.1 与 2.9B 均 strip_quality_tokens=true
// —— 场景数据里的质量词运行时必被剥离（docs/three-engine-prompt-research.md §Anima）。
// 因此数据层只保留具体光影/环境类 general tag，质量词与 AI 玄学词一律出清。
const REMOVE_TOKENS = [
  // promptPolicy.QUALITY_WORDS 政策清单（装配层专属）
  'masterpiece', 'best_quality', 'amazing_quality', 'very_aesthetic',
  'absurdres', 'newest', 'highres', 'highly_detailed',
  // AI 玄学细节词（docs/krea2-prompt-writing-guide.md：拉向 generic AI gloss）
  'intricate_details', 'ultra_detailed', '8k', '4k',
];

const QUALITY_TOKENS = [
  'detailed_background', 'cinematic_lighting', 'volumetric_lighting', 'depth_of_field',
];

// 壁纸氛围句模板：按 lighting/timeOfDay/mood 关键词路由，同桶内按 id 哈希取变体。
const PROSE_TEMPLATES = [
  [/lava|熔岩|炉火|fireplace|forge|ember/i, [
    'Firelight breathes warm flicker across every surface, giving the frame a deep painterly glow.',
    'Molten amber light rolls through the scene in slow waves, polishing each contour like a gallery canvas.',
  ]],
  [/candle|烛/i, [
    'Candlelight pools in soft golden layers while long shadows stretch across the room with cinematic depth.',
    'Warm candle glow blooms against the dark, wrapping the composition in intimate chiaroscuro richness.',
  ]],
  [/lantern|灯会|灯笼|festival/i, [
    'Lantern glow blooms into layered bokeh, gilding the whole celebration in festive warmth.',
    'Strings of festival lights dissolve into dreamy orbs of color behind her, depth stacked like a painted scroll.',
  ]],
  [/moon|月光|月夜|月色|月下/i, [
    'Moonlight silvers the scene with cool rim highlights, wrapping the composition in quiet nocturnal depth.',
    'Pale moonbeams carve silver edges along her silhouette while the night sky deepens into velvet blue.',
  ]],
  [/neon|霓虹|夜市/i, [
    'Neon reflections bloom across wet surfaces, layering vivid color into a cinematic night tableau.',
    'Signs of light smear into radiant bokeh behind her, the street glowing like a midnight film still.',
  ]],
  [/rain|雨|梅雨/i, [
    'Rain veils the background in soft bokeh while droplets catch stray glints of light along every edge.',
    'A gentle downpour turns the world beyond her into watercolor, each drop sparking tiny highlights.',
  ]],
  [/snow|雪|冰原|冬|寒/i, [
    'Cold winter air sharpens distant details while pale light wraps the frame in crystalline calm.',
    'Snowfall drifts through shafts of low light, frosting the scene in serene high-key clarity.',
  ]],
  [/steam|水汽|浴|汤|温泉|bath/i, [
    'Steam drifts through the light in soft translucent layers, lending the frame a dreamy humid glow.',
    'Wisps of vapor catch the backlight and bloom into pearlescent halos around her.',
  ]],
  [/star|星空|观星|星夜|银河/i, [
    'Starlight scatters overhead while gentle atmospheric haze deepens the vista into infinity.',
    'A river of stars dissolves into soft-focus brilliance above, grounding the scene in cosmic scale.',
  ]],
  [/morning|晨|dawn|清晨/i, [
    'Fresh morning light floods the scene with clean airy clarity and delicate drifting mist.',
    'Early sun spills long soft beams through the air, lifting every texture with crisp daylight detail.',
  ]],
  [/sunset|黄昏|暮|夕阳|dusk|傍晚/i, [
    'Golden-hour sunlight rakes across the frame in warm volumetric shafts, gilding every edge.',
    'The sinking sun pours honeyed light through the haze, painting the horizon in gradient ember tones.',
  ]],
  [/sun|日光|午后|阳光|晴/i, [
    'Bright natural sunlight models every surface with airy highlights and clean wallpaper-grade clarity.',
    'Sunlight streams in generous soft beams, filling the frame with luminous, breathable warmth.',
  ]],
];
const PROSE_FALLBACK = [
  'Layered cinematic lighting carves the scene with rich depth and gallery-print polish.',
  'Soft volumetric haze and precise rim light give the frame a polished key-visual finish.',
  'Balanced ambient gradients and fine atmospheric depth lift the composition to poster-quality finish.',
];

function pickProseSentence(blueprint) {
  const haystack = [blueprint.lighting, blueprint.timeOfDay, blueprint.mood].join(' ');
  for (const [re, variants] of PROSE_TEMPLATES) {
    if (re.test(haystack)) return variants[hashId(blueprint.id) % variants.length];
  }
  return PROSE_FALLBACK[hashId(blueprint.id) % PROSE_FALLBACK.length];
}
function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// ── ⑥ 海梦 cosplay 新场景（补服装覆盖缺口）──────────────────────────────────
const MARIN_COSPLAY_SCENE = {
  id: 'kitagawa_marin_backstage_cosplay',
  title: '漫展后台·开幕前的最后调整',
  category: '现代日常',
  characterId: 'kitagawa_marin',
  description: '【喜多川海梦 · 漫展后台】开幕前十分钟的后台更衣区，化妆镜的环形灯亮得晃眼。穿着泛用 cosplay 服的海梦对着随身镜最后调整假发角度，忽然回眸冲你比出角色的招牌姿势——「怎么样怎么样！这个还原度！等会儿走场的时候，眼睛只准看我一个人哦！」',
  location: '漫展后台更衣区',
  action: '对着随身镜调整假发与饰品，回眸比出角色招牌姿势，元气满满',
  timeOfDay: '上午',
  lighting: '后台化妆镜环形灯与帘缝漏进的日光交错，碎金般落在肩头',
  camera: 'medium shot, backstage dressing mirror, mixed ring-light and daylight',
  mood: '元气闪耀',
  sceneTags: ['convention_backstage', 'dressing_mirror', 'cosplay', 'wig', 'ring_light', 'cheerful'],
  promptProse: 'Marin Kitagawa in a playful cosplay outfit with character accents and a wig making final adjustments before a backstage dressing mirror at a convention, ring-light glow mixing with daylight leaking through the curtain as she flashes the character\'s signature pose with sparkling excitement.',
  promptTokens: [
    'convention_backstage', 'dressing_mirror', 'ring_light', 'cosplay', 'costume', 'wig',
    'hair_ornament', 'blonde_pink_hair', 'piercing', 'painted_nails', 'energetic_pose',
    'cheerful_smile', 'blushing',
  ],
  negativeTokens: [
    'worst quality', 'low quality', 'lowres', 'blurry', 'jpeg artifacts', 'watermark', 'text',
    'extra fingers', 'mutated hands', 'bad anatomy', 'dark shadowed face', 'flat lighting',
    'extra characters',
  ],
  recommendedSize: '1152x1536',
  outfitId: 'cosplay',
  coverageTags: ['daily'],
};

// 氛围句全集（幂等检测用；须在执行循环前定义）
const PROSE_ALL_SENTENCES = [...new Set([
  ...PROSE_TEMPLATES.flatMap(([, v]) => v), ...PROSE_FALLBACK,
])];

// ═══════════════════════════ 执行 ═══════════════════════════

const raw = fs.readFileSync(FILE, 'utf8');
const data = JSON.parse(raw);
const blueprints = data.blueprints;
const report = { iconic: 0, dailyAuto: 0, dailyExtra: 0, specialTag: 0, specialEnhance: 0,
  hintFix: 0, removedQuality: 0, qualityTokens: 0, proseUpgraded: 0, sizeBump: 0, inserted: [] };

const byId = new Map(blueprints.map(b => [b.id, b]));
function addTag(b, tag) {
  if (!Array.isArray(b.coverageTags)) b.coverageTags = [];
  if (!b.coverageTags.includes(tag)) {
    b.coverageTags.push(tag);
    return true;
  }
  return false;
}

// ⑥ 海梦 cosplay 场景插入（幂等）
if (!byId.has(MARIN_COSPLAY_SCENE.id)) {
  const anchor = blueprints.findIndex(b => b.id === 'kitagawa_marin_convention');
  const insertAt = anchor >= 0 ? anchor + 1 : blueprints.length;
  blueprints.splice(insertAt, 0, JSON.parse(JSON.stringify(MARIN_COSPLAY_SCENE)));
  byId.set(MARIN_COSPLAY_SCENE.id, MARIN_COSPLAY_SCENE);
  report.inserted.push(MARIN_COSPLAY_SCENE.id);
}

for (const b of blueprints) {
  // ① 名场面标注
  if (ICONIC[b.characterId] === b.id) { if (addTag(b, 'iconic')) report.iconic += 1; }
  // ② 日常标注：分类命中 + 定向补标
  if (!b.adult && DAILY_CATEGORY_RE.test(b.category || '')) { if (addTag(b, 'daily')) report.dailyAuto += 1; }
  if ((DAILY_EXTRA[b.characterId] || []).includes(b.id)) { if (addTag(b, 'daily')) report.dailyExtra += 1; }
  // ③ 特殊 NSFW：定向打标 / 定向补强 / 启发式兜底
  if (b.adult) {
    if (SPECIAL_TAG_ONLY.includes(b.id)) { if (addTag(b, 'special_nsfw')) report.specialTag += 1; }
    const enhance = SPECIAL_ENHANCE[b.id];
    if (enhance) {
      addTag(b, 'special_nsfw');
      b.nsfwTokens = b.nsfwTokens || [];
      enhance.tokens.forEach(t => { if (!b.nsfwTokens.includes(t)) b.nsfwTokens.push(t); });
      if (!(b.nsfwProse || '').includes(enhance.prose.slice(0, 40))) {
        b.nsfwProse = `${(b.nsfwProse || '').trim()} ${enhance.prose}`.trim();
        report.specialEnhance += 1;
      }
    }
    if (!b.coverageTags || !b.coverageTags.includes('special_nsfw')) {
      if (SPECIAL_HEURISTIC_RE.test((b.nsfwTokens || []).join(' ') + ' ' + b.id + ' ' + (b.title || ''))) {
        if (addTag(b, 'special_nsfw')) report.specialTag += 1;
      }
    }
  }
  // ④ 风格 hint 修复
  if (HINT_FIX[b.id] && b.kreaStyleHint !== HINT_FIX[b.id]) {
    b.kreaStyleHint = HINT_FIX[b.id];
    report.hintFix += 1;
  }
  // ⑤a 壁纸质感层：先出清装配层专属质量词/玄学词，再补具体光影环境 tag（全量）
  b.promptTokens = b.promptTokens || [];
  const beforeClean = b.promptTokens.length;
  b.promptTokens = b.promptTokens.filter(t => !REMOVE_TOKENS.includes(String(t).toLowerCase()));
  if (b.nsfwTokens) b.nsfwTokens = b.nsfwTokens.filter(t => !REMOVE_TOKENS.includes(String(t).toLowerCase()));
  if (b.promptTokens.length < beforeClean) report.removedQuality += 1;
  const before = b.promptTokens.length;
  QUALITY_TOKENS.forEach(t => { if (!b.promptTokens.includes(t)) b.promptTokens.push(t); });
  if (b.promptTokens.length > before) report.qualityTokens += 1;
  // ⑤b 壁纸氛围散文（仅原型场景；成人场景 nsfwProse 已丰富且受句子预算约束）
  if (!b.adult && !PROSE_ALL_SENTENCES.some(s => (b.promptProse || '').includes(s))) {
    b.promptProse = `${b.promptProse.trim()} ${pickProseSentence(b)}`.replace(/\s+/g, ' ').trim();
    report.proseUpgraded += 1;
  }
  // ⑤c 高分辨率升级（旧底模由视图层 closestSupportedSize 收敛）
  if (b.recommendedSize === '832x1216') { b.recommendedSize = '1152x1536'; report.sizeBump += 1; }
  else if (b.recommendedSize === '1216x832') { b.recommendedSize = '1536x1152'; report.sizeBump += 1; }
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log('[popular-scenes-upgrade] 完成:', JSON.stringify(report));
