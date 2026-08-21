'use strict';
// 2026-08-18 审视修复（终版）：菲伦双数据漂移统一 + 白夜/塞西莉亚 TS 旧设定清除
// 背景：1addf85 重构菲伦参考标准（journey_robe/winter_coat/town_casual，参考图磁盘带前缀），
// 但 popular-characters.json 与 characterReferenceData.ts 未同步 → 双数据漂移 + 12 个参考图 URL 404。
// 方案：popular 菲伦 outfits 统一为 6 形态（3 重构官方形态 + 2 旧场景形态 + nude），
// 参考图 URL 用磁盘实际文件名（带前缀），identity 官方化（半扎低侧马尾+齐刘海+长鬓角）。
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

const POPULAR = path.join(ROOT, 'data', 'popular-characters.json');
const STANDARDS = path.join(ROOT, 'data', 'character-reference-standards.json');
const BLUEPRINTS = path.join(ROOT, 'data', 'scene-blueprints.json');
const TS_FILE = path.join(ROOT, 'src', 'utils', 'characterReferenceData.ts');
const REF_BASE = path.join(ROOT, 'assets', 'character-references');

const FERN_IDENTITY_PROSE = "Fern from Frieren: Beyond Journey's End, a calm and composed human mage with long straight purple hair tied low in a half-up side ponytail, straight bangs with long sidelocks, calm violet eyes, soft rounded features, and a tall voluptuous figure with large breasts.";
const FERN_IDENTITY_TOKENS = ['fern_(sousou_no_frieren)', 'fern', '1girl', 'solo', 'long_hair', 'purple_hair', 'side_ponytail', 'half-updo', 'straight_bangs', 'long_sidelocks', 'purple_eyes', 'large_breasts'];

const FERN_OUTFITS = [
  { id: 'journey_robe', name: '旅途魔法长袍', default: true,
    prose: 'wearing her signature long black wizard coat with a hood over a pristine white high-collar dress, holding wooden magic staff, gentle modest drape',
    tokens: ['black_coat', 'white_dress', 'high_collar', 'long_sleeves', 'magic_staff', 'boots'] },
  { id: 'winter_coat', name: '冬季厚风衣围巾装', default: false,
    prose: 'wearing a warm beige winter overcoat with a large fluffy knit muffler scarf wrapped around neck, cute cold weather travel clothes',
    tokens: ['winter_coat', 'overcoat', 'scarf', 'muffler', 'gloves', 'boots'] },
  { id: 'town_casual', name: '城镇甜品便服', default: false,
    prose: 'wearing a comfy soft knit cardigan, pleated long skirt, holding a small dessert fork, relaxed cute dating style',
    tokens: ['cardigan', 'long_skirt', 'blouse', 'ribbon'] },
  { id: 'noble_ball_dress', name: '贵族舞会典雅深紫礼服', default: false,
    prose: 'wearing a gorgeous deep violet aristocratic ball gown with elbow-length white gloves and styled hair for a court dance',
    tokens: ['evening_dress', 'purple_dress', 'ball_gown', 'white_gloves', 'updo_hair'] },
  { id: 'inn_morning_nightgown', name: '旅馆清晨纯棉睡裙', default: false,
    prose: 'wearing a loose white cotton nightgown with her long purple hair flowing loosely around her shoulders',
    tokens: ['nightgown', 'white_nightgown', 'loose_dress', 'bare_shoulders', 'messy_hair'] },
  { id: 'nsfw_nude', name: '🔞 私密全裸 / 纯粹形态', default: false, isNsfw: true,
    prose: 'completely naked with zero clothes, very soft voluptuous body, exposed pink pussy, detailed vulva, very large soft breasts with pink nipples, pouting blush',
    tokens: ['nude', 'completely_naked', 'uncensored', 'full_body_bare', 'large_breasts', 'exposed_pussy', 'detailed_vulva', 'pink_nipples', 'soft_skin', 'bare_feet'] },
];

// ── 1. popular-characters.json：菲伦 outfits + identity ──
{
  const data = JSON.parse(fs.readFileSync(POPULAR, 'utf8'));
  const fern = data.characters.find(x => x.id === 'fern_frieren');
  fern.identityProse = FERN_IDENTITY_PROSE;
  fern.identityTokens = [...FERN_IDENTITY_TOKENS];
  fern.outfits = FERN_OUTFITS.map(o => ({
    id: o.id, name: o.name, prose: o.prose, tokens: o.tokens,
    ...(o.default ? { default: true } : {}),
  }));
  fs.writeFileSync(POPULAR, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('popular: fern outfits ->', fern.outfits.length);
}

// ── 2. scene-blueprints.json：菲伦场景 outfitId 同步 ──
{
  const data = JSON.parse(fs.readFileSync(BLUEPRINTS, 'utf8'));
  const map = { mage_white_robe: 'journey_robe', winter_travel_coat: 'winter_coat' };
  let n = 0;
  for (const b of data.blueprints) {
    if (b.characterId !== 'fern_frieren') continue;
    if (map[b.outfitId]) { b.outfitId = map[b.outfitId]; n++; }
  }
  fs.writeFileSync(BLUEPRINTS, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('blueprints: fern outfitId remapped x' + n);
}

// ── 3. character-reference-standards.json：菲伦 6 形态 + identity ──
{
  const data = JSON.parse(fs.readFileSync(STANDARDS, 'utf8'));
  const fern = data.characters.find(x => x.id === 'fern_frieren');
  fern.identityProse = FERN_IDENTITY_PROSE;
  fern.identityTokens = [...FERN_IDENTITY_TOKENS];
  fern.outfits = FERN_OUTFITS.map((o, i) => ({
    id: o.id, name: o.name, isDefault: o.default || i === 0,
    ...(o.isNsfw ? { isNsfw: true } : {}),
    prose: o.prose, tokens: o.tokens,
  }));
  // 白夜/塞西莉亚 identityProse 已官方化（前面脚本），此处复核
  const bya = data.characters.find(x => x.id === 'mimori_byakuya');
  const cec = data.characters.find(x => x.id === 'saint_cecilia');
  console.log('standards: byakuya prose ok =', bya.identityProse.includes('silver-white hair tied into signature twin spiral horn buns'));
  console.log('standards: cecilia prose ok =', cec.identityProse.includes('mint-green hair'));
  fs.writeFileSync(STANDARDS, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('standards: fern outfits ->', fern.outfits.length);
}

// ── 4. characterReferenceData.ts：菲伦 6 形态（URL 用磁盘实际文件名）+ 白夜/塞西莉亚 identityProse ──
{
  const ts = fs.readFileSync(TS_FILE, 'utf8');
  const start = ts.indexOf('= {');
  const end = ts.indexOf('\n\nexport function', start);
  const jsonText = ts.slice(start + 2, end).trim().replace(/;?\s*$/, '');
  const data = JSON.parse(jsonText);

  // 菲伦：重建 outfits（references 按磁盘实际文件）
  const outfitDirs = [];
  for (const o of FERN_OUTFITS) {
    const dir = path.join(REF_BASE, 'fern_frieren', o.id);
    let files = [];
    if (fs.existsSync(dir)) {
      files = fs.readdirSync(dir).filter(f => /\.png$/i.test(f)).sort();
    }
    const refs = [
      { id: 'ref_01_face_closeup', name: '面部特写', shotType: '特写 · 85mm 浅景深', lens: '85mm f/1.4 Portrait Lens', targetUsage: ['对白特写', '微表情', '情绪反应镜头', '台词对峙'] },
      { id: 'ref_02_half_medium', name: '3/4半身定妆', shotType: '半身 · 中景', lens: '50mm Medium Lens', targetUsage: ['对话交互', '过肩推拉', '室内中景', '双人互动'] },
      { id: 'ref_03_full_dynamic', name: '正面全身立姿', shotType: '全身 · 广角 50mm', lens: '50mm Wide Frame', targetUsage: ['登场走入', '全景走位', '全身动作', '空间交代'] },
      { id: 'ref_04_back_rear', name: '45°侧后背影', shotType: '侧后 · 轮廓光', lens: '85mm Cinematic Edge', targetUsage: ['过肩反打', '转身离去', '背影叙事', '神秘氛围'] },
    ];
    const references = refs.map(p => {
      const match = files.find(f => f.includes(p.id)) || `${p.id}.png`;
      return { id: p.id, name: p.name, shotType: p.shotType, lens: p.lens, targetUsage: p.targetUsage, fileName: match, url: `/assets/character-references/fern_frieren/${o.id}/${match}` };
    });
    outfitDirs.push({
      outfitId: o.id, outfitName: o.name, isDefault: Boolean(o.default), isNsfw: Boolean(o.isNsfw), prose: o.prose, references,
    });
  }
  data['fern_frieren'] = {
    characterId: 'fern_frieren',
    displayName: '菲伦',
    source: "Frieren: Beyond Journey's End",
    identityProse: FERN_IDENTITY_PROSE,
    outfits: outfitDirs,
  };
  // 白夜/塞西莉亚 identityProse 官方化
  data['mimori_byakuya'].identityProse = "Byakuya Mimori from The Magical Girl and the Evil Officer, a severely impoverished magical girl with long silver-white hair tied into signature twin spiral horn buns, straight bangs with long sidelocks, round gradient blue eyes, a soft deadpan innocent expression, and a delicate slender petite figure.";
  data['saint_cecilia'].identityProse = "Saint Cecilia from Saint Cecilia and Pastor Lawrence, a holy and delightfully lazy saint with soft pastel mint-green hair in a low braided bun with one long delicate sidelock, bright emerald green eyes, a gentle blush, and a shapely mature figure with large breasts.";

  const json = JSON.stringify(data, null, 2);
  const newTs = ts.slice(0, start + 2) + json + ts.slice(end);
  fs.writeFileSync(TS_FILE, newTs, 'utf8');
  console.log('TS: fern outfits ->', data['fern_frieren'].outfits.length, '| byakuya/cecilia prose updated');
}

// ── 5. 验证 ──
{
  const ts = fs.readFileSync(TS_FILE, 'utf8');
  const start = ts.indexOf('= {');
  const end = ts.indexOf('\n\nexport function', start);
  const data = JSON.parse(ts.slice(start + 2, end).trim().replace(/;?\s*$/, ''));
  let total = 0, missing = 0;
  for (const [cid, profile] of Object.entries(data)) {
    for (const outfit of profile.outfits || []) {
      for (const ref of outfit.references || []) {
        total++;
        const rel = ref.url.replace(/^\/assets\//, 'assets/');
        if (!fs.existsSync(path.join(ROOT, rel))) { missing++; if (missing <= 10) console.log('MISSING:', ref.url); }
      }
    }
  }
  console.log('verify: total urls', total, '| missing', missing);
}
