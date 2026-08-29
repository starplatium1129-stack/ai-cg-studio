const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_JSON = path.join(ROOT, 'data', 'character-reference-standards.json');
// 2026-08-21 起前端运行时直接加载该 JSON；src/utils/characterReferenceData.ts
// 已改为手写加载器，不再由脚本生成。
const VIEW_JSON_FILE = path.join(ROOT, 'data', 'character-reference-view.json');
// 2026-08-29：参考图迁出项目 → AI 工作区 CharacterReferences；找不到退回项目 assets。
const REF_DIR = (() => {
  const ws = process.env.AI_WORKSPACE_ROOT || path.resolve(ROOT, '..', 'AI');
  const candidate = path.join(ws, 'CharacterReferences');
  return fs.existsSync(candidate) ? candidate : path.join(ROOT, 'assets', 'character-references');
})();

const standards = JSON.parse(fs.readFileSync(STANDARDS_JSON, 'utf8'));
const charList = standards.characters || [];

// 1. 修正菲伦的服装与 4 视角定义，彻底与芙莉莲剥离
const fernStandard = charList.find(c => (c.id || c.characterId) === 'fern_frieren');
if (fernStandard) {
  fernStandard.displayName = '菲伦';
  fernStandard.identityProse = 'Fern from Frieren: Beyond Journey\'s End, a calm and mature mage with long dark purple hair styled in a half-updo ponytail bun, straight bangs, round pouty cute face, chubby cheeks, deep purple eyes, tall voluptuous soft figure with large breasts, wearing modest wizard robes.';
  fernStandard.identityTokens = [
    "fern_(frieren)", "1girl", "solo", "purple_hair", "long_hair", "straight_bangs",
    "half-updo", "ponytail", "hair_bun", "purple_eyes", "round_face", "chubby_cheeks",
    "pout", "voluptuous", "large_breasts"
  ];
  fernStandard.outfits = [
    {
      id: 'journey_robe',
      name: '旅途魔法长袍',
      isDefault: true,
      prose: 'wearing her signature classic long black wizard coat over a pristine white high-collar dress, holding wooden magic staff, gentle modest drape',
      tokens: ['black_coat', 'white_dress', 'high_collar', 'long_sleeves', 'magic_staff', 'boots']
    },
    {
      id: 'winter_coat',
      name: '冬季厚风衣围巾装',
      isDefault: false,
      prose: 'wearing a warm beige winter overcoat with a large fluffy knit muffler scarf wrapped around neck, cute cold weather travel clothes',
      tokens: ['winter_coat', 'overcoat', 'scarf', 'muffler', 'gloves', 'boots']
    },
    {
      id: 'town_casual',
      name: '城镇甜品便服',
      isDefault: false,
      prose: 'wearing a comfy soft knit cardigan, pleated long skirt, holding a small dessert fork, relaxed cute dating style',
      tokens: ['cardigan', 'long_skirt', 'blouse', 'ribbon']
    },
    {
      id: 'nsfw_nude',
      name: '私密全裸 / 丰满纯粹形态',
      isDefault: false,
      isNsfw: true,
      prose: 'completely naked, full body bare, large natural soft breasts, plush voluptuous curves, gentle shy blush, no clothes',
      tokens: ['completely_naked', 'full_body_bare', 'large_breasts', 'curvy', 'cleavage', 'bare_shoulders']
    }
  ];
}

// 2. 修正深森白夜的服装定义为 5 套完整差异化形态
const byakuyaStandard = charList.find(c => (c.id || c.characterId) === 'mimori_byakuya');
if (byakuyaStandard) {
  byakuyaStandard.outfits = [
    {
      id: 'magical_girl_dress',
      name: '魔法少女战服',
      isDefault: true,
      prose: 'wearing her signature magical girl combat dress with ruffled frilled white and pink skirt, glowing magical accessories, detached puffy sleeves',
      tokens: ['magical_girl_dress', 'frilled_skirt', 'detached_sleeves', 'magic_wand', 'hair_ornament']
    },
    {
      id: 'poor_school_uniform',
      name: '褪色旧水手服',
      isDefault: false,
      prose: 'wearing a faded old navy and white sailor school uniform, frayed navy sailor collar with small red neckerchief, pleated navy skirt',
      tokens: ['sailor_uniform', 'sailor_collar', 'red_neckerchief', 'pleated_skirt', 'knee_socks']
    },
    {
      id: 'part_time_maid_apron',
      name: '打工女仆围裙装',
      isDefault: false,
      prose: 'wearing a cute black work dress with white frilled maid apron, white headband, bow on chest, working part-time',
      tokens: ['maid_apron', 'maid_dress', 'headband', 'apron', 'white_frills']
    },
    {
      id: 'tattered_oversized_jersey',
      name: '破旧宽大运动服',
      isDefault: false,
      prose: 'wearing an oversized baggy blue and white tracksuit jersey, zipper pulled down, slouchy homewear style, cute casual',
      tokens: ['oversized_jersey', 'tracksuit', 'zipper', 'baggy_clothes', 'casual_loungewear']
    },
    {
      id: 'nsfw_nude',
      name: '私密全裸 / 纯粹形态',
      isDefault: false,
      isNsfw: true,
      prose: 'completely naked, full body bare, natural slender skin, delicate collarbone and flat chest, no clothes',
      tokens: ['completely_naked', 'full_body_bare', 'flat_chest', 'collarbone', 'bare_skin']
    }
  ];
}

fs.writeFileSync(STANDARDS_JSON, JSON.stringify(standards, null, 2) + '\n', 'utf8');

// 3. 重新生成 TS 文件
const profilesMap = {};
charList.forEach(c => {
  const charId = c.id || c.characterId;
  if (!charId) return;

  profilesMap[charId] = {
    characterId: charId,
    displayName: c.displayName,
    source: c.source,
    identityProse: c.identityProse,
    outfits: (c.outfits || []).map(o => {
      const outfitId = o.id || o.outfitId;
      const outfitDir = path.join(REF_DIR, charId, outfitId);

      const pSpecs = [
        { id: "ref_01_face_closeup", name: "面部特写", shotType: "特写 · 85mm 浅景深", lens: "85mm f/1.4 Portrait Lens", targetUsage: ["对白特写", "微表情", "情绪反应镜头", "台词对峙"] },
        { id: "ref_02_half_medium", name: "3/4半身定妆", shotType: "半身 · 中景", lens: "50mm Medium Lens", targetUsage: ["对话交互", "过肩推拉", "室内中景", "双人互动"] },
        { id: "ref_03_full_dynamic", name: "正面全身立姿", shotType: "全身 · 35mm 站姿", lens: "35mm Full Shot Lens", targetUsage: ["登场走入", "全景走位", "全身动作", "空间交代"] },
        { id: "ref_04_back_rear", name: "45°侧后背影", shotType: "侧后 · 轮廓光", lens: "85mm Cinematic Edge", targetUsage: ["过肩反打", "转身离去", "背影叙事", "神秘氛围"] }
      ];

      return {
        outfitId: outfitId,
        outfitName: o.name || o.outfitName,
        isDefault: !!o.isDefault,
        isNsfw: o.isNsfw || outfitId === 'nsfw_nude',
        prose: o.prose || '',
        references: pSpecs.map(p => {
          let realFileName = `${p.id}.png`;
          if (fs.existsSync(path.join(outfitDir, `${charId}_${outfitId}_${p.id}.png`))) {
            realFileName = `${charId}_${outfitId}_${p.id}.png`;
          } else if (fs.existsSync(path.join(outfitDir, `${p.id}.png`))) {
            realFileName = `${p.id}.png`;
          }

          return {
            id: p.id,
            name: p.name,
            shotType: p.shotType,
            fileName: realFileName,
            lens: p.lens,
            targetUsage: p.targetUsage,
            url: `/character-references/${charId}/${outfitId}/${realFileName}`
          };
        })
      };
    })
  };
});

// 合并写入（不整库覆盖）：本脚本只重建菲伦/白夜子集，合并保留其余角色条目。
let existingView = {};
try { existingView = JSON.parse(fs.readFileSync(VIEW_JSON_FILE, 'utf8')); } catch {}
const mergedView = Object.assign(existingView, profilesMap);
fs.writeFileSync(VIEW_JSON_FILE, JSON.stringify(mergedView, null, 2), 'utf8');
console.log(`[OK] 菲伦与深森白夜的服装标准已合并写入 data/character-reference-view.json`);
