'use strict';
// 2026-08-18 审视修复：popular-characters.json 今日新增 9 位角色校准
// 依据 Research/character-anime/*.json 权威调研（萌娘百科 + Danbooru API）
const fs = require('fs');
const file = 'data/popular-characters.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

function find(id) {
  const c = data.characters.find(x => x.id === id);
  if (!c) throw new Error('missing ' + id);
  return c;
}
function addUnique(arr, ...items) {
  for (const it of items) if (it && !arr.includes(it)) arr.push(it);
  return arr;
}
function replaceToken(arr, from, to) {
  const i = arr.indexOf(from);
  if (i >= 0) arr[i] = to;
  else if (!arr.includes(to)) arr.push(to);
  return arr;
}

// ── sylphiette ──────────────────────────────────────────────
{
  const c = find('sylphiette');
  c.canon = {
    world: '古典奇幻（无职转生·六面世界）',
    era: '中世纪风',
    formNotes: '米格路德族（长耳族）1/4 混血（人族1/2+兽族1/4+长耳族1/4）；又长又尖的双耳是个人标志（高兴/害羞时会扑腾）；幼年绿发→青年白发；红瞳；贫乳；不擅长火系魔术',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'studio bind, official anime screencap, anime coloring';
  c.aliases = ['sylphiette', 'sylphie', 'sylphiette grayrat', 'mushoku tensei', '希露菲叶特', '希露菲'];
  c.exactTokens = ['sylphiette_(mushoku_tensei)'];
  addUnique(c.identityTokens, 'mushoku_tensei');
}
// ── yuigahama_yui ───────────────────────────────────────────
{
  const c = find('yuigahama_yui');
  c.canon = {
    world: '现代校园（春物·总武高中）',
    era: '当代',
    formNotes: '橙粉发色团子头（side bun）；琥珀瞳；官方身材丰满；侍奉部成员；开朗天然、善察人意',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'feel. (studio), official anime screencap, anime coloring';
  c.aliases = ['yuigahama_yui', 'yui', 'yui yuigahama', 'oregairu', 'yahari ore no seishun', '由比滨结衣', '结衣'];
  addUnique(c.identityTokens, 'oregairu');
}
// ── jeanne_alter ────────────────────────────────────────────
{
  const c = find('jeanne_alter');
  c.canon = {
    world: '现代奇幻（Fate/Grand Order）',
    era: '当代+英灵',
    formNotes: '银白短发；金色瞳；复仇者职阶；黑色战铠+龙之魔女披风+军旗；新宿篇皮夹克便服；水着黑色系带比基尼+武士刀；黑色高开叉晚礼服',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'type-moon, ufotable, official anime screencap';
  c.aliases = ['jeanne alter', 'jalter', "jeanne d'arc alter", 'fate grand order', 'fgo', '贞德[Alter]', '黑贞德'];
  c.exactTokens = ["jeanne_d'arc_alter_(fate)"];
  replaceToken(c.identityTokens, "jeanne_d'arc_(alter)_(fate)", "jeanne_d'arc_alter_(fate)");
}
// ── matou_sakura ────────────────────────────────────────────
{
  const c = find('matou_sakura');
  c.canon = {
    world: '现代奇幻（Fate/stay night）',
    era: '当代',
    formNotes: '紫色长发；紫色瞳；红色缎带发饰；身材丰满；穗群原学园制服；黑化形态红纹礼服',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'type-moon, ufotable, official anime screencap';
  c.aliases = ['matou sakura', 'sakura', 'sakura matou', 'fate stay night', 'fsn', '间桐樱', '樱'];
  addUnique(c.identityTokens, 'fate/stay_night');
}
// ── yor_forger ──────────────────────────────────────────────
{
  const c = find('yor_forger');
  c.canon = {
    world: '现代日常+间谍（SPY x FAMILY）',
    era: '当代',
    formNotes: '黑色长发低发髻；红瞳；金色玫瑰耳环；荆棘公主（Thorn Princess）黑色露肩高叉礼服名场面；居家红色露肩毛衣；市政厅绿色职业装',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'WIT STUDIO, CloverWorks, official anime screencap, anime coloring';
  c.aliases = ['yor forger', 'yor briar', 'thorn princess', 'spy x family', '约尔·福杰', '约尔'];
  c.exactTokens = ['yor_briar'];
  replaceToken(c.identityTokens, 'yor_forger', 'yor_briar');
  addUnique(c.identityTokens, 'spy_x_family');
  const thorn = c.outfits.find(o => o.id === 'thorn_princess_dress');
  if (thorn) thorn.prose = thorn.prose.replace('stiletto stilettos', 'black stiletto heels');
}
// ── reze_chainsaw ───────────────────────────────────────────
{
  const c = find('reze_chainsaw');
  c.canon = {
    world: '现代都市+恶魔（电锯人·蕾塞篇）',
    era: '1997',
    formNotes: '粉紫短发；绿色瞳；标志性黑色颈环（choker）；无袖白衬衫+黑领带+黑短裤；咖啡厅打工围裙装；夜间学校泳池死库水；炸弹恶魔',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'MAPPA, official anime screencap, anime coloring';
  c.aliases = ['reze', 'reze chainsaw man', 'chainsaw man', '蕾塞'];
  c.exactTokens = ['reze_(chainsaw_man)'];
}
// ── fern_frieren ────────────────────────────────────────────
{
  const c = find('fern_frieren');
  c.canon = {
    world: '古典奇幻（葬送的芙莉莲）',
    era: '中世纪风',
    formNotes: '紫色长发低侧马尾；紫瞳；身材丰满；第一阶魔法使白袍；性格冷静、毒舌、爱睡懒觉',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'madhouse, official anime screencap, anime coloring';
  c.aliases = ['fern', 'fern frieren', 'sousou no frieren', 'frieren beyond journeys end', '菲伦'];
  c.exactTokens = ['fern_(sousou_no_frieren)'];
  replaceToken(c.identityTokens, 'fern_(frieren)', 'fern_(sousou_no_frieren)');
}
// ── mimori_byakuya ──────────────────────────────────────────
{
  const c = find('mimori_byakuya');
  c.canon = {
    world: '现代都市+魔法少女（魔法少女与恶曾是敌人，藤原可可亚）',
    era: '当代',
    formNotes: '银白发；蓝瞳；标志性双螺旋角发包；维多利亚蕾丝白色洋装；孤儿+打工族+贫穷；天然呆、不幸体质；魔法少女活动名 Glass Happiness',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'BONES, official anime screencap, anime coloring';
  c.aliases = ['mimori byakuya', 'byakuya', 'glass happiness', 'magical girl and the evil officer', '深森白夜'];
  // identityProse 精简：剥离服装描述（首批 identityProse 不含服装；服装由 outfitProse 承载）
  c.identityProse = 'Byakuya Mimori from The Magical Girl and the Evil Officer, a delicate girl with flowing silver-white hair tied into twin spiral horn buns on each side of her head, straight bangs with long sidelocks, round gradient blue eyes, and a soft deadpan innocent expression.';
}
// ── saint_cecilia ───────────────────────────────────────────
{
  const c = find('saint_cecilia');
  c.canon = {
    world: '中世纪欧洲小镇（白圣女与黑牧师，和武叶佐乃）',
    era: '中世纪风',
    formNotes: '浅绿/薄荷嫩绿长发低盘发+不对称长鬓发+M形刘海；翠绿圆瞳；官方萌点巨乳；纯白圣女修女袍+头纱+十字架金项链；天然呆、怕打雷、平地摔；暗恋劳伦斯',
    research: '2026-08-18 调研',
  };
  c.animeStudio = 'doga kobo, official anime screencap, anime coloring';
  c.aliases = ['cecilia', 'saint cecilia', 'shiro seijo to kuro bokushi', 'pastor lawrence', '塞西莉亚'];
  c.exactTokens = ['cecilia_(shiro_seijo_to_kuro_bokushi)'];
  addUnique(c.identityTokens, 'large_breasts');
  // identityProse 精简：剥离服装描述
  c.identityProse = 'Saint Cecilia from Saint Cecilia and Pastor Lawrence, a sweet and pure saint with soft pastel mint-green hair styled in a low braided bun with one long delicate sidelock, bright emerald green eyes, a gentle blush, and a soft innocent presence.';
}

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: popular-characters.json updated');
// verify
const check = JSON.parse(fs.readFileSync(file, 'utf8'));
const todayIds = ['alisa_mikhailovna_kujou','sylphiette','yuigahama_yui','jeanne_alter','matou_sakura','yor_forger','reze_chainsaw','fern_frieren','mimori_byakuya','saint_cecilia'];
for (const id of todayIds) {
  const c = check.characters.find(x => x.id === id);
  console.log(id, '| canon:', !!c.canon, '| studio:', !!c.animeStudio, '| aliases:', c.aliases.length, '| exact:', JSON.stringify(c.exactTokens), '| proseLen:', c.identityProse.length);
}
