// 短标签 prompt 构建器（sc300 手工链路执行化）：
// 规则 = LoRA exact_tokens 全锚点 + canonical 服装词 + 核心场景词（≤10）
//       + 氛围词 + 质量词。供批量 5-seed 生成使用。
const fs = require('fs');

const CHAR_PROMPT = {
  nene: ['ayachi_nene', '1girl', 'solo', 'white_hair', 'very_long_hair', 'low_twintails', 'purple_eyes', 'ahoge', 'pink_hair_ribbons'],
  natsume: ['shiki_natsume', '1girl', 'solo', 'very_long_black_hair', 'golden_yellow_eyes', 'two_red_hairclips', 'mole_under_eye', 'no_hair_ribbon'],
};

// canonical 服装词映射：tag 匹配 → LoRA canonical 词（仅存在于 contract 的词）。
const CANONICAL_OUTFIT = {
  nene: [
    [/school_uniform|sailor/, 'nene_school_uniform'],
    [/sailor_uniform/, 'nene_sailor_uniform'],
    [/red_cardigan/, 'nene_red_cardigan_uniform'],
    [/witch/, 'nene_witch_canonical'],
    [/pajamas/, 'nene_blue_pajamas'],
    [/sleepwear|sleep/, 'nene_green_sleepwear'],
    [/bat/, 'nene_bat_dress'],
    [/black_dress/, 'nene_black_dress'],
  ],
  natsume: [
    [/cafe_uniform/, 'natsume_cafe_uniform'],
    [/pink_cafe/, 'natsume_pink_cafe_uniform'],
    [/qipao/, 'natsume_official_qipao'],
    [/maid/, 'natsume_maid_uniform'],
    [/winter_coat/, 'natsume_winter_coat'],
    [/sleepwear|sleep|pajamas/, 'natsume_sleepwear'],
  ],
};

// tag 类别权重：越靠前越核心（0 = 必保留）
const PRIORITY = {
  hair_ribbon: 0, ahoge: 0, mole_under_eye: 0, two_red_hairclips: 0, no_hair_ribbon: 0,
  looking_at_viewer: 1, eye_contact: 1, smile: 1, gentle_smile: 1, shy_smile: 1,
  blush: 2, shy: 2, heavy_blush: 2, panicked: 2, open_mouth: 2, happy: 2, smile_face: 2,
  holding_papers: 3, holding_gift: 3, holding_spoon: 3, holding_papers_in_other_arm: 3,
  one_hand_adjusting_hair_ribbon: 3, sitting: 3, standing: 3, walking: 3, leaning: 3,
  looking_back: 3, over_shoulder: 3, lying: 3,
  classroom: 4, cafe: 4, bedroom: 4, street: 4, shrine: 4, beach: 4, library: 4,
  park: 4, rooftop: 4, kitchen: 4, train: 4, station: 4, river: 4, festival: 4,
  classroom_window: 4, window: 4, door: 4, garden: 4, forest: 4, lake: 4, sea: 4,
  snow: 5, snowfall: 5, rain: 5, clear_sky: 5, night: 5, afternoon: 5, morning: 5, day: 5,
  lantern_light: 6, window_light: 6, moonlight: 6, warm_lighting: 6, backlighting: 6,
  christmas_lights: 6, lanterns: 6, fireworks: 6, candlelight: 6, neon: 6, sunset: 6,
  medium_shot: 7, upper_body: 7, close_up: 7, full_body: 7, three_quarter_view: 7,
};

const AMBIENCE = {
  window: 'window_light, soft_lighting',
  golden: 'golden_hour, backlight, rim_light, volumetric_lighting',
  back: 'backlit, rim_light, volumetric_lighting',
  moon: 'moonlight, night, cool_lighting',
  lantern: 'lantern_light, warm_lighting, volumetric_lighting',
  overcast: 'overcast, soft_diffused_light',
};

const LIGHT_KW = [
  [/window|窗/, 'window'], [/golden hour|golden|逆光|夕|sunset|dusk/, 'golden'],
  [/backlight|backlit|rim/, 'back'], [/moon|月|夜/, 'moon'], [/lantern|烛|candle|灯/, 'lantern'],
];

function pickLighting(lighting) {
  const hay = String(lighting || '').toLowerCase();
  for (const [re, key] of LIGHT_KW) if (re.test(hay)) return key;
  return '';
}

function canonicalFor(characterId, tags) {
  const rules = CANONICAL_OUTFIT[characterId] || [];
  const hay = tags.join(' ');
  for (const [re, token] of rules) if (re.test(hay)) return token;
  return '';
}

const CATEGORY = {
  emotion: /^(?:smile|gentle_smile|shy_smile|smiling|blush|heavy_blush|shy|panicked|open_mouth|happy|in_love|pouting|laughing|tears|closed_eyes|grinning|content|calm)$/,
  pose: /^(?:standing|sitting|walking|leaning|lying|looking_back|over_shoulder|turning|kneeling|crouching|running|holding_|one_hand_|both_hands|adjusting_|playing|reading|writing|drinking|eating|sleeping|reaching)/,
  place: /^(?:classroom|classroom_window|cafe|bedroom|street|shrine|beach|library|park|rooftop|kitchen|train|station|river|festival|garden|forest|lake|sea|window|door|kotatsu|veranda|balcony|pool|onsen|bath|hallway|corridor|stage|auditorium|rooftop_garden|gym|bathroom|kitchen_corner|museum|aquarium|greenhouse|temple|pagoda|bridge|tunnel|cliff|valley|cave|campfire|hotel|mansion|courtyard|alley|intersection|shopping|dormitory|office|class|study|store|bakery|convenience|arcade|movie|theater|park_bench)/,
  weather: /^(?:snow|snowfall|rain|rainy|clear_sky|cloudy|overcast|night|afternoon|morning|day|evening|dusk|dawn|sunset|summer|winter|spring|autumn|wind|clouds|sunshine|storm|fog|mist|season)/,
  prop: /^(?:gift|game_controller|papers|glass|cup|phone|book|umbrella|flower|bouquet|sword|staff|wand|broom|bag|backpack|hat|scarf|muffler|gloves|camera|photo|frame|charm|talisman|plush|cat|dog|food|cake|sweets|coffee|tea|juice|balloon|lantern|fireworks|sparkler|shopping_bag)/,
  camera: /^(?:medium_shot|upper_body|close_up|full_body|three_quarter_view|over_the_shoulder|side_view|low_angle|high_angle|from_below|from_above|looking_down)/,
};

const CATEGORY_LIMITS = { emotion: 1, pose: 1, place: 2, weather: 1, prop: 1, camera: 0 };

function categoryOf(key) {
  for (const name of Object.keys(CATEGORY)) {
    if (CATEGORY[name].test(key)) return name;
  }
  return '';
}

function buildShortPrompt(scene, characterId) {
  const anchors = CHAR_PROMPT[characterId] || [];
  const tags = Array.isArray(scene.tags) ? scene.tags : [];
  const canonical = canonicalFor(characterId, tags);
  const skip = new Set(anchors.map(normalizeKey));
  const sceneTokens = [];
  for (const tag of tags) {
    const key = normalizeKey(tag);
    if (skip.has(key)) continue;
    if (/^(?:2girls|1girl|solo)$/.test(key)) continue;
    if (key.startsWith('nene_') || key.startsWith('natsume_')) continue;
    sceneTokens.push({ key, tag, priority: PRIORITY[key] !== undefined ? PRIORITY[key] : 5 });
  }
  sceneTokens.sort((a, b) => a.priority - b.priority);
  const picked = [];
  const seen = new Set();
  const counts = {};
  // 类别配额：保证地点/天气/道具不被表情词挤掉（sc021 教训）。
  for (const item of sceneTokens) {
    if (picked.length >= 6) break;
    const key = normalizeKey(item.tag);
    if (seen.has(key)) continue;
    const category = categoryOf(key);
    if (category && counts[category] >= CATEGORY_LIMITS[category]) continue;
    seen.add(key);
    if (category) counts[category] = (counts[category] || 0) + 1;
    picked.push(item.tag);
  }
  const lighting = pickLighting(scene.lighting);
  const ambience = AMBIENCE[lighting] || '';
  const quality = ['masterpiece', 'best_quality', 'score_7'];
  const tokens = [
    ...anchors,
    ...(canonical ? [canonical] : []),
    ...picked,
    ...(ambience ? ambience.split(', ') : []),
  ];
  return { prompt: [...new Set(tokens)].join(', '), quality };
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
}

module.exports = { buildShortPrompt, CHAR_PROMPT, CANONICAL_OUTFIT };
