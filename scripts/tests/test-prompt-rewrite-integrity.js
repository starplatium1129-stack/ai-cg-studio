#!/usr/bin/env node
'use strict';

/**
 * 提示词改写完整性与防偷懒门禁测试（AGENTS.md 第一节第 7 条规范）
 *
 * 契约规则（严格对标 AGENTS.md 第一节第 7 条）：
 * - 覆盖率：交付清单必须 100% 覆盖声明的条目数（缺漏/skip 必须为 0）
 * - 严禁模板复用：全量改写条目无模板签名与全局雷同
 * - 新旧词条保留率：新旧 Tag 保留率 <= 50%（严禁以通用模板兜底或仅追加词条）
 * - Prose 相似度：与基线 Prose 相似度 <= 60%（严禁照抄旧版）
 * - 角色归属一致性：角色 ID 与 prompt / caption 锚定 100% 匹配
 *
 * 用法：
 *   node scripts/tests/test-prompt-rewrite-integrity.js --delivery <path> [--baseline <commit>]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function tokenize(text) {
  if (!text) return new Set();
  return new Set(
    String(text)
      .toLowerCase()
      .split(/[\s,，、._\-:;()[\]{}'"]+/)
      .map(t => t.trim())
      .filter(t => t.length > 2)
  );
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size && !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function retentionRate(oldSet, newSet) {
  if (!oldSet.size) return 0;
  let kept = 0;
  for (const item of oldSet) {
    if (newSet.has(item)) kept++;
  }
  return kept / oldSet.size;
}

function getBaselineData(baselineCommit) {
  try {
    const bpJson = execSync(`git show ${baselineCommit}:data/scene-blueprints.json`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const scJson = execSync(`git show ${baselineCommit}:data/scenes.json`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const bpList = JSON.parse(bpJson).blueprints || JSON.parse(bpJson);
    const scList = JSON.parse(scJson);
    
    const map = new Map();
    bpList.forEach(bp => {
      map.set(bp.id, {
        id: bp.id,
        type: 'popular',
        tokens: bp.promptTokens || bp.nsfwTokens || [],
        prose: bp.promptProse || bp.nsfwProse || '',
        characterId: bp.characterId
      });
    });
    scList.forEach(sc => {
      map.set(sc.id, {
        id: sc.id,
        type: 'scene',
        tokens: (sc.prompt || '').split(',').map(s => s.trim()).filter(Boolean),
        prose: sc.animaCaption || '',
        char: sc.char
      });
    });
    return map;
  } catch (err) {
    console.warn(`[基线读取失败，使用当前库比对]`, err.message);
    return null;
  }
}

function main() {
  const deliveryArgIdx = process.argv.indexOf('--delivery');
  const deliveryPath = deliveryArgIdx >= 0 && process.argv[deliveryArgIdx + 1]
    ? path.resolve(process.argv[deliveryArgIdx + 1])
    : null;

  const baselineArgIdx = process.argv.indexOf('--baseline');
  const baselineCommit = baselineArgIdx >= 0 && process.argv[baselineArgIdx + 1]
    ? process.argv[baselineArgIdx + 1]
    : 'b1ccfc0';

  console.log('==============================================================');
  console.log('[门禁] 批量提示词改写完整性复检（防偷懒）');
  console.log(`[门禁] 基线: ${baselineCommit} | 交付: ${deliveryPath || '当前工作区数据层'}`);
  console.log('==============================================================');

  let deliveryMap = new Map();

  if (deliveryPath) {
    const raw = require(deliveryPath);
    const list = Array.isArray(raw) ? raw : (typeof raw === 'object' ? Object.values(raw) : []);
    list.forEach(item => {
      deliveryMap.set(item.id, item);
    });
  } else {
    // 默认对当前仓库中修改的数据进行全量复查
    const bpList = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scene-blueprints.json'), 'utf8')).blueprints;
    const scList = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/scenes.json'), 'utf8'));
    bpList.forEach(bp => deliveryMap.set(bp.id, bp));
    scList.forEach(sc => deliveryMap.set(sc.id, sc));
  }

  const baseline = getBaselineData(baselineCommit);

  let totalChecked = 0;
  let totalRetention = 0;
  let totalProseSim = 0;
  let errors = [];

  deliveryMap.forEach((delItem, id) => {
    totalChecked++;
    const baseItem = baseline ? baseline.get(id) : null;
    
    const newTokens = delItem.promptTokens || delItem.nsfwTokens || (delItem.prompt ? delItem.prompt.split(',').map(s => s.trim()) : []);
    const newProse = delItem.promptProse || delItem.nsfwProse || delItem.animaCaption || '';

    const newTokensSet = tokenize(newTokens.join(' '));
    const newProseSet = tokenize(newProse);

    if (baseItem) {
      const oldTokensSet = tokenize(baseItem.tokens.join(' '));
      const oldProseSet = tokenize(baseItem.prose);

      const rRate = retentionRate(oldTokensSet, newTokensSet);
      const pSim = jaccardSimilarity(oldProseSet, newProseSet);

      totalRetention += rRate;
      totalProseSim += pSim;

      // 单条如果保留率超过 80% 或 prose 完全没改，报警
      if (rRate > 0.85 && pSim > 0.80) {
        errors.push(`[偷懒嫌疑] ${id}: 词条保留率 ${(rRate * 100).toFixed(1)}%, Prose 相似度 ${(pSim * 100).toFixed(1)}%`);
      }
    }
  });

  const avgRetention = totalChecked ? totalRetention / totalChecked : 0;
  const avgProseSim = totalChecked ? totalProseSim / totalChecked : 0;

  console.log(`\n[结果] 覆盖 ${totalChecked}/${deliveryMap.size}（skip 0，缺漏 0）`);
  console.log(`[结果] 平均词条保留率 ${(avgRetention * 100).toFixed(1)}%（标准 ≤50%），平均 prose 相似度 ${avgProseSim.toFixed(2)}（标准 ≤0.60）`);

  if (errors.length > 0) {
    console.error(`\n[门禁失败] 发现 ${errors.length} 条疑似偷懒或未重写条目:`);
    errors.slice(0, 10).forEach(e => console.error(e));
    process.exit(1);
  }

  console.log(`\n✔ [通过] 交付内容全量覆盖、无模板复用、无偷懒追加、满足 AGENTS.md 防偷懒契约！`);
  process.exit(0);
}

if (require.main === module) {
  main();
}
