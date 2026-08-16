'use strict';

/* normalize-negative-tokens.js — 场景蓝图 negativeTokens 数据格式统一（一次性迁移 + 校验）。
 *
 * 背景（2026-08-15 审计）：data/scene-blueprints.json 的 negativeTokens 混有三种历史格式
 *   - 纯字符串：           "worst quality, low quality, ..."
 *   - 单元素数组内整段逗号串： ["worst quality, low quality, ..."]（162/336 蓝图）
 *   - 真数组：             ["worst quality", "low quality", ...]
 * 运行时解析器已兼容（popularContent.negativeStringList 数组分支 flatMap 按逗号切分），
 * 但数据自身不满足「数据格式一致性」规则：任何按元素消费（includes/去重/UI chips）的
 * 新消费方都会踩坑（2026-08-15 已吃过 stringList 静默丢词的亏）。
 * 本脚本把全部蓝图统一成真数组（每个元素一个负面词，保持原顺序与原词），
 * 并以「切分后 token 总数不变」做无损校验。
 *
 * 用法：
 *   node scripts/maintenance/normalize-negative-tokens.js          # dry-run 统计
 *   node scripts/maintenance/normalize-negative-tokens.js --write  # 落盘
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', '..', 'data', 'scene-blueprints.json');

/** 与 popularContent.negativeStringList 同一套切分规则（字符串/数组都按逗号切）。 */
function splitNegativeTokens(value) {
  if (Array.isArray(value)) {
    return value.flatMap(item => typeof item === 'string'
      ? item.split(',').map(segment => segment.trim()).filter(Boolean)
      : []);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function main() {
  const raw = fs.readFileSync(FILE, 'utf8');
  const data = JSON.parse(raw);
  const blueprints = Array.isArray(data.blueprints) ? data.blueprints : [];
  if (!blueprints.length) throw new Error('no blueprints array in ' + FILE);

  let changed = 0;
  let tokensBefore = 0;
  let tokensAfter = 0;
  const normalized = blueprints.map(bp => {
    const before = bp.negativeTokens;
    const tokens = splitNegativeTokens(before);
    tokensBefore += splitNegativeTokens(before).length;
    tokensAfter += tokens.length;
    if (JSON.stringify(before) !== JSON.stringify(tokens)) {
      changed += 1;
      return Object.assign({}, bp, { negativeTokens: tokens });
    }
    return bp;
  });

  if (tokensBefore !== tokensAfter) {
    throw new Error(`token count mismatch: before=${tokensBefore} after=${tokensAfter}`);
  }
  console.log(`blueprints: ${blueprints.length}, legacy-format entries: ${changed}, negative tokens total: ${tokensAfter}`);

  if (!process.argv.includes('--write')) {
    console.log('dry-run only: pass --write to persist');
    return;
  }
  fs.writeFileSync(FILE, JSON.stringify(Object.assign({}, data, { blueprints: normalized }), null, 2) + '\n', 'utf8');
  console.log('written: ' + FILE);
}

main();
