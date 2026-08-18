'use strict';
// 2026-08-18 最后一搏：正向空场改造——对 Anima 顽固分身场景，把场景语义从「有人社会空间」
// 正向重建为「空无一人」：sceneTokens 加直白空场标签 + sceneProse 明确 deserted/empty/abandoned。
const fs = require('fs');
const file = 'data/scene-blueprints.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// 每个顽固场景 → 空场文案（替换 prose 里的场景句）+ 追加空场 tokens
const FIX = {
  reze_old_bookstore_reading: {
    tokens: ['empty_bookstore', 'abandoned_shop', 'dusty_aisles', 'no_customers'],
    proseAfter: ' She is the only person in the bookshop; the aisles are completely empty with no customers and no other people inside.',
  },
  cecilia_garden_watering_flowers: {
    tokens: ['empty_garden', 'secluded_garden', 'no_visitors'],
    proseAfter: ' She is alone in the quiet garden; there are no other people anywhere nearby.',
  },
  cecilia_riverbank_evening_walk: {
    tokens: ['empty_riverbank', 'deserted_riverside', 'no_walkers'],
    proseAfter: ' She walks the riverbank completely alone; the path is deserted with not a single other person in sight.',
  },
  sylphiette_grayrat_kitchen_morning: {
    tokens: ['empty_kitchen', 'quiet_household', 'alone_at_home'],
    proseAfter: ' She is alone in the kitchen; the house is quiet and empty of any other person.',
  },
  yor_city_hall_desk_work: {
    tokens: ['empty_office', 'deserted_office_floor', 'no_colleagues', 'closed_hours'],
    proseAfter: ' The office floor is empty during off-hours; she works alone with no colleagues or anyone else present.',
  },
  yor_evening_sofa_knitting: {
    tokens: ['empty_living_room', 'quiet_home_evening', 'alone'],
    proseAfter: ' She is completely alone in the quiet living room; nobody else is at home with her.',
  },
  yui_tennis_court_afternoon: {
    tokens: ['empty_tennis_court', 'deserted_court', 'no_opponent', 'solo_practice'],
    proseAfter: ' The tennis court is completely empty; she practices alone with no opponent and no other people anywhere.',
  },
};

let fixed = 0;
const ids = Object.keys(FIX);
for (const b of data.blueprints) {
  if (!ids.includes(b.id)) continue;
  const f = FIX[b.id];
  // 追加空场 tokens（去重）
  for (const t of f.tokens) if (!b.promptTokens.includes(t)) b.promptTokens.push(t);
  // 场景 prose 追加空场句（在已有 alone 约束后）
  b.promptProse += f.proseAfter;
  // 负面强化：压制任何他人
  const neg = Array.isArray(b.negativeTokens) ? b.negativeTokens : [];
  for (const n of ['no other people', 'no background people', 'no crowd', 'no bystanders', 'empty scene', 'deserted']) {
    if (!neg.includes(n)) neg.push(n);
  }
  b.negativeTokens = neg;
  fixed++;
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('forward-empty refactored scenes:', fixed);
for (const id of ids) {
  const b = data.blueprints.find(x => x.id === id);
  console.log(' ', id, '| tokens+', FIX[id].tokens.length, '| prose tail:', b.promptProse.slice(-70));
}
