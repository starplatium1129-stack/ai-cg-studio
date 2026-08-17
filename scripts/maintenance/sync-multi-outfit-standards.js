#!/usr/bin/env node
'use strict';

/**
 * 构建「多角色 × 多服装/形态 (Multi-Outfit & Full Nude NSFW Form)」4 视角标准参考资产体系
 * 
 * 规范：
 * 每个角色均包含：
 * 1. 调研的常规服装（校服、日常、礼服、战衣等）
 * 2. 🔞 纯粹全裸形态 (Full Nude / Uncensored Body Form)：用于锁死纯粹身体、肤质、胸腰比例与成人短剧基准
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const TS_DATA_FILE = path.join(ROOT, 'src', 'utils', 'characterReferenceData.ts');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');

const PERSPECTIVES = [
  {
    id: "ref_01_face_closeup",
    name: "面部特写",
    shotType: "特写 · 85mm 浅景深",
    lens: "85mm f/1.4 Portrait Lens",
    targetUsage: ["对白特写", "微表情", "情绪反应镜头", "台词对峙"]
  },
  {
    id: "ref_02_half_medium",
    name: "3/4半身定妆",
    shotType: "半身 · 中景",
    lens: "50mm Medium Lens",
    targetUsage: ["对话交互", "过肩推拉", "室内中景", "双人互动"]
  },
  {
    id: "ref_03_full_dynamic",
    name: "正面全身立姿",
    shotType: "全身 · 广角 50mm",
    lens: "50mm Wide Frame",
    targetUsage: ["登场走入", "全景走位", "全身动作", "空间交代"]
  },
  {
    id: "ref_04_back_rear",
    name: "45°侧后背影",
    shotType: "侧后 · 轮廓光",
    lens: "85mm Cinematic Edge",
    targetUsage: ["过肩反打", "转身离去", "背影叙事", "神秘氛围"]
  }
];

// 核心主角专属服装形态
const HEROINE_CHARACTERS = [
  {
    id: "nene",
    displayName: "绫地宁宁",
    originalName: "Ayachi Nene",
    source: "YUZUSOFT《サノバウィッチ》",
    identityProse: "Ayachi Nene, a gentle and beautiful girl with long silver hair tied in elegant low twintails, an expressive ahoge, delicate pink hair ribbons, deep violet eyes",
    identityTokens: ["ayachi_nene", "1girl", "solo", "silver_hair", "long_hair", "low_twintails", "purple_eyes", "ahoge", "hair_ribbon", "pink_ribbon"],
    outfits: [
      {
        id: "witch_canonical",
        name: "经典魔女服",
        isDefault: true,
        prose: "wearing her signature black witch outfit with a pointed witch hat, black cape, criss-cross halter crop top with pink bow, black pleated skirt, and asymmetrical striped thigh-highs",
        tokens: ["nene_witch_canonical", "witch_hat", "black_cape", "criss-cross_halter", "crop_top", "strap_between_breasts", "pink_bow", "black_skirt", "asymmetrical_legwear", "striped_thighhighs"]
      },
      {
        id: "school_uniform",
        name: "学院校服",
        prose: "wearing her neat high school uniform with white collared shirt, navy blazer, school tie, and pleated navy skirt with black knee socks",
        tokens: ["school_uniform", "blazer", "white_shirt", "collared_shirt", "necktie", "pleated_skirt", "knee_socks"]
      },
      {
        id: "casual_summer",
        name: "日常夏装",
        prose: "wearing a comfortable casual light pastel summer dress with delicate floral accents and white flat shoes",
        tokens: ["casual", "summer_dress", "sundress", "flat_shoes"]
      },
      {
        id: "nsfw_nude",
        name: "私密全裸 / 纯粹形态",
        isNsfw: true,
        prose: "completely naked, full nudity, bare skin, natural female body, medium breasts, pink nipples, slender waist, navel, bare legs and bare feet, intimate soft bedroom lighting",
        tokens: ["nude", "completely_naked", "uncensored", "breasts", "nipples", "navel", "bare_shoulders", "collarbone", "bare_legs", "bare_feet"]
      }
    ]
  },
  {
    id: "natsume",
    displayName: "四季夏目",
    originalName: "Shiki Natsume",
    source: "YUZUSOFT《喫茶ステラと死神の蝶》",
    identityProse: "Shiki Natsume, a cool and refined young woman with silky long straight black hair, amber golden eyes, a subtle distinct mole under her left eye, side hairclip",
    identityTokens: ["shiki_natsume", "1girl", "solo", "black_hair", "long_hair", "amber_eyes", "mole_under_eye", "mole_under_left_eye", "hairclip", "side_hairclip"],
    outfits: [
      {
        id: "cafe_uniform",
        name: "Café Stella 制服",
        isDefault: true,
        prose: "wearing the elegant Café Stella uniform with a crisp collared white shirt, neat necktie, dark work apron, tailored brown pleated skirt, and black thigh-highs",
        tokens: ["natsume_cafe_uniform", "cafe_uniform", "apron", "white_shirt", "collared_shirt", "necktie", "brown_skirt", "pleated_skirt", "black_thighhighs"]
      },
      {
        id: "casual_knit",
        name: "秋冬针织私服",
        prose: "wearing a cozy oversized knit beige sweater, dark mini skirt, warm woolen scarf, and black tights",
        tokens: ["casual", "sweater", "knit_sweater", "scarf", "black_tights", "mini_skirt"]
      },
      {
        id: "nsfw_nude",
        name: "私密全裸 / 纯粹形态",
        isNsfw: true,
        prose: "completely naked, full nudity, bare skin, natural slender female body, delicate small breasts, pink nipples, mole under eye visible, slender waist, navel, bare legs, soft warm ambient lighting",
        tokens: ["nude", "completely_naked", "uncensored", "small_breasts", "breasts", "nipples", "navel", "bare_shoulders", "collarbone", "bare_legs", "bare_feet"]
      }
    ]
  }
];

function buildMultiOutfitMatrix() {
  const popularRaw = JSON.parse(fs.readFileSync(POPULAR_FILE, 'utf8'));
  const allCharacters = [...HEROINE_CHARACTERS];

  for (const p of popularRaw.characters || []) {
    const rawOutfits = p.outfits || [];
    const formattedOutfits = rawOutfits.map((o, idx) => ({
      id: o.id,
      name: o.name,
      isDefault: o.default || idx === 0,
      prose: o.prose || '',
      tokens: o.tokens || [],
      isNsfw: Boolean(o.name.includes('私密') || o.name.includes('泳装') || o.name.includes('浴') || o.id.includes('nsfw') || o.name.includes('裸'))
    }));

    // 为每个热门角色增加标准的「私密全裸 / 纯粹形态」
    formattedOutfits.push({
      id: "nsfw_nude",
      name: "私密全裸 / 纯粹形态",
      isDefault: false,
      isNsfw: true,
      prose: `completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting`,
      tokens: ["nude", "completely_naked", "uncensored", "breasts", "nipples", "navel", "bare_shoulders", "collarbone", "bare_legs", "bare_feet"]
    });

    allCharacters.push({
      id: p.id,
      displayName: p.displayName,
      originalName: p.originalName,
      source: p.franchise,
      identityProse: p.identityProse,
      identityTokens: p.identityTokens || [],
      outfits: formattedOutfits
    });
  }

  // 写入 JSON 规范
  const standardsData = {
    version: 2,
    schema: "character-reference-standards-v2",
    description: "角色 × 多服装形态（含全裸私密形态）短剧 4 视角标准参考资产库",
    perspectives: PERSPECTIVES,
    characters: allCharacters
  };
  fs.writeFileSync(STANDARDS_FILE, JSON.stringify(standardsData, null, 2) + '\n', 'utf8');

  // 构建 TS 运行时契约
  const tsRecord = {};
  for (const c of allCharacters) {
    tsRecord[c.id] = {
      characterId: c.id,
      displayName: c.displayName,
      source: c.source,
      identityProse: c.identityProse,
      outfits: c.outfits.map(o => {
        const outfitDir = path.join(OUT_BASE, c.id, o.id);
        const hasCustomDir = fs.existsSync(outfitDir);
        return {
          outfitId: o.id,
          outfitName: o.name,
          isDefault: Boolean(o.isDefault),
          isNsfw: Boolean(o.isNsfw),
          prose: o.prose,
          references: PERSPECTIVES.map(p => ({
            id: p.id,
            name: p.name,
            shotType: p.shotType,
            lens: p.lens,
            targetUsage: p.targetUsage,
            fileName: `${p.id}.png`,
            url: hasCustomDir
              ? `/assets/character-references/${c.id}/${o.id}/${p.id}.png`
              : `/assets/character-references/${c.id}/${p.id}.png`
          }))
        };
      })
    };
  }

  const tsContent = `export interface CharacterReferenceItem {
  id: string
  name: string
  shotType: string
  fileName: string
  lens: string
  targetUsage: string[]
  url: string
}

export interface CharacterOutfitReference {
  outfitId: string
  outfitName: string
  isDefault: boolean
  isNsfw: boolean
  prose: string
  references: CharacterReferenceItem[]
}

export interface CharacterReferenceProfile {
  characterId: string
  displayName: string
  source: string
  identityProse: string
  outfits: CharacterOutfitReference[]
}

export const CHARACTER_REFERENCE_STANDARDS: Record<string, CharacterReferenceProfile> = ${JSON.stringify(tsRecord, null, 2)}

export function getCharacterReferences(characterId: string): CharacterReferenceProfile | undefined {
  return CHARACTER_REFERENCE_STANDARDS[characterId]
}
`;

  fs.writeFileSync(TS_DATA_FILE, tsContent, 'utf8');
  console.log(`[Full Nude Matrix Sync] 成功同步 35 位角色的完整服装与全裸私密形态数据！`);
}

buildMultiOutfitMatrix();
