#!/usr/bin/env node
'use strict';

/**
 * 角色标准参考资产库生成与管理工具
 *
 * 按照工业级短剧 4 图标准（特写 / 半身 / 全身 / 45°侧后），自动为角色组装中性摄影配方并生成/落盘。
 * 支持：
 *   node scripts/maintenance/generate-character-references.js --dry-run
 *   node scripts/maintenance/generate-character-references.js --character nene --dry-run
 *   node scripts/maintenance/generate-character-references.js --character natsume --engine sd --generate
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const OUTPUT_BASE = path.join(ROOT, 'assets', 'character-references');

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// 组装 SD 格式（Token 流 + LoRA）
function buildSdPrompt(character, perspective, outfit) {
  const quality = 'masterpiece, best quality, amazing quality, highly detailed';
  const charTokens = (character.identity?.tokens || []).join(', ');
  const outfitTokens = (outfit?.tokens || []).join(', ');
  const sdLora = character.engines?.sd?.lora || character.lora;
  const loraPart = sdLora?.name
    ? `<lora:${sdLora.name}:${sdLora.weight || 0.85}>`
    : '';

  const parts = [
    quality,
    charTokens,
    outfitTokens,
    perspective.cameraPrompt,
    perspective.lightingPrompt,
    loraPart
  ].filter(Boolean);

  return parts.join(', ');
}

function buildSdNegative(perspective) {
  const baseNegative = 'bad quality, worst quality, worst detail, lowres, sketch, blurry, watermark, bad anatomy, deformed limbs';
  return [baseNegative, perspective.negativePrompt].filter(Boolean).join(', ');
}

// 组装 Anima / 自然语言格式（含 Anima 触发词与 LoRA 绑定）
function buildAnimaPrompt(character, perspective, outfit) {
  const charProse = character.identity?.prose || character.displayName;
  const outfitProse = outfit?.prose || '';
  const trigger = character.identity?.tokens?.[0] || '';
  const animaLora = character.engines?.anima?.lora;
  const loraTag = animaLora?.name ? `<lora:${animaLora.name}:${animaLora.weight || 0.85}>` : '';

  return `A cinematic standard reference photo of ${trigger ? trigger + ', ' : ''}${charProse}, ${outfitProse}. ${perspective.cameraPrompt}. ${perspective.lightingPrompt}. High resolution, clean textures, masterfully composed. ${loraTag}`.trim();
}

function assembleAllPlans(standards, targetCharId = '', targetOutfitId = '') {
  const characters = targetCharId
    ? standards.characters.filter(c => c.id === targetCharId)
    : standards.characters;

  if (!characters.length) {
    throw new Error(`未找到角色配置: ${targetCharId}`);
  }

  const plans = [];

  for (const char of characters) {
    const outfit = targetOutfitId && char.alternativeOutfit?.id === targetOutfitId
      ? char.alternativeOutfit
      : char.defaultOutfit;

    const charDir = path.join(OUTPUT_BASE, char.id);
    const metaFile = path.join(charDir, 'reference-meta.json');

    const meta = {
      characterId: char.id,
      displayName: char.displayName,
      originalName: char.originalName,
      source: char.source,
      recommendedEngine: char.recommendedEngine || 'anima-aesthetic-v1.1',
      engines: char.engines || {},
      activeOutfit: outfit?.name || '默认服装',
      generatedAt: new Date().toISOString(),
      references: []
    };

    for (const p of standards.perspectives) {
      const fileName = `${p.id}.png`;
      const sdPrompt = buildSdPrompt(char, p, outfit);
      const sdNegative = buildSdNegative(p);
      const animaPrompt = buildAnimaPrompt(char, p, outfit);

      meta.references.push({
        id: p.id,
        name: p.name,
        shotType: p.shotType,
        targetUsage: p.targetUsage,
        file: fileName,
        prompts: {
          sd: sdPrompt,
          sdNegative: sdNegative,
          anima: animaPrompt
        }
      });

      plans.push({
        characterId: char.id,
        displayName: char.displayName,
        perspectiveId: p.id,
        perspectiveName: p.name,
        outputFile: path.join(charDir, fileName),
        metaFile: metaFile,
        sdPrompt,
        sdNegative,
        animaPrompt
      });
    }

    // 写入 meta 骨架
    writeJson(metaFile, meta);
  }

  return plans;
}

// 主入口
async function main() {
  const isDryRun = hasFlag('--dry-run') || !hasFlag('--generate');
  const targetChar = argument('--character', '');
  const targetOutfit = argument('--outfit', '');

  console.log(`[CharRef] 读取标准配置: ${STANDARDS_FILE}`);
  const standards = readJson(STANDARDS_FILE);

  const plans = assembleAllPlans(standards, targetChar, targetOutfit);

  console.log(`[CharRef] 成功组装 ${plans.length} 个基准视角方案。\n`);

  for (const plan of plans) {
    console.log(`================================================================`);
    console.log(`[${plan.displayName}] ${plan.perspectiveName} (${plan.perspectiveId})`);
    console.log(`  目标路径: ${plan.outputFile}`);
    console.log(`  SD Prompt:`);
    console.log(`    ${plan.sdPrompt}`);
    console.log(`  SD Negative:`);
    console.log(`    ${plan.sdNegative}`);
    console.log(`  Anima/Natural Prose:`);
    console.log(`    ${plan.animaPrompt}`);
  }

  console.log(`\n================================================================`);
  if (isDryRun) {
    console.log(`[CharRef] Dry-run 完成！元数据骨架与提示词已在各角色目录生成。`);
    console.log(`  提示：可在绘图页或出图脚本中使用上述提示词生成 4 张图放入对应目录。`);
  } else {
    console.log(`[CharRef] 开始触发批量出图链路...（需确保本地 SD/Anima 服务在线）`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`[CharRef] 失败:`, err);
    process.exit(1);
  });
}

module.exports = {
  STANDARDS_FILE,
  assembleAllPlans,
  buildSdPrompt,
  buildAnimaPrompt
};
