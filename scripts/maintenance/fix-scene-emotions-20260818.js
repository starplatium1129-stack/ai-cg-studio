'use strict';
// 2026-08-18 场景表情差异化 + 旧设定残留修复
// 1) 90 个场景（9 位 × 10）的 promptProse/nsfwProse 表情差异化：
//    按角色性格 + 场景氛围分配主导情绪，消除 blush/flustered/shy 雷同堆砌
// 2) 修复 3 个 SFW 场景 prose 的旧设定残留（白夜黑发姬发式 / 塞西莉亚金发蓝眼）
const fs = require('fs');
const file = 'data/scene-blueprints.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// sceneId -> { prose: [[old, new], ...], nsfw: [[old, new], ...] }
// append: 在句号前追加表情句（用于无表情场景）
const FIXES = {
  // ── 旧设定残留修复 ──
  byakuya_sunset_rooftop_bento: {
    prose: [['dark hime-cut black hair blowing in the evening breeze', 'silver-white hair with spiral horn buns blowing in the evening breeze']],
  },
  cecilia_church_stained_glass_praying: {
    prose: [['wavy golden blonde hair', 'mint-green hair in a low bun']],
  },
  cecilia_living_room_lazy_scone: {
    prose: [['golden hair spilling over cushions', 'mint-green hair spilling over cushions'], ['sparkling blue eyes', 'bright emerald eyes']],
  },

  // ── 希露菲（温柔羞怯系）──
  sylphiette_buena_village_tree: { prose: [['soft shy smile, dappled golden sunlight', 'shy warm smile, ears twitching happily, dappled golden sunlight']] },
  sylphiette_morning_balcony_tea: { prose: [['blushing with affectionate gentle smile', 'blushing softly with a tender newlywed smile']] },
  sylphiette_forest_magic_practice: { append: ' her eyes sparkling with quiet concentration' },
  sylphiette_grayrat_kitchen_morning: { append: ' humming a contented little tune with a soft smile' },
  sylphiette_r18_bedroom_soles_foreshortening: {
    prose: [['her ears blushing bright red as she shyly turns her face away', 'her ears burning bright red as she hides her face behind both hands']],
    nsfw: [['shy panting expression, warm intimate lamp light', 'covering her face shyly, peeking through her fingers, warm intimate lamp light']],
  },
  sylphiette_r18_fitz_unbuttoned_desk: {
    prose: [['a flustered deep blush spreading across her face', 'an utterly flustered look, blushing to the very tips of her pointed ears']],
    nsfw: [['flustered heavy blush, desk lamp glow', 'flustered blush spreading to her ears, desk lamp glow']],
  },
  sylphiette_r18_morning_wake_sheets: {
    prose: [['her long pointed elf ears blushing softly in the warm glow', 'her long pointed elf ears twitching and blushing in the warm glow']],
    nsfw: [['sleepy blush on pointed elf ears, warm morning sunlight', 'drowsy sleepy face with softly parted lips, warm morning sunlight']],
  },
  sylphiette_r18_onsen_wet_elf_ears: {
    prose: [['her long pointed elf ears dripping and blushing', 'her long pointed elf ears dripping and twitching']],
    nsfw: [['blushing wet elf ears, steamy lantern glow', 'relaxed blissful half-closed eyes, steamy lantern glow']],
  },

  // ── 结衣（开朗治愈系）──
  yui_fireworks_festival_glance: { append: ' mouth open in a happy gasp of wonder' },
  yui_sweets_shop_after_school: { append: ' her eyes sparkling with delight' },
  yui_r18_bathroom_warm_tub: {
    nsfw: [['relaxed blissful blush, warm steam', 'serene blissful expression with eyes closed, warm steam']],
  },
  yui_r18_bedroom_soles_black_socks: {
    prose: [['panting with a flustered blush under warm dim lamp light', 'biting her lower lip with an excited flustered look under warm dim lamp light']],
    nsfw: [['panting blush, warm intimate light', 'excited wide-eyed panting, warm intimate light']],
  },
  yui_r18_service_club_desk_afterschool: {
    prose: [['blushing intensely with teary shy eyes as golden dust motes drift through the air', 'looking away shyly with trembling lashes and teary eyes as golden dust motes drift through the air']],
    nsfw: [['intense blush with teary eyes, golden hour glow', 'teary sparkling eyes with softly parted lips, golden hour glow']],
  },
  yui_r18_sofa_morning_hoodie: {
    prose: [['a shy seductive gaze and gentle blush in the bright morning glow', 'a sleepy sultry gaze with a soft dreamy smile in the bright morning glow']],
    nsfw: [['shy seductive gaze, bright morning light', 'lazy sultry half-lidded gaze, bright morning light']],
  },

  // ── 黑贞德（傲慢傲娇系）──
  jalter_rainy_rooftop_neon: { append: ' a quiet thoughtful gaze in her golden eyes' },
  jalter_r18_bedroom_soles_leather_boots: {
    prose: [['a tsundere scowl fighting a heavy blush in dim lamplight', 'a defiant pout barely hiding her reddening cheeks in dim lamplight']],
    nsfw: [['tsundere heavy blush, dim intimate light', 'huffy turned-away face with reddening ears, dim intimate light']],
  },
  jalter_r18_boudoir_candle_dress: {
    prose: [['a haughty yet flustered expression in the flickering light', 'a haughty raised brow betrayed by a faint flustered flush in the flickering light']],
    nsfw: [['haughty flustered blush, warm candlelight', 'haughty glare betrayed by a telling blush, warm candlelight']],
  },
  jalter_r18_hotel_mirror_back_curves: {
    prose: [['glancing over her shoulder with piercing golden eyes', 'glancing over her shoulder with a sly half-smile in her golden eyes']],
    nsfw: [['golden eyes looking over shoulder, soft rim light', 'golden eyes glancing back with a sly half-smile, soft rim light']],
  },
  jalter_r18_throne_spread_legs: {
    prose: [['a fierce arrogant smirk mixed with a flustered heavy blush', 'a smug conquering smirk with narrowed golden eyes']],
    nsfw: [['fierce tsundere blush, candlelit shadows', 'smug dominant smirk, candlelit shadows']],
  },

  // ── 樱（温柔贤淑系）──
  sakura_evening_shrine_prayer: { append: ' a gentle hopeful smile on her lips' },
  sakura_school_library_reading: { append: ' her expression calm and absorbed' },
  sakura_r18_bathroom_steam_mirror: {
    prose: [['warm light softening her skin through the lingering steam', 'a soft contented smile on her lips, warm light softening her skin through the lingering steam']],
    nsfw: [['tender blushing skin, warm steamy light', 'relaxed serene expression with rosy skin, warm steamy light']],
  },
  sakura_r18_bedroom_soles_tights_peel: {
    prose: [['a tender blushing expression in warm dim light', 'a gentle shy smile as she bites her lower lip in warm dim light']],
    nsfw: [['tender blush, warm intimate light', 'gentle shy smile, warm intimate light']],
  },
  sakura_r18_dark_shadow_bedroom: {
    prose: [['an ecstatic devoted expression in the eerie red glow', 'an ecstatic devoted expression, eyes half-lidded in bliss, in the eerie red glow']],
    nsfw: [['ecstatic devoted expression, dark crimson glow', 'blissful dazed ecstasy, dark crimson glow']],
  },
  sakura_r18_tatami_kneeling_spread: {
    prose: [['she looks up with tearful shy devotion under soft paper lantern light', 'she looks up with wide vulnerable eyes and trembling lips under soft paper lantern light']],
    nsfw: [['tearful shy devotion, warm lantern glow', 'vulnerable wide-eyed gaze, warm lantern glow']],
  },

  // ── 约尔（天然人妻系）──
  yor_r18_bedroom_red_sweater_lift: {
    prose: [['an intoxicated blush and teary seductive eyes under warm bedside lamp light', 'a dazed tipsy smile with hazy bedroom eyes under warm bedside lamp light']],
    nsfw: [['intoxicated blush with teary seductive eyes, warm bedside glow', 'hazy tipsy smile, warm bedside glow']],
  },
  yor_r18_bedroom_silk_robe: {
    prose: [['an innocent flustered blush under the warm bedside lamp', 'a startled deer-in-headlights look under the warm bedside lamp']],
    nsfw: [['innocent flustered blush, warm lamp light', 'startled wide eyes with rosy cheeks, warm lamp light']],
  },
  yor_r18_shower_steam_wet_hair: {
    prose: [['a sultry blushing gaze through the steam', 'a serene sultry gaze, eyes half-closed in the steam']],
    nsfw: [['sultry blush, warm steamy light', 'sultry half-lidded gaze, warm steamy light']],
  },
  yor_r18_thorn_princess_couch_soles: {
    prose: [['flustered panting under dim warm light', 'her elegant composure cracking into breathless surprise under dim warm light']],
    nsfw: [['flustered panting, dim warm light', 'breathless widened eyes, dim warm light']],
  },

  // ── 蕾塞（俏皮危险系）──
  reze_apartment_balcony_sunset: { append: ' a rare peaceful look softening her face' },
  reze_old_bookstore_reading: { append: ' a relaxed lazy smile on her lips' },
  reze_r18_bathroom_mirror_steam: {
    prose: [['a teasing smile in the warm light', 'a playful wink at her own reflection in the warm light']],
    nsfw: [['teasing smile, warm steamy light', 'playful winking smirk, warm steamy light']],
  },
  reze_r18_bedroom_soles_choker_pull: {
    prose: [['a teasing smile in the dim flickering lamplight', 'a sly smirk as she tugs the choker in the dim flickering lamplight']],
    nsfw: [['teasing smile, dim warm light', 'sly smirking face, dim warm light']],
  },
  reze_r18_morning_shirt_couch_side: {
    prose: [['a lazy satisfied smile', 'a contented cat-like smile, eyes half-closed']],
    nsfw: [['lazy teasing smile, bright morning light', 'lazy contented cat-like grin, bright morning light']],
  },
  reze_r18_school_pool_edge_spread: {
    prose: [['she tilts her head with a playful dangerous smile', 'she tilts her head with a daring challenge glinting in her eyes']],
    nsfw: [['choker pin still on, moonlight on wet skin', 'choker pin still on, bold direct gaze with a slight smirk, moonlight on wet skin']],
  },

  // ── 菲伦（冷静毒舌系）──
  fern_royal_ball_waltz: { append: ' a composed elegant expression with a rare graceful smile' },
  fern_r18_bedroom_soles_stockings: {
    prose: [['a quiet flustered blush in warm dim light', 'a quietly flustered look, lips pressed into a thin pout, in warm dim light']],
    nsfw: [['quiet pouting blush, warm intimate light', 'thin-lipped pout with reddening cheeks, warm intimate light']],
  },
  fern_r18_hotel_mirror_dressing_gown: {
    prose: [['a faint blush on her composed face', 'her composed mask slipping into startled surprise']],
    nsfw: [['faint blush, warm intimate light', 'startled wide violet eyes, warm intimate light']],
  },
  fern_r18_inn_bed_spread_pout: {
    prose: [['a pouty flustered expression', 'an indignant pout with furrowed brows']],
    nsfw: [['pouting blush, warm intimate light', 'indignant pouting face, warm intimate light']],
  },
  fern_r18_inn_tub_warm: {
    prose: [['her usually composed face soft and relaxed in the warm light', 'her usually composed face melting into dreamy relaxation in the warm light']],
    nsfw: [['relaxed blush, warm steam', 'dreamy relaxed half-lidded eyes, warm steam']],
  },

  // ── 白夜（面瘫贫穷系）──
  byakuya_r18_bedroom_soles_shackled: {
    prose: [['a quiet deadpan blush in the dim warm lamplight', 'a faint deadpan flush, her toes curling shyly, in the dim warm lamplight']],
    nsfw: [['deadpan blush, dim warm light', 'deadpan face with a tiny shy smile, dim warm light']],
  },
  byakuya_r18_magical_girl_torn_dress: {
    prose: [['sits dazed in her torn pink magical girl dress', 'sits dazed in her torn pink magical girl dress, staring blankly at the moon']],
    nsfw: [['deadpan vulnerable expression, cold moonlight', 'blank dazed stare, cold moonlight']],
  },
  byakuya_r18_public_bath_steam: {
    prose: [['deadpan eyes fixed on the water', 'staring blankly at the water, lost in thought']],
    nsfw: [['deadpan faint blush, dim steamy light', 'blank distant gaze, dim steamy light']],
  },
  byakuya_r18_tatami_room_unbuttoned_spread: {
    prose: [['a deadpan face betrayed by a faint blush under the dim flickering lamp', 'an unreadable deadpan face with shoulders trembling slightly under the dim flickering lamp']],
    nsfw: [['deadpan faint blush, dim warm light', 'blank expression with trembling hands, dim warm light']],
  },

  // ── 塞西莉亚（天然呆圣女系）──
  cecilia_r18_bedroom_soles_nun_veil: {
    prose: [['the white nun veil half-covering her blushing face', 'the white nun veil half-covering her sleepy innocent face']],
    nsfw: [['white veil half over blushing face, moonlight', 'white veil half over sleepy innocent face, moonlight']],
  },
  cecilia_r18_church_altar_spread: {
    prose: [['candlelight flickering across her tearful devout expression', 'candlelight flickering across her solemn reverent expression']],
    nsfw: [['tearful devout blush, warm candlelight', 'solemn reverent gaze, warm candlelight']],
  },
  cecilia_r18_church_dorm_moonlight: {
    nsfw: [['peaceful innocent expression, silver moonlight', 'peaceful sleeping face with softly parted lips, silver moonlight']],
  },
  cecilia_r18_pastor_shirt_open_couch: {
    prose: [['an innocent flustered blush in the warm lamplight', 'an adorably confused tilt of her head, cheeks flushed, in the warm lamplight']],
    nsfw: [['innocent flustered blush, warm lamp light', 'adorably confused wide-eyed look, warm lamp light']],
  },
};

// ── 执行 ──
let fixed = 0;
const warnings = [];
for (const b of data.blueprints) {
  const fix = FIXES[b.id];
  if (!fix) continue;
  const sources = [['promptProse', b.promptProse, fix.prose], ['nsfwProse', b.nsfwProse, fix.nsfw]];
  for (const [field, text, pairs] of sources) {
    if (!pairs || !pairs.length) continue;
    let next = text;
    for (const [oldS, newS] of pairs) {
      if (!next.includes(oldS)) {
        warnings.push(`${b.id}.${field}: NOT FOUND: ${oldS.slice(0, 60)}`);
        continue;
      }
      next = next.split(oldS).join(newS);
    }
    if (field === 'promptProse') b.promptProse = next;
    else b.nsfwProse = next;
  }
  // append：句号前插入表情句
  if (fix.append) {
    const dot = b.promptProse.lastIndexOf('.');
    if (dot >= 0) {
      b.promptProse = b.promptProse.slice(0, dot) + ',' + fix.append + '.' + b.promptProse.slice(dot + 1);
    } else {
      b.promptProse += ',' + fix.append + '.';
    }
  }
  fixed++;
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('fixed scenes:', fixed, '| warnings:', warnings.length);
for (const w of warnings) console.log(' WARN:', w);

// 验证：扫描残留的雷同表情（R18 场景不应再高频出现同一 blush 句式）
const check = JSON.parse(fs.readFileSync(file, 'utf8'));
const todayIds = ['sylphiette','yuigahama_yui','jeanne_alter','matou_sakura','yor_forger','reze_chainsaw','fern_frieren','mimori_byakuya','saint_cecilia'];
const r18 = check.blueprints.filter(b => todayIds.includes(b.characterId) && b.adult);
let blushCount = 0, flusteredCount = 0, tearyCount = 0;
for (const b of r18) {
  const t = (b.promptProse + ' ' + (b.nsfwProse || '')).toLowerCase();
  if (t.includes('blush')) blushCount++;
  if (t.includes('flustered')) flusteredCount++;
  if (t.includes('teary')) tearyCount++;
}
console.log(`R18 scenes: ${r18.length} | still contain blush: ${blushCount} | flustered: ${flusteredCount} | teary: ${tearyCount}`);
