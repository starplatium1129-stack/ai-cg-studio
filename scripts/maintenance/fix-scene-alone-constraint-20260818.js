'use strict';
// 2026-08-18 分身根因修复：90 个场景 promptProse 补「她独自一人/空场」约束句。
// 首批场景 57% 带 no other people 约束；今日 0% → 模型在社交场景自由补人且复刻主角。
const fs = require('fs');
const file = 'data/scene-blueprints.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const todayIds = ['sylphiette', 'yuigahama_yui', 'jeanne_alter', 'matou_sakura', 'yor_forger', 'reze_chainsaw', 'fern_frieren', 'mimori_byakuya', 'saint_cecilia'];

// 措辞轮换（避免全部一样），按场景类型分配
const SFW_PHRASES = [
  'She is completely alone; the space around her is empty with no other people anywhere.',
  'She stands all by herself in the empty scene, with no other people present.',
  'The place is deserted and she is the only person in the scene.',
  'There is no one else around; she is entirely alone in the quiet space.',
  'The location is empty of other people, leaving her the sole person in the frame.',
];
const R18_PHRASES = [
  'She is the only person in the room, completely alone.',
  'No one else is present; the room holds only her.',
  'The space is empty of others; she is entirely by herself.',
  'Nobody else is in the room with her—she is alone.',
];

let fixed = 0;
const miss = [];
for (const b of data.blueprints) {
  if (!todayIds.includes(b.characterId)) continue;
  const prose = b.promptProse || '';
  const already = /(no other people|only she|completely alone|she is alone|all by herself|deserted|no one (?:else|around)|nobody|sole person)/i.test(prose);
  if (already) continue;
  // 稳定的伪随机选择（按场景 id hash）→ 措辞轮换
  let h = 0;
  for (const ch of b.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = b.adult ? R18_PHRASES : SFW_PHRASES;
  const phrase = pool[h % pool.length];
  const dot = prose.lastIndexOf('.');
  if (dot >= 0) {
    b.promptProse = prose.slice(0, dot) + '. ' + phrase + prose.slice(dot + 1);
  } else {
    b.promptProse = prose + ' ' + phrase;
  }
  fixed++;
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('appended alone-constraint to scenes:', fixed);

// 验证：今日场景约束覆盖率 + 顽固 12 场景
const check = JSON.parse(fs.readFileSync(file, 'utf8'));
const re = /(no other people|only she|completely alone|she is alone|all by herself|deserted|no one (?:else|around)|nobody|sole person)/i;
let has = 0, total = 0;
for (const b of check.blueprints) {
  if (!todayIds.includes(b.characterId)) continue;
  total++;
  if (re.test(b.promptProse)) has++;
}
console.log('今日场景 alone 约束覆盖:', has + '/' + total);
const fails = ['fern_carriage_stop_snow', 'byakuya_maid_cafe_shift', 'reze_old_bookstore_reading', 'cecilia_bakery_scone_lesson', 'cecilia_garden_watering_flowers', 'cecilia_riverbank_evening_walk', 'sylphiette_grayrat_kitchen_morning', 'yor_city_hall_desk_work', 'yor_evening_sofa_knitting', 'yor_supermarket_shopping', 'yui_tennis_court_afternoon', 'byakuya_classroom_nap_afternoon'];
for (const id of fails) {
  const b = check.blueprints.find(x => x.id === id);
  console.log(' ', id, '| alone:', b && re.test(b.promptProse) ? '✓' : '✗', '|', b ? b.promptProse.slice(-60) : 'MISSING');
}
