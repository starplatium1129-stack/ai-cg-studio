'use strict';
/**
 * fix-scene-prompt-consistency.js (v2, idempotent)
 *
 * 按审计 findings 修复「故事 vs 提示词」与「提示词内部冲突」。幂等：
 *  - token 删除：目标已不存在视为已完成，跳过；
 *  - 字符串替换：源串已不存在、但目标串已存在视为已完成，跳过；
 *  - 追加 token、nsfwProse 写入、分片重建天然幂等。
 * 任何“真正”找不到的场景/字段才记录 FAIL。
 * 场景库以 data/scenes.json 为源，改后重建 nene/natsume/shared/core 分片。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const bpFile = path.join(ROOT, 'data', 'scene-blueprints.json');
const scFile = path.join(ROOT, 'data', 'scenes.json');
const bpData = JSON.parse(fs.readFileSync(bpFile, 'utf8'));
const scenes = JSON.parse(fs.readFileSync(scFile, 'utf8'));

const fails = [];
const applied = [];
const skipped = [];

const bp = (id) => bpData.blueprints.find((b) => b.id === id);
const sc = (id) => scenes.find((s) => s.id === id);
const trunc = (s) => (String(s).length > 70 ? String(s).slice(0, 70) + '…' : s);

function replaceInBP(id, field, from, to) {
  const b = bp(id); if (!b) { fails.push(`${id}: 蓝本不存在`); return; }
  const v = String(b[field] || '');
  if (v.includes(from)) { b[field] = v.replace(from, to); applied.push(`${id}.${field} replace`); }
  else if (v.includes(to.split(' ').slice(0, 4).join(' '))) { skipped.push(`${id}.${field} already`); }
  else if (v.includes(String(to).slice(0, 30))) { skipped.push(`${id}.${field} already`); }
  else fails.push(`${id}.${field}: 找不到源串 "${trunc(from)}" 也未发现目标态`);
}
function setBP(id, field, value) {
  const b = bp(id); if (!b) { fails.push(`${id}: 蓝本不存在`); return; }
  if (b[field] === value) { skipped.push(`${id}.${field} equal`); return; }
  b[field] = value; applied.push(`${id}.${field} set`);
}
function removeBPArrayToken(id, field, tokens) {
  const b = bp(id); if (!b) { fails.push(`${id}: 蓝本不存在`); return; }
  const arr = Array.isArray(b[field]) ? b[field] : b[field] ? [String(b[field])] : [];
  const out = arr.filter((x) => !tokens.some((t) => String(x).toLowerCase() === String(t).toLowerCase()));
  if (out.length !== arr.length) { b[field] = out; applied.push(`${id}.${field} removeTokens`); return; }
  skipped.push(`${id}.${field} tokens-already-absent (目标本就不存在/已在上一轮删除)`);
}
function addBPArrayTokens(id, field, tokens) {
  const b = bp(id); if (!b) { fails.push(`${id}: 蓝本不存在`); return; }
  const arr = Array.isArray(b[field]) ? [...b[field]] : [];
  let added = 0;
  for (const t of tokens) if (!arr.some((x) => String(x).toLowerCase() === String(t).toLowerCase())) { arr.push(t); added++; }
  if (added) { b[field] = arr; applied.push(`${id}.${field} +${added}`); }
  else skipped.push(`${id}.${field} already-has`);
}
function dedupeBPProse(id, field) {
  const b = bp(id); if (!b) { fails.push(`${id}: 蓝本不存在`); return; }
  const v = String(b[field] || '');
  const sents = v.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [];
  for (let i = 0; i < sents.length - 1; i++) {
    if (sents[i].trim() === sents[i + 1].trim()) {
      b[field] = v.replace(sents[i] + sents[i + 1], sents[i]);
      applied.push(`${id}.${field} dedupeSentence`);
      return;
    }
  }
  skipped.push(`${id}.${field} no-dup`);
}

function removeSceneTokens(id, field, tokens) {
  const s = sc(id); if (!s) { fails.push(`${id}: 场景不存在`); return; }
  if (Array.isArray(s[field])) {
    const out = s[field].filter((x) => !tokens.some((t) => String(x).toLowerCase() === String(t).toLowerCase()));
    if (out.length !== s[field].length) { s[field] = out; applied.push(`${id}.${field} removeTokens`); return; }
    skipped.push(`${id}.${field} tokens-absent`);
  } else {
    const parts = String(s[field] || '').split(',').map((p) => p.trim());
    const out = parts.filter((p) => !tokens.some((t) => p.toLowerCase() === String(t).toLowerCase()));
    if (out.length !== parts.length) { s[field] = out.join(', '); applied.push(`${id}.${field} removeTokens`); return; }
    skipped.push(`${id}.${field} tokens-absent`);
  }
}
function replaceSceneToken(id, field, fromTok, toTok) {
  const s = sc(id); if (!s) { fails.push(`${id}: 场景不存在`); return; }
  if (Array.isArray(s[field])) {
    let changed = false;
    s[field] = s[field].map((x) => { if (String(x).toLowerCase() === fromTok.toLowerCase()) { changed = true; return toTok; } return x; });
    changed ? applied.push(`${id}.${field} replaceToken`) : skipped.push(`${id}.${field} token-absent`);
  } else {
    const parts = String(s[field] || '').split(',').map((p) => p.trim());
    let changed = false;
    const out = parts.map((p) => { if (p.toLowerCase() === fromTok.toLowerCase()) { changed = true; return toTok; } return p; });
    if (changed) { s[field] = out.join(', '); applied.push(`${id}.${field} replaceToken`); }
    else skipped.push(`${id}.${field} token-absent`);
  }
}
function replaceStrInScene(id, field, from, to) {
  const s = sc(id); if (!s) { fails.push(`${id}: 场景不存在`); return; }
  const v = String(s[field] || '');
  if (v.includes(from)) { s[field] = v.replace(from, to); applied.push(`${id}.${field} replace`); }
  else if (v.includes(to.replace('\n', '').slice(0, 20))) { skipped.push(`${id}.${field} already`); }
  else fails.push(`${id}.${field}: 找不到 "${trunc(from)}"`);
}

// =====================================================================
// A. 蓝本：负向误杀正向必需要素
// =====================================================================
[['emilia_rezero_r18_snow_spring', ['day']],
 ['skadi_arknights_r18_tavern_late', ['neon']],
 ['yui_r18_bedroom_soles_black_socks', ['socks']],
 ['jalter_r18_bedroom_soles_leather_boots', ['boots']],
 ['sakura_r18_bedroom_soles_tights_peel', ['pantyhose']],
 ['fern_r18_bedroom_soles_stockings', ['stockings']],
 ['kitagawa_marin_r18_fitting', ['school uniform', 'school_uniform']],
 ['kisara_r18_apartment', ['school uniform', 'school_uniform']],
].forEach(([id, toks]) => removeBPArrayToken(id, 'negativeTokens', toks));

// =====================================================================
// B. 蓝本：全裸场景负向补衣物禁词
// =====================================================================
const BANS = ['clothes', 'clothing', 'underwear', 'panties', 'bra', 'swimsuit', 'fabric'];
['surtr_arknights_r18_cabin_night', 'surtr_arknights_r18_hot_spring', 'surtr_arknights_r18_morning_bed',
 'surtr_arknights_r18_lava_glow', 'kaltsit_arknights_r18_medical_bath', 'kaltsit_arknights_r18_desk_night',
 'kaltsit_arknights_r18_mon3tr_guard', 'chen_arknights_r18_bed_sword', 'chen_arknights_r18_rooftop_kiss',
 'eyjafjalla_arknights_r18_dorm_blanket', 'eyjafjalla_arknights_r18_hot_spring_private', 'eyjafjalla_arknights_r18_candle_lab',
 'lemuen_arknights_r18_bath_halo', 'mudrock_arknights_r18_cabin_quiet', 'mudrock_arknights_r18_bath_muscle',
 'mudrock_arknights_r18_bed_hands', 'mudrock_arknights_r18_hammer_rest', 'suzuran_arknights_r18_spring_bath',
 'suzuran_arknights_r18_futon_morning', 'perlica_arknights_r18_hygiene_bay', 'perlica_arknights_r18_viewport',
 'laevatain_arknights_r18_quarters_flame', 'laevatain_arknights_r18_ice_bath', 'laevatain_arknights_r18_sword_side',
 'laevatain_arknights_r18_lava_pool'].forEach((id) => addBPArrayTokens(id, 'negativeTokens', BANS));

// =====================================================================
// C. 蓝本：半裸/有衣场景 nsfwTokens 与 prose 对齐
// =====================================================================
[['kaltsit_arknights_r18_cabin_robe', ['nude', 'completely_naked', 'bare_chest'], ['open_back', 'evening_gown', 'low_V_neckline', 'bare_shoulders']],
 ['chen_arknights_r18_apartment', ['nude', 'completely_naked', 'bare_chest', 'nipples'], ['loosened_uniform', 'open_shirt', 'bare_shoulders']],
 ['chen_arknights_r18_bath_towels', ['nude', 'completely_naked', 'bare_chest'], ['towel_around_body', 'bare_shoulders']],
 ['skadi_arknights_r18_cabin_rope', ['nude', 'completely_naked'], ['black_bodysuit', 'unzipped']],
 ['goldenglow_arknights_r18_greenhouse_night', ['nude', 'completely_naked'], []],
 ['suzuran_arknights_r18_kimono_slip', ['nude', 'completely_naked', 'bare_chest', 'exposed_breasts', 'nipples'], ['kimono_slip', 'one_shoulder_off', 'bare_shoulder']],
 ['perlica_arknights_r18_quarters_terminal', ['nude', 'completely_naked', 'bare_chest', 'nipples'], ['uniform_unbuttoned', 'open_collar', 'bare_shoulders', 'exposed_collarbone']],
 ['perlica_arknights_r18_bunk_late', ['nude', 'completely_naked', 'bare_chest', 'nipples'], ['open_lounge_top', 'bare_shoulders', 'exposed_breasts']],
].forEach(([id, rm, add]) => {
  removeBPArrayToken(id, 'nsfwTokens', rm);
  if (add.length) addBPArrayTokens(id, 'nsfwTokens', add);
});

// =====================================================================
// D. 蓝本：故事/服装 vs prose 一致性
// =====================================================================
replaceInBP('raiden_shogun_flower_field', 'promptProse', 'a vast seaside flower field at golden hour', 'a vast flower field in the countryside at golden hour');
replaceInBP('yukinoshita_yukino_library', 'promptProse', 'stands by a tall library window in the afternoon', 'leans by a tall library window reading a book in the afternoon');
replaceInBP('yukinoshita_yukino_r18_room', 'promptProse', 'her school blazer and red ribbon placed neatly', 'her yukata and obi placed neatly');
replaceInBP('yukinoshita_yukino_r18_room', 'nsfwProse', 'her school uniform neatly folded beside the futon', 'her yukata slipped half off beside the futon');
replaceInBP('elaina_r18_inn_room', 'promptProse', 'Elaina rests comfortably on a soft bed', 'Elaina sits at the edge of the bed reading an open book');
replaceInBP('elaina_r18_inn_room', 'nsfwProse', 'Elaina lies across soft pillows with her long ash hair', 'Elaina sits at the edge of the bed reading an open book, her long ash hair');
replaceInBP('hatsune_miku_r18_backstage', 'promptProse', 'Hatsune Miku relaxes on a plush sofa, her concert stage outfit and detached sleeves resting on the vanity table beside her', 'Hatsune Miku sits at the vanity table before the mirror, her concert stage outfit and detached sleeves draped over the dressing stool beside her');
replaceInBP('hatsune_miku_r18_backstage', 'nsfwProse', 'draped over the sofa', 'draped over the dressing stool');
replaceInBP('dusk_arknights_painting_studio', 'promptProse', 'Dusk kneels among unrolled scrolls', 'Dusk sits cross-legged among unrolled scrolls');
replaceInBP('suzuran_arknights_wildflower_field', 'promptProse', 'Suzuran kneels to smell the white blooms', 'Suzuran squats down to smell the white blooms');
replaceInBP('kitagawa_marin_amusement_park', 'promptProse', 'flashes a cheerful peace sign', 'flashes a cheerful finger-heart gesture');
replaceInBP('exusiai_arknights_r18_apartment_couch', 'nsfwProse', 'with her courier jacket discarded over the sofa armrest', 'with her loose oversized t-shirt discarded over the sofa armrest');
replaceInBP('yui_home_cooking_kitchen', 'promptProse', 'wearing a cozy off-shoulder hoodie with a puppy motif', 'wearing a loose dog-print pajama top');
replaceInBP('alya_summer_festival_yukata', 'promptProse', 'in an elegant light blue floral summer sundress', 'in a light blue floral yukata (kimono)');
replaceInBP('byakuya_r18_magical_girl_torn_dress', 'promptProse', 'sits dazed in her torn pink magical girl dress', 'lies back dazed in her torn pink magical girl dress');
replaceInBP('byakuya_r18_magical_girl_torn_dress', 'nsfwProse', 'legs parted in a dazed sitting pose', 'legs parted as she lies back on the rubble');
// metadata 对齐（prompt 成图为准）
setBP('artoria_r18_royal_chamber', 'action', '蓝白裙装半褪斜倚床上');
setBP('makima_r18_office', 'action', '西装裙半褪斜倚在皮沙发上');
setBP('tohsaka_rin_r18_mansion', 'action', '红色洋装半褪斜倚床上');
setBP('roxy_migurdia_r18_teacher', 'action', '法袍半褪斜倚在床上');
setBP('mudrock_arknights_r18_bed_hands', 'action', '侧卧，指尖轻抚床沿');
// yuzuriha / illya 服装权威侧（outfitId + prose 一致）
replaceInBP('yuzuriha_inori_r18_atelier', 'description', '白色礼裙半褪的楪祈。', '红色礼裙半褪的楪祈。');
replaceInBP('yuzuriha_inori_r18_atelier', 'action', '白色礼裙半褪倚在窗前', '红色礼裙半褪倚在窗前');
replaceInBP('illyasviel_r18_castle', 'description', '紫色礼裙半褪的伊莉雅。', '红色冬大衣半褪的伊莉雅。');
replaceInBP('illyasviel_r18_castle', 'action', '紫礼裙半褪坐在壁炉前', '红冬大衣半褪坐在壁炉前');
// tokens/tags 对齐
[['illyasviel_moon_garden', 'sceneTags', ['purple_dress'], ['white_dress']],
 ['illyasviel_moon_garden', 'promptTokens', ['purple_dress'], ['white_dress']],
 ['yukinoshita_yukino_r18_room', 'sceneTags', ['discarded_uniform'], ['discarded_yukata']],
 ['hatsune_miku_r18_backstage', 'promptTokens', ['plush_sofa'], []],
 ['hatsune_miku_r18_backstage', 'nsfwTokens', ['sitting_on_sofa'], ['sitting_at_vanity']],
 ['alya_summer_festival_yukata', 'sceneTags', ['light_blue_sundress', 'summer_dress'], ['yukata', 'light_blue_yukata']],
 ['byakuya_r18_tatami_room_unbuttoned_spread', 'promptTokens', ['afternoon_shoji_light'], ['dim_lamp_light']],
 ['byakuya_sunset_rooftop_bento', 'promptTokens', ['navy_hair', 'black_hair'], ['silver_white_hair', 'spiral_horn_buns']],
 ['byakuya_r18_tatami_room_unbuttoned_spread', 'promptTokens', ['navy_hair'], []],
 ['cecilia_church_stained_glass_praying', 'promptTokens', ['platinum_hair', 'silver_hair', 'very_light_blonde_hair', 'golden_hair', 'golden_wavy_hair'], ['mint_green_hair']],
 ['cecilia_church_stained_glass_praying', 'sceneTags', ['golden_hair'], ['mint_green_hair']],
 ['cecilia_r18_pastor_shirt_open_couch', 'promptTokens', ['platinum_hair', 'silver_hair', 'very_light_blonde_hair', 'golden_hair', 'golden_wavy_hair'], ['mint_green_hair']],
 ['cecilia_r18_pastor_shirt_open_couch', 'sceneTags', ['golden_hair'], ['mint_green_hair']],
 ['cecilia_r18_pastor_shirt_open_couch', 'promptTokens', ['spread_legs'], ['legs_together']],
 ['cecilia_r18_pastor_shirt_open_couch', 'nsfwTokens', ['spread_thighs'], ['legs_together']],
 ['cecilia_r18_pastor_shirt_open_couch', 'sceneTags', ['spread_thighs'], ['legs_together']],
 ['yui_home_cooking_kitchen', 'sceneTags', ['hoodie'], ['dog_pajamas']],
 ['yui_home_cooking_kitchen', 'promptTokens', ['hoodie'], ['dog_pajamas']],
 ['rem_rezero_rain_night', 'sceneTags', ['maid'], []],
 ['rem_rezero_rain_night', 'promptTokens', ['maid'], []],
].forEach(([id, f, rm, add]) => { removeBPArrayToken(id, f, rm); if (add.length) addBPArrayTokens(id, f, add); });
replaceInBP('byakuya_sunset_rooftop_bento', 'description', '黑直发在风中拂动', '银白长发与小角发髻在风中拂动');
replaceInBP('cecilia_church_stained_glass_praying', 'description', '金色卷发与圣洁光辉交融', '薄荷绿长发与圣洁光辉交融');

// =====================================================================
// E. 蓝本：连续重复句去重
// =====================================================================
['sylphiette_grayrat_kitchen_morning', 'yui_tennis_court_afternoon', 'yor_city_hall_desk_work',
 'yor_evening_sofa_knitting', 'reze_old_bookstore_reading'].forEach((id) => dedupeBPProse(id, 'promptProse'));

// =====================================================================
// F. 蓝本：成人分支裸体叙述（nsfwProse 权威写入）
// =====================================================================
const NSFW_PROSE = {
  surtr_arknights_r18_cabin_night: 'Completely nude with her black silk loungewear cast aside, Surtr leans back against the bed with no other people present, candlelight tracing the lines of her shoulders and her full bare breasts, wine-red hair spilling over them, gentle loving blush as she glances toward the viewer.',
  surtr_arknights_r18_hot_spring: 'Completely nude in the steaming hot spring, Surtr rests her arms on the snowy rocky edge with no other people present, moonlight mixing with rising steam as snowflakes melt on her bare shoulders, soft breasts just above the water, gentle smile and loving blush.',
  surtr_arknights_r18_morning_bed: 'Completely nude beneath the thin blanket, Surtr lies on her side with no other people present, wine-red hair spread across the pillow as she looks back over her shoulder, the pale morning light tracing her bare shoulder and the soft curve of her breast at the sheet edge, sleepy gentle smile.',
  surtr_arknights_r18_lava_glow: 'Completely nude in the volcanic stone chamber at night, Surtr leans against the rough wall with no other people present, the deep red lava glow tracing her bare skin, the curves of her body and full bare breasts glowing in the warm light, half-lidded eyes watching the viewer with a quiet loving blush.',
  kaltsit_arknights_r18_medical_bath: 'Completely naked under the warm spray in the Rhodes Island bath, Kal\'tsit stands with no other people present, steam curling around her as water runs through her pale mint-green hair and down her bare breasts and slender body, soft skin flushed in the warm light.',
  kaltsit_arknights_r18_desk_night: 'Completely nude with her evening gown cast aside on the chair, Kal\'tsit sits on the edge of the desk with no other people present, the lamp casting long shadows across her bare breasts and slender figure as she regards the viewer with an unreadable, knowing smile.',
  kaltsit_arknights_r18_mon3tr_guard: 'Completely nude with her emerald silk robe slipped away, Kal\'tsit lies on her side in the moonlit cabin with no other people present, silver light pooling on the sheets over her bare skin and quiet curves, calm patient expression.',
  chen_arknights_r18_apartment: 'In her Lungmen apartment at night, Ch\'en sits on the arm of the sofa with her uniform loosened and unbuttoned, revealing her bare breasts and smooth skin, no other people present, warm lamplight softening her usually stern face as she looks at the viewer with a quiet blush.',
  chen_arknights_r18_bath_towels: 'Fresh from the bath in her apartment, Ch\'en dries her damp dark teal hair with a towel wrapped around her body, only her bare shoulders, the soft upper curve of her breasts and long legs exposed, no other people present, warm steam still hanging in the air as she turns toward the viewer.',
  chen_arknights_r18_bed_sword: 'Completely nude in her bedroom late at night, Ch\'en lies on her side with her blade resting beside the pillow and no other people present, the dim lamp throwing gentle shadows across her bare breasts and smooth skin.',
  chen_arknights_r18_rooftop_kiss: 'Completely nude, Ch\'en leans back against the floor-to-ceiling window late at night with no other people present, the glittering city lights below and moonlight streaming over her bare breasts and slender body as she holds the viewer\'s gaze.',
  eyjafjalla_arknights_r18_lab_night: 'In the darkened lab, Eyjafjalla sits on the edge of the counter with no other people present, her dark research coat slipping from her shoulders and falling away to reveal her bare breasts and pale skin as she rubs her tired eyes and turns to the viewer with a soft blush.',
  eyjafjalla_arknights_r18_dorm_blanket: 'Completely nude beneath the thin blanket, Eyjafjalla curls up in the warm lamp light with no other people present, the blanket slipping to reveal her bare shoulder and the soft curve of her breast as she peeks sleepily over the edge.',
  eyjafjalla_arknights_r18_hot_spring_private: 'Completely nude in the private hot spring under the night sky, Eyjafjalla rests her chin on the rocky edge with no other people present, steam rising around her bare shoulders and soft breasts, gentle blush in the moonlight.',
  eyjafjalla_arknights_r18_candle_lab: 'Completely nude with her uniform discarded in the darkened lab, Eyjafjalla sits on the edge of the table with no other people present, a single candle flickering beside her as its warm light traces her bare breasts, collarbone and the curve of her shy smile.',
  lemuen_arknights_r18_bath_halo: 'Completely nude in her bathroom at night, Lemuen rests against the tub with no other people present, steam beading on her bare breasts and skin while her halo sheds a faint glow through the mist, a quiet blush.',
  suzuran_arknights_r18_kimono_slip: 'In her room at night, Suzuran kneels on the futon with no other people present, one sleeve of her kimono slipping from her shoulder, the loosened collar showing a hint of her bare breast, candlelight warming her blushing face.',
  suzuran_arknights_r18_tails_wrap: 'Completely nude with her fluffy pajama top open, Suzuran lies on her side with no other people present, her nine golden tails curling gently around her bare shoulders and soft breasts as moonlight spills over the soft fur.',
  suzuran_arknights_r18_spring_bath: 'Completely nude in the lantern-lit hot spring, Suzuran rests her chin on the rocky edge with no other people present, soaked tails draped over the stones, bare breasts just above the water, steam rising around her as she blushes softly.',
  suzuran_arknights_r18_futon_morning: 'Completely nude beneath the blanket she clutches to her chest, Suzuran stirs on her futon in the pale morning light with no other people present, ears drooping, bare shoulder and silhouette softly outlined as she blinks sleepily at the viewer.',
  perlica_arknights_r18_quarters_terminal: 'In her private quarters at night, Perlica sits on the edge of the bed with no other people present, her uniform collar loosened and open to reveal her bare collarbone and the soft upper curve of her breasts, terminal glow lighting her calm face.',
  perlica_arknights_r18_hygiene_bay: 'Completely nude under the warm mist in the Endfield hygiene bay, Perlica stands with no other people present, water running through her platinum hair with light cyan-blue tips and streaming down her bare breasts and smooth body as she relaxes her shoulders.',
  perlica_arknights_r18_bunk_late: 'Late at night in her quarters, Perlica sits cross-legged on the bunk reading a report with no other people present, her outer jacket draped over her shoulders while an open lounge top reveals her bare breasts and soft skin, the dim lamp pooling light over the paper and her tired but steady eyes.',
  perlica_arknights_r18_viewport: 'Completely nude by the great viewport at night, Perlica leans against the glass with no other people present, the starfield outside framing her bare breasts and silhouette as she turns to regard the viewer.',
  laevatain_arknights_r18_quarters_flame: 'Completely nude with her cozy loungewear discarded, Laevatain sits on the edge of the bed with no other people present, small embers flickering between her fingers as the dim glow traces her horns and the soft curves of her bare body.',
  laevatain_arknights_r18_ice_bath: 'Completely nude in the icy bath chamber, Laevatain rests against the edge with no other people present, cold blue light on her bare breasts and skin while faint steam still rises from her shoulders.',
  laevatain_arknights_r18_sword_side: 'Completely nude, Laevatain lies on her side with no other people present, one hand resting on the hilt of her greatsword beside the bed as faint ember light flickers across her bare shoulders and breasts.',
  laevatain_arknights_r18_lava_pool: 'Completely nude at the edge of the molten pool at night, Laevatain stands with no other people present, the deep red glow painting her bare silhouette and breasts as she looks back with a faint, knowing smile.',
};
for (const [id, prose] of Object.entries(NSFW_PROSE)) {
  const b = bp(id);
  if (!b) { fails.push(`${id}: 蓝本不存在 (nsfwProse)`); continue; }
  if (b.nsfwProse === prose) { skipped.push(`${id}.nsfwProse already`); continue; }
  b.nsfwProse = prose; applied.push(`${id}.nsfwProse rewritten`);
}

// =====================================================================
// G. 场景库 scenes.json
// =====================================================================
// story 重复段标头清理（幂等：只处理仍存在的）
let headerFixed = 0;
for (const s of scenes) {
  const st = String(s.story || '');
  if (/^【成人 After Story · (宁宁|夏目)】/.test(st)) { s.story = st.replace(/^【成人 After Story · (宁宁|夏目)】/, ''); headerFixed++; }
  if (/^【成年 After Story · 宁宁】【宁宁 ·/.test(s.story)) { s.story = s.story.replace(/^【成年 After Story · 宁宁】/, ''); headerFixed++; }
}
if (headerFixed) applied.push(`scenes story header fixed x${headerFixed}`);

['sc004', 'sc015'].forEach((id) => removeSceneTokens(id, 'prompt', ['sunset']));
['sc014', 'sc019'].forEach((id) => removeSceneTokens(id, 'prompt', ['window_light']));
removeSceneTokens('sc021', 'prompt', ['bedroom']);
removeSceneTokens('sc033', 'prompt', ['golden_hour']);
removeSceneTokens('sc043', 'prompt', ['(smartphone held for a video call:1.55)', 'phone screen facing viewer']);
removeSceneTokens('sc043', 'negative', ['no phone', 'empty hands']);
removeSceneTokens('sc059', 'prompt', ['no mug in hand']);
removeSceneTokens('sc059', 'negative', ['holding cup', 'mug held toward viewer', 'holding mug']);
removeSceneTokens('sc065', 'negative', ['side profile']);
removeSceneTokens('sc069', 'prompt', ['holding_hands']);
removeSceneTokens('sc073', 'prompt', ['bathroom']);
removeSceneTokens('sc079', 'prompt', ['sitting']);
removeSceneTokens('sc200', 'negative', ['nsfw', 'nude', 'explicit']);
removeSceneTokens('sc149', 'prompt', ['hair_ribbon']);
['sc290', 'sc291', 'sc292', 'sc298', 'sc299'].forEach((id) => removeSceneTokens(id, 'prompt', ['nude']));
removeSceneTokens('sc244', 'prompt', ['(black cat sleeping on her lap:1.55)']);
// token 替换
[['sc153', 'prompt', 'legs_apart', 'legs_together'],
 ['sc165', 'prompt', 'kitchen', 'cafe_interior'],
 ['sc192', 'prompt', 'lying_on_couch', 'lying_on_floor'],
 ['sc203', 'prompt', 'lying_on_bed', 'sitting_on_tatami'],
 ['sc276', 'prompt', 'one_arm_covering_part_of_her_chest', 'arm_covering_her_flushed_face'],
 ['sc234', 'prompt', 'striped_legwear', 'black_thighhigh_stockings'],
].forEach(([id, f, a, b]) => replaceSceneToken(id, f, a, b));
// tags 数组同步
['sc004', 'sc015'].forEach((id) => removeSceneTokens(id, 'tags', ['sunset']));
['sc014', 'sc019'].forEach((id) => removeSceneTokens(id, 'tags', ['window_light']));
removeSceneTokens('sc021', 'tags', ['bedroom']);
removeSceneTokens('sc033', 'tags', ['golden_hour']);
removeSceneTokens('sc043', 'tags', ['bathroom']);
removeSceneTokens('sc069', 'tags', ['holding_hands']);
removeSceneTokens('sc073', 'tags', ['bathroom']);
removeSceneTokens('sc079', 'tags', ['sitting']);
removeSceneTokens('sc149', 'tags', ['hair_ribbon']);
[['sc153', 'tags', 'legs_apart', 'legs_together'],
 ['sc165', 'tags', 'kitchen', 'cafe_interior'],
 ['sc192', 'tags', 'lying_on_couch', 'lying_on_floor'],
 ['sc203', 'tags', 'lying_on_bed', 'sitting_on_tatami'],
 ['sc234', 'tags', 'striped_legwear', 'black_thighhigh_stockings'],
].forEach(([id, f, a, b]) => replaceSceneToken(id, f, a, b));
// sc234 不对称腿装整段 → 纯黑丝
replaceStrInScene('sc234', 'prompt', 'asymmetrical legwear, one black-and-white striped thighhigh, one white frilled sock', 'pure black thighhigh stockings');
// story 文案对齐
replaceStrInScene('sc123', 'story', '午后阳光慵懒的公寓厨房', '清晨阳光的公寓厨房');
replaceStrInScene('sc227', 'story', '乌黑的短发', '乌黑的长发');
// 成人态对齐（幂等：等于目标则跳过）
const sc154 = sc('sc154'); if (sc154) { if (sc154.rating !== 'R18') { sc154.rating = 'R18'; applied.push('sc154 rating→R18'); } if (sc154.mature !== true) { sc154.mature = true; applied.push('sc154 mature'); } if (Array.isArray(sc154.usage)) sc154.usage = sc154.usage.map((u) => (u === 'R15' ? 'R18' : u)); }
const sc200 = sc('sc200'); if (sc200) { if (sc200.rating !== 'R18') { sc200.rating = 'R18'; applied.push('sc200 rating→R18'); } if (sc200.mature !== true) { sc200.mature = true; applied.push('sc200 mature'); } }

// sc090 姿势：故事=站立樱花道回眸（原 prompt 强制蹲姿描心、负向还禁 standing）
replaceStrInScene('sc090', 'prompt', '(crouching alone in extreme foreground:1.5), (right index finger touching the ground and tracing one heart groove through fallen pink cherry petals:1.8), hand and petal heart clearly visible,',
  'standing alone in the empty cherry-blossom path, (one hand gently pressing her pink hair ribbon:1.3), looking back over her shoulder with a gentle smile,');
removeSceneTokens('sc090', 'negative', ['standing']);
removeSceneTokens('sc090', 'tags', ['crouching']);
// 9 条 story 重复段标头：去掉前两个「成年/成人 After Story · 宁宁」残留，只留「【宁宁 · X】」
let multiHdr = 0;
for (const s of scenes) {
  const st = String(s.story || '');
  const m = st.match(/^【成年 After Story · (宁宁|夏目)】\s*【成人 After Story · (宁宁|夏目)】\s*(?=【(宁宁|夏目) ·)/);
  if (m) { s.story = st.slice(m[0].length); multiHdr++; }
}
if (multiHdr) applied.push(`scenes triple story header cleaned x${multiHdr}`);

// =====================================================================
// 写回 + 重建分片
// =====================================================================
fs.writeFileSync(bpFile, JSON.stringify(bpData, null, 2) + '\n', 'utf8');
fs.writeFileSync(scFile, JSON.stringify(scenes, null, 2) + '\n', 'utf8');
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scenes-index.json'), 'utf8'));
const writeShard = (file, list) => { fs.writeFileSync(path.join(ROOT, 'data', file), JSON.stringify(list, null, 2) + '\n', 'utf8'); applied.push(`regen ${file}`); };
writeShard('scenes-nene.json', scenes.filter((s) => s.char === 'nene'));
writeShard('scenes-natsume.json', scenes.filter((s) => s.char === 'natsume'));
writeShard('scenes-shared.json', scenes.filter((s) => s.char === 'triad' || s.char === 'shared'));
const coreIds = (index.tiers && index.tiers.core) || [];
writeShard('scenes-core.json', coreIds.map((id) => scenes.find((s) => s.id === id)).filter(Boolean));

console.log('APPLIED:', applied.length);
applied.slice(0, 400).forEach((a) => console.log('  +', a));
console.log('\nSKIPPED(idempotent):', skipped.length);
if (fails.length) {
  console.log('\nFAILS:', fails.length);
  fails.forEach((f) => console.log('  !', f));
  process.exitCode = 1;
} else {
  console.log('\nOK: 全部修复应用完毕，断言全部通过（无 FAIL）。');
}
