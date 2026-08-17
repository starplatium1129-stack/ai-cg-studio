#!/usr/bin/env node
'use strict';

/**
 * 将热门角色库 (data/popular-characters.json) 与主角库统一合并构建出
 * 全量的角色标准参考资产体系 (data/character-reference-standards.json)
 * 并同步更新前端运行时配置 (src/utils/characterReferenceData.ts)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const TS_DATA_FILE = path.join(ROOT, 'src', 'utils', 'characterReferenceData.ts');
const OUTPUT_BASE = path.join(ROOT, 'assets', 'character-references');

const PERSPECTIVES = [
  {
    id: "ref_01_face_closeup",
    name: "面部与微表情特写",
    shotType: "特写 · 85mm 浅景深",
    lens: "85mm f/1.4 Portrait Lens",
    cameraPrompt: "extreme close-up portrait, head and shoulders, 85mm lens, shallow depth of field, looking slightly off-camera with a nuanced focused gaze",
    lightingPrompt: "diffused soft studio lighting, subtle rim light on hair, catchlight in eyes, neutral clean solid background, sharp facial focus",
    negativePrompt: "extreme expression, distorted eyes, open mouth shouting, hands near face, complex background, text, watermark, split view",
    targetUsage: ["对白特写", "微表情", "情绪反应镜头", "台词对峙"]
  },
  {
    id: "ref_02_half_medium",
    name: "3/4侧身半身定妆",
    shotType: "半身 · 中景",
    lens: "50mm Medium Lens",
    cameraPrompt: "medium shot, upper body, 3/4 view angle, natural relaxed posture, hands visible resting naturally near waist",
    lightingPrompt: "cinematic soft studio lighting, accurate fabric textures and seams, clean minimalistic studio background, soft ambient occlusion",
    negativePrompt: "cropped shoulders, extra limbs, bad hands, chaotic props, blurry clothing details, split view",
    targetUsage: ["对话交互", "过肩推拉", "室内中景", "双人互动"]
  },
  {
    id: "ref_03_full_dynamic",
    name: "全身立姿动态",
    shotType: "全身 · 广角 50mm",
    lens: "50mm Wide Frame",
    cameraPrompt: "full body shot, standing from head to toe, wide 50mm framing, subtle dynamic stance with weight on one leg, complete footwear visible",
    lightingPrompt: "neutral seamless studio cyclorama, full body even lighting, accurate silhouette and height proportions, floor reflection",
    negativePrompt: "cropped feet, high-heels cut off, sitting, lying down, ground clutter, multiple people, split view",
    targetUsage: ["登场走入", "全景走位", "全身动作", "空间交代"]
  },
  {
    id: "ref_04_back_rear",
    name: "45°侧后背影",
    shotType: "侧后 · 轮廓光",
    lens: "85mm Cinematic Edge",
    cameraPrompt: "rear 3/4 back view, character looking slightly over shoulder towards the side, showing hair structure from behind and back outfit design",
    lightingPrompt: "soft backlighting, detailed hair structure, cape or mantle flow, clean neutral background, cinematic edge light",
    negativePrompt: "facing camera directly, frontal view, obscured hair, messy clothing folds, extra arms, split view",
    targetUsage: ["过肩反打", "转身离去", "背影叙事", "神秘氛围"]
  }
];

// 核心主角宁宁与夏目的专属定义
const HEROINE_CHARACTERS = [
  {
    id: "nene",
    displayName: "绫地宁宁",
    originalName: "Ayachi Nene",
    source: "YUZUSOFT《サノバウィッチ / 魔女的夜宴》",
    recommendedEngine: "anima-aesthetic-v1.1",
    engines: {
      sd: {
        model: "waiillustrioussdxlv170",
        lora: { name: "ayachi_nene_v18_wd14", weight: 0.85 }
      },
      anima: {
        model: "anima-aesthetic-v1.1",
        lora: { name: "ayachi_nene_v20_anima", loraId: "L_NENE_V20_ANIMA", weight: 0.85 }
      }
    },
    identity: {
      tokens: ["ayachi_nene", "1girl", "solo", "silver_hair", "long_hair", "low_twintails", "purple_eyes", "ahoge", "hair_ribbon", "pink_ribbon"],
      prose: "Ayachi Nene, a gentle and beautiful girl with long silver hair tied in elegant low twintails, an expressive ahoge, delicate pink hair ribbons, and deep violet eyes with a gentle subtle gaze"
    },
    defaultOutfit: {
      id: "official_witch",
      name: "魔女服（标准）",
      tokens: ["nene_witch_canonical", "witch_hat", "black_cape", "criss-cross_halter", "crop_top", "strap_between_breasts", "pink_bow", "black_skirt", "asymmetrical_legwear", "striped_thighhighs", "single_thighhigh", "frilled_socks", "midriff"],
      prose: "wearing her signature black witch outfit with a pointed witch hat, black cape, criss-cross halter crop top with pink bow, black pleated skirt, and asymmetrical striped thigh-highs"
    }
  },
  {
    id: "natsume",
    displayName: "四季夏目",
    originalName: "Shiki Natsume",
    source: "YUZUSOFT《喫茶ステラと死神の蝶 / 星光咖啡馆与死神之蝶》",
    recommendedEngine: "anima-aesthetic-v1.1",
    engines: {
      sd: {
        model: "waiillustrioussdxlv170",
        lora: { name: "shiki_natsume_v18_wd14", weight: 0.85 }
      },
      anima: {
        model: "anima-aesthetic-v1.1",
        lora: { name: "shiki_natsume_v20_anima", loraId: "L_NATSUME_V20_ANIMA", weight: 0.85 }
      }
    },
    identity: {
      tokens: ["shiki_natsume", "1girl", "solo", "black_hair", "long_hair", "amber_eyes", "yellow_eyes", "mole_under_eye", "mole_under_left_eye", "hairclip", "side_hairclip"],
      prose: "Shiki Natsume, a cool and refined young woman with silky long straight black hair, amber golden eyes, a subtle distinct mole under her left eye, side hairclip, and a calm reserved expression"
    },
    defaultOutfit: {
      id: "cafe_uniform",
      name: "Café Stella 制服（标准）",
      tokens: ["natsume_cafe_uniform", "cafe_uniform", "apron", "white_shirt", "collared_shirt", "necktie", "brown_skirt", "pleated_skirt", "black_thighhighs"],
      prose: "wearing the elegant Café Stella uniform with a crisp collared white shirt, neat necktie, dark work apron, tailored brown pleated skirt, and black thigh-highs"
    }
  }
];

function buildAllStandards() {
  const popularRaw = JSON.parse(fs.readFileSync(POPULAR_FILE, 'utf8'));
  const allCharacters = [...HEROINE_CHARACTERS];

  for (const p of popularRaw.characters || []) {
    const defaultOutfit = (p.outfits || []).find(o => o.default) || p.outfits?.[0] || {
      id: "default",
      name: "标准服饰",
      tokens: [],
      prose: ""
    };

    allCharacters.push({
      id: p.id,
      displayName: p.displayName,
      originalName: p.originalName,
      source: p.franchise,
      recommendedEngine: p.recommendedEngine || "anima-aesthetic-v1.1",
      engines: {
        anima: {
          model: p.recommendedEngine || "anima-aesthetic-v1.1"
        }
      },
      identity: {
        tokens: p.identityTokens || [],
        prose: p.identityProse || `${p.displayName} from ${p.franchise}`
      },
      defaultOutfit: {
        id: defaultOutfit.id,
        name: defaultOutfit.name || "标准服饰",
        tokens: defaultOutfit.tokens || [],
        prose: defaultOutfit.prose || ""
      }
    });
  }

  const standardsData = {
    version: 1,
    schema: "character-reference-standards-v1",
    description: "全量角色短剧标准 4 视角参考资产库规范",
    perspectives: PERSPECTIVES,
    characters: allCharacters
  };

  fs.writeFileSync(STANDARDS_FILE, JSON.stringify(standardsData, null, 2) + '\n', 'utf8');
  console.log(`[Sync] 已更新 ${STANDARDS_FILE}，共纳入 ${allCharacters.length} 位角色的标准参考定义。`);

  // 生成 TS 运行时数据
  const tsRecord = {};
  for (const c of allCharacters) {
    tsRecord[c.id] = {
      characterId: c.id,
      displayName: c.displayName,
      source: c.source,
      activeOutfit: c.defaultOutfit?.name || '标准装扮',
      identityProse: c.identity.prose,
      references: PERSPECTIVES.map(p => ({
        id: p.id,
        name: p.name,
        shotType: p.shotType,
        fileName: `${p.id}.png`,
        lens: p.lens,
        description: `锁死 ${c.displayName} 的${p.name.replace('与微表情', '')}基准特征。`,
        targetUsage: p.targetUsage
      }))
    };
  }

  const tsContent = `export interface CharacterReferenceItem {
  id: string
  name: string
  shotType: string
  fileName: string
  lens: string
  description: string
  targetUsage: string[]
}

export interface CharacterReferenceProfile {
  characterId: string
  displayName: string
  source: string
  activeOutfit: string
  identityProse: string
  references: CharacterReferenceItem[]
}

export const CHARACTER_REFERENCE_STANDARDS: Record<string, CharacterReferenceProfile> = ${JSON.stringify(tsRecord, null, 2)}

export function getCharacterReferences(characterId: string): CharacterReferenceProfile | undefined {
  return CHARACTER_REFERENCE_STANDARDS[characterId]
}
`;

  fs.writeFileSync(TS_DATA_FILE, tsContent, 'utf8');
  console.log(`[Sync] 已同步生成前端运行时数据: ${TS_DATA_FILE}`);

  // 自动为所有角色创建资产目录与 reference-meta.json 骨架
  for (const c of allCharacters) {
    const charDir = path.join(OUTPUT_BASE, c.id);
    fs.mkdirSync(charDir, { recursive: true });
    const metaFile = path.join(charDir, 'reference-meta.json');
    if (!fs.existsSync(metaFile)) {
      const meta = {
        characterId: c.id,
        displayName: c.displayName,
        originalName: c.originalName,
        source: c.source,
        recommendedEngine: c.recommendedEngine,
        activeOutfit: c.defaultOutfit.name,
        generatedAt: new Date().toISOString(),
        references: PERSPECTIVES.map(p => ({
          id: p.id,
          name: p.name,
          shotType: p.shotType,
          targetUsage: p.targetUsage,
          file: `${p.id}.png`
        }))
      };
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n', 'utf8');
    }
  }
}

buildAllStandards();
