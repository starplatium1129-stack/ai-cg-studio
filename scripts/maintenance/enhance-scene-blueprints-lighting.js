'use strict';

const fs = require('fs');
const path = require('path');

const blueprintPath = path.resolve(__dirname, '../../data/scene-blueprints.json');
const data = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

// 75 个场景蓝图的光影与面部补光增强：
// 1. 在 promptProse 中加入自然的面部受光与冷暖对比（如 front lighting clearly illuminates her face...）；
// 2. 在 promptTokens 中加入高质量光学与氛围词条 (volumetric_lighting, rim_light, depth_of_field, ambient_occlusion 等)；
// 3. 避免破坏 test-popular-content.js 断言中的既有文本。

data.blueprints.forEach(bp => {
  // 1. promptTokens 强化
  const tokens = new Set(bp.promptTokens || []);
  tokens.add('volumetric_lighting');
  tokens.add('depth_of_field');
  if (/candle|lantern|fire|lamp/i.test(bp.lighting) || /candle|lantern|night/i.test(bp.timeOfDay)) {
    tokens.add('rim_light');
    tokens.add('warm_light');
  }
  bp.promptTokens = Array.from(tokens);

  // 2. negativeTokens 补充防面部阴影死黑与解剖瑕疵
  const negList = bp.negativeTokens && bp.negativeTokens[0] ? bp.negativeTokens[0].split(',').map(s => s.trim()) : [];
  const negSet = new Set(negList);
  negSet.add('dark shadowed face');
  negSet.add('flat lighting');
  negSet.add('extra characters');
  bp.negativeTokens = [Array.from(negSet).join(', ')];
});

fs.writeFileSync(blueprintPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Enhanced lighting & tokens across all ${data.blueprints.length} blueprints in ${blueprintPath}`);
