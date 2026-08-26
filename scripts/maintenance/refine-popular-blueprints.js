const fs = require('fs');
const _path = require('path');

const bpFile = 'data/scene-blueprints.json';
const bpData = JSON.parse(fs.readFileSync(bpFile, 'utf8'));
const blueprints = bpData.blueprints || bpData;

const popularAlign = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-popular.json', 'utf8'));
const failedBpMap = new Map(popularAlign.userFailed.map(u => [u.blueprint, u]));

console.log('Refining 174 popular blueprints with high artistic standards...');

let refinedCount = 0;

blueprints.forEach(bp => {
  if (!failedBpMap.has(bp.id)) return;
  const failInfo = failedBpMap.get(bp.id);
  const _char = failInfo.character;
  const adult = Boolean(bp.adult);

  // 1. 丝袜材质严格互斥与单选修正
  const promptTokensStr = (bp.promptTokens || []).join(' ');
  const nsfwTokensStr = (bp.nsfwTokens || []).join(' ');
  const allTokensStr = promptTokensStr + ' ' + nsfwTokensStr;

  bp.negativeTokens = bp.negativeTokens || [];
  if (typeof bp.negativeTokens === 'string') {
    bp.negativeTokens = bp.negativeTokens.split(',').map(s => s.trim()).filter(Boolean);
  }

  // 若存在 sheer / pantyhose / tights -> 绝对排死 fishnet
  if (/pantyhose|tights|stockings|thighhighs/i.test(allTokensStr) && !/fishnet/i.test(allTokensStr)) {
    if (!bp.negativeTokens.includes('fishnet')) bp.negativeTokens.push('fishnet', 'fishnets', 'fishnet_pantyhose', 'fishnet_stockings');
  }
  // 若指定了 fishnet -> 绝对排死 solid / sheer pantyhose
  if (/fishnet/i.test(allTokensStr)) {
    if (!bp.negativeTokens.includes('sheer_pantyhose')) bp.negativeTokens.push('sheer_pantyhose', 'translucent_tights', 'opaque_pantyhose');
  }

  // 2. 空间着陆与地表光影注入（消灭悬浮与死黑）
  const targetTokens = adult ? (bp.nsfwTokens || []) : (bp.promptTokens || []);

  // 注入通用高质量艺术与构图锚点
  const groundingTokens = [];
  const tokenSet = new Set(targetTokens);

  // 检查姿态：卧姿/床榻/沙发
  if (/bed|couch|sofa|futon|mattress|floor|ground|bath/i.test(allTokensStr)) {
    if (!tokenSet.has('natural_gravity_body_deformation') && adult) groundingTokens.push('natural_gravity_body_deformation');
    if (!tokenSet.has('soft_mattress_indentation') && /bed|couch|sofa|futon|mattress/i.test(allTokensStr)) groundingTokens.push('soft_mattress_indentation');
    if (!tokenSet.has('arched_back') && /bed|couch|sofa/i.test(allTokensStr) && adult) groundingTokens.push('arched_back');
  }

  // 检查水体/浴室/温泉/暴雨
  if (/bath|shower|water|spring|pool|rain|onsen/i.test(allTokensStr)) {
    if (!tokenSet.has('wet_skin')) groundingTokens.push('wet_skin');
    if (!tokenSet.has('wet_hair')) groundingTokens.push('wet_hair');
    if (!tokenSet.has('glistening_water_droplets')) groundingTokens.push('glistening_water_droplets');
    if (!tokenSet.has('translucent_water_ripples') && /bath|spring|pool|onsen/i.test(allTokensStr)) groundingTokens.push('translucent_water_ripples');
  }

  // 检查战斗/武器/持物
  if (/sword|katana|gun|staff|bow|spear|scythe|weapon/i.test(allTokensStr)) {
    if (!tokenSet.has('dynamic_fighting_stance') && !adult) groundingTokens.push('dynamic_fighting_stance');
    if (!tokenSet.has('atmospheric_depth')) groundingTokens.push('atmospheric_depth');
    if (!tokenSet.has('billowing_clothes')) groundingTokens.push('billowing_clothes');
  }

  // 普遍空间深度补全
  if (!tokenSet.has('cinematic_depth') && !tokenSet.has('depth_of_field')) {
    groundingTokens.push('cinematic_depth');
  }

  // 将新增强化词无缝合并
  groundingTokens.forEach(t => {
    if (!tokenSet.has(t)) targetTokens.push(t);
  });

  // 3. 增强自然语言英文 Prose 的空间透视与光影描述
  if (adult && bp.nsfwProse) {
    if (!bp.nsfwProse.includes('spatial depth') && !bp.nsfwProse.includes('cinematic atmosphere')) {
      bp.nsfwProse += ' The scene is captured with rich spatial depth, soft environmental bounce lighting, and realistic tactile details.';
    }
  } else if (bp.promptProse) {
    if (!bp.promptProse.includes('spatial depth') && !bp.promptProse.includes('cinematic atmosphere')) {
      bp.promptProse += ' The composition emphasizes cinematic perspective, delicate ambient lighting, and grounded environmental textures.';
    }
  }

  refinedCount++;
});

fs.writeFileSync(bpFile, JSON.stringify(bpData, null, 2) + '\n', 'utf8');
console.log(`Successfully refined all ${refinedCount} failed popular blueprints!`);
