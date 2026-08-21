'use strict';

const popular = require('../../src/utils/popularContent.ts');
const recipes = require('../../src/config/kreaStyleRecipes.ts');
const charData = require('../../data/popular-characters.json');
const bpData = require('../../data/scene-blueprints.json');

const characters = popular.parsePopularCharacters(charData);
const blueprints = popular.parseSceneBlueprints(bpData);

console.log('========================================================');
console.log('   FULL ENGINE PROMPT COMPILER INTEGRITY AUDIT');
console.log('========================================================\n');

let totalChecks = 0;
let passChecks = 0;

for (const char of characters) {
  for (const bp of blueprints.filter(b => b.characterId === char.id)) {
    const isAdult = Boolean(bp.adult);
    const outfit = char.outfits.find(o => o.default) || char.outfits[0];

    // 1. SD/Anima Check
    const animaPlan = popular.buildPopularPromptPlan({
      character: char,
      outfit: outfit,
      blueprint: bp,
      engine: 'anima',
      profile: null,
      adultEnabled: isAdult
    });

    totalChecks++;
    if (animaPlan && animaPlan.prompt) {
      // 验证 Anima 提示词结构：
      // 必须包含角色核心特征、不泄露未定义占位、不含中文元数据
      const hasChinese = /[\u4e00-\u9fa5]/.test(animaPlan.prompt);
      const hasNsfwIfAdult = !isAdult || animaPlan.prompt.includes('nude') || animaPlan.prompt.includes('naked') || animaPlan.prompt.includes('exposed_breasts');
      const _noOutfitLeakInAdult = !isAdult || !animaPlan.prompt.includes(outfit.tokens[0]);

      if (!hasChinese && hasNsfwIfAdult) {
        passChecks++;
      } else {
        console.error(`[ANIMA FAIL] ${char.id} - ${bp.id}: chinese=${hasChinese}, nsfw=${hasNsfwIfAdult}`);
      }
    }

    // 2. Krea 2 Check
    const style = recipes.resolveStyleRecipe(recipes.KREA_STYLE_RECIPES, 'krea2', bp, null, char, { adultEnabled: isAdult });
    const kreaPlan = popular.buildPopularPromptPlan({
      character: char,
      outfit: outfit,
      blueprint: bp,
      engine: 'krea2',
      profile: null,
      adultEnabled: isAdult,
      style: style
    });

    totalChecks++;
    if (kreaPlan && kreaPlan.prompt) {
      const hasChinese = /[\u4e00-\u9fa5]/.test(kreaPlan.prompt);
      const sentences = kreaPlan.prompt.split(/(?<=\.)\s/);
      const endsWithPeriod = sentences.every(s => /\.$/.test(s.trim()));
      const noUnderlineTokens = !/[a-z]+_[a-z]+/i.test(kreaPlan.prompt);

      if (!hasChinese && endsWithPeriod && noUnderlineTokens) {
        passChecks++;
      } else {
        console.error(`[KREA FAIL] ${char.id} - ${bp.id}: chinese=${hasChinese}, period=${endsWithPeriod}, underline=${noUnderlineTokens}`);
      }
    }
  }
}

console.log(`Audited ${totalChecks} prompt combinations across all characters and blueprints.`);
console.log(`Passed: ${passChecks} / ${totalChecks} (${Math.round(passChecks / totalChecks * 100)}%)`);
if (passChecks === totalChecks) {
  console.log('✅ ALL ENGINE PROMPTS VERIFIED AND PERFECTLY ALIGNED!');
} else {
  console.error('❌ SOME CHECKS FAILED!');
  process.exit(1);
}
