const fs = require('fs');
const _path = require('path');
const { expandShardFiles } = require('../lib/scene-store');

const sceneAlign = JSON.parse(fs.readFileSync('runtime/human-audit-alignment-scenes.json', 'utf8'));
const failedSceneMap = new Map(sceneAlign.userFailed.map(u => [u.sceneId, u]));

console.log('Refining 157 failed scenes across scene shards...');

// 批次感知：按 manifest 分组展开为实际分片文件（含 base.N.json 批次）
const manifest = JSON.parse(fs.readFileSync('data/scenes/manifest.json', 'utf8'));
const shardFiles = [];
for (const entry of manifest.files) {
  shardFiles.push(...expandShardFiles(entry));
}

let totalRefined = 0;

shardFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  const list = JSON.parse(fs.readFileSync(file, 'utf8'));
  let fileRefined = 0;

  list.forEach(sc => {
    if (!failedSceneMap.has(sc.id)) return;

    let prompt = sc.prompt || '';
    let negative = sc.negative || '';
    let caption = sc.animaCaption || '';

    // 1. 丝袜防割裂与排除
    if (/pantyhose|tights|stockings|thighhighs/i.test(prompt) && !/fishnet/i.test(prompt)) {
      if (!negative.includes('fishnet')) {
        negative += ', fishnet, fishnets, fishnet_pantyhose, fishnet_stockings';
      }
    }

    // 2. 解剖与姿态强化
    const extraTokens = [];
    if (/bed|couch|sofa|futon|mattress|tatami/i.test(prompt)) {
      if (!prompt.includes('natural_gravity_body_deformation') && /nude|naked|r18/i.test(prompt)) {
        extraTokens.push('natural_gravity_body_deformation');
      }
      if (!prompt.includes('soft_mattress_indentation')) {
        extraTokens.push('soft_mattress_indentation');
      }
    }

    if (/bath|shower|water|spring|pool|rain|onsen/i.test(prompt)) {
      if (!prompt.includes('wet_skin')) extraTokens.push('wet_skin');
      if (!prompt.includes('wet_hair')) extraTokens.push('wet_hair');
      if (!prompt.includes('glistening_water_droplets')) extraTokens.push('glistening_water_droplets');
    }

    // 3. 空间与地表光影补充
    if (!prompt.includes('cinematic_depth') && !prompt.includes('extreme_depth')) {
      extraTokens.push('cinematic_depth');
    }
    if (!prompt.includes('floor_reflections') && /sunset|night|rain|floor|temple|street/i.test(prompt)) {
      extraTokens.push('floor_reflections');
    }

    if (extraTokens.length > 0) {
      prompt += ', ' + extraTokens.join(', ');
    }

    // 4. 自然语言英文 Prose 空间与材质润色
    if (caption && !caption.includes('tactile') && !caption.includes('ambient lighting')) {
      caption += ' The atmosphere is rendered with delicate ambient bounce lighting, grounded tactile textures, and layered visual depth.';
    }

    sc.prompt = prompt;
    sc.negative = negative;
    sc.animaCaption = caption;

    fileRefined++;
    totalRefined++;
  });

  if (fileRefined > 0) {
    fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n', 'utf8');
    console.log(`Updated ${fileRefined} scenes in ${file}`);
  }
});

console.log(`Successfully refined all ${totalRefined} scenes!`);
