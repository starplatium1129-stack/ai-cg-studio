'use strict';
// 2026-08-18 审视修复：character-reference-standards.json 今日 10 位角色参考标准
// 1) identityTokens 全部对齐 popular-characters.json（Danbooru 标准 tag + 作品 tag + 官方特征）
// 2) 菲伦标准整体重写：identity 官方化（low side ponytail）、outfits 对齐 popular 4 形态
//    （修复 1addf85 重构引入的「黑大衣+白裙」设定写反 bug）
// 3) 白夜/塞西莉亚 identityProse 重写：清除旧设定残留
//    （白夜深蓝发姬发式 → 银白发双螺旋角发包；塞西莉亚银白双钻卷蓝眼 → 薄荷绿发低盘发绿瞳）
const fs = require('fs');
const file = 'data/character-reference-standards.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const pc = JSON.parse(fs.readFileSync('data/popular-characters.json', 'utf8'));

const todayIds = ['alisa_mikhailovna_kujou','sylphiette','yuigahama_yui','jeanne_alter','matou_sakura','yor_forger','reze_chainsaw','fern_frieren','mimori_byakuya','saint_cecilia'];

for (const id of todayIds) {
  const std = data.characters.find(x => x.id === id);
  const pop = pc.characters.find(x => x.id === id);
  if (!std || !pop) throw new Error('missing ' + id);
  // identityTokens 对齐 popular（含校准后的 Danbooru tag 与作品 tag）
  std.identityTokens = [...pop.identityTokens];
}

// ── 菲伦：identity + outfits 官方化重写 ──
{
  const fern = data.characters.find(x => x.id === 'fern_frieren');
  const pop = pc.characters.find(x => x.id === 'fern_frieren');
  fern.identityProse = "Fern from Frieren: Beyond Journey's End, a calm and composed human mage with long straight purple hair tied in a low side ponytail, calm violet eyes, soft rounded features, and a tall voluptuous figure with large breasts.";
  const stdOutfits = fern.outfits || [];
  const nude = stdOutfits.find(o => o.isNsfw) || {
    id: 'nsfw_nude', name: '私密全裸 / 丰满纯粹形态', isDefault: false, isNsfw: true,
    prose: 'completely naked, full body bare, large natural soft breasts, plush voluptuous curves, gentle shy blush, no clothes',
    tokens: ['completely_naked', 'full_body_bare', 'large_breasts', 'curvy', 'cleavage', 'bare_shoulders'],
  };
  const popOutfits = pop.outfits.filter(o => o.id !== 'nsfw_nude');
  fern.outfits = popOutfits.map((o, i) => ({
    id: o.id,
    name: o.name,
    isDefault: i === 0,
    prose: o.prose,
    tokens: o.tokens,
  }));
  fern.outfits.push(nude);
}

// ── 白夜：identityProse 重写（银白发双螺旋角发包） ──
{
  const c = data.characters.find(x => x.id === 'mimori_byakuya');
  c.identityProse = "Byakuya Mimori from The Magical Girl and the Evil Officer, a severely impoverished magical girl with long silver-white hair tied into signature twin spiral horn buns, straight bangs with long sidelocks, round gradient blue eyes, a soft deadpan innocent expression, and a delicate slender petite figure.";
}

// ── 塞西莉亚：identityProse 重写（薄荷绿发低盘发绿瞳巨乳） ──
{
  const c = data.characters.find(x => x.id === 'saint_cecilia');
  c.identityProse = "Saint Cecilia from Saint Cecilia and Pastor Lawrence, a holy and delightfully lazy saint with soft pastel mint-green hair in a low braided bun with one long delicate sidelock, bright emerald green eyes, a gentle blush, and a shapely mature figure with large breasts.";
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: character-reference-standards.json updated');

// 验证
const check = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const id of todayIds) {
  const std = check.characters.find(x => x.id === id);
  const pop = pc.characters.find(x => x.id === id);
  const sameTokens = JSON.stringify(std.identityTokens) === JSON.stringify(pop.identityTokens);
  const sameOutfits = JSON.stringify(std.outfits.map(o => o.id).sort()) === JSON.stringify(pop.outfits.map(o => o.id).sort());
  console.log(id, '| tokens:', sameTokens ? '✓' : 'MISMATCH', '| outfits:', sameOutfits ? '✓' : 'MISMATCH');
}
