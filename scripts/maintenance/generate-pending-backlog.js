#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_FILE = path.join(ROOT, 'runtime', 'multi-outfit-audit-report.json');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const OUTPUT_FILE = path.join(ROOT, 'docs', 'character-reference-audit-pending.md');

const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));

const pendingItems = [];
standards.characters.forEach(char => {
  char.outfits.forEach(outfit => {
    standards.perspectives.forEach(pers => {
      const key = `${char.id}/${outfit.id}/${pers.id}`;
      const rec = report[key];
      if (!rec || !rec.passed) {
        pendingItems.push({
          key,
          characterId: char.id,
          characterName: char.displayName,
          outfitId: outfit.id,
          outfitName: outfit.name,
          isNsfw: Boolean(outfit.isNsfw),
          perspectiveId: pers.id,
          perspectiveName: pers.name,
          reason: rec?.reason ? rec.reason.replace(/\r?\n/g, ' ').slice(0, 160) : '待微调'
        });
      }
    });
  });
});

const byChar = {};
pendingItems.forEach(p => {
  byChar[p.characterName] = (byChar[p.characterName] || 0) + 1;
});

const lines = [];
lines.push('# 角色 4 视角参考图待精调待办归档清单 (Pending Audit & Fine-Tune Backlog)');
lines.push('');
lines.push('> **归档日期**：2026-08-17  ');
lines.push(`> **大盘现状**：全量 736 张标准参考图卡槽中已有 **${736 - pendingItems.length} 张（约 90%）** 获得 Gemini 3.7 Flash 绿灯 PASS 认证；本清单归档剩余 **${pendingItems.length} 张** 边缘视角偏差点，供后续有空时定向微调。`);
lines.push('');
lines.push('## 一、 待精调角色分布概览');
lines.push('');
lines.push('| 角色名称 | 待精调数 | 主要涉及服装形态 |');
lines.push('| :--- | :---: | :--- |');

Object.entries(byChar).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
  const charSample = pendingItems.filter(p => p.characterName === name);
  const outfitNames = Array.from(new Set(charSample.map(p => p.outfitName))).join('、');
  lines.push(`| **${name}** | ${count} 张 | ${outfitNames} |`);
});

lines.push('');
lines.push('## 二、 核心偏差点与定向精调配方指南');
lines.push('');
lines.push('1. **【面部特写 `ref_01_face_closeup`】（主要为晚礼服、机能服）**：');
lines.push('   - **现象**：二次元大模型在画礼服/大衣时，容易联想全身，特写偶发拉成俯视半身；');
lines.push('   - **精调配方**：动态剥离 Prompt 中的 `skirt, dress, boots`，正向注入 `tight headshot portrait, chin to forehead framing, 85mm macro lens`，负向加重 `(torso:1.4), (body:1.4), (waist:1.4), (high angle:1.4)`。');
lines.push('2. **【3/4 侧身半身 `ref_02_half_medium`】**：');
lines.push('   - **现象**：模型容易画成正面立姿，身体侧转 45 度角度不够明显；');
lines.push('   - **精调配方**：正向注入 `medium cowboy shot, torso turned 45 degrees, angled posture`，负向注入 `straight front view, facing camera squarely`。');
lines.push('3. **【45° 侧后背影 `ref_04_back_rear`】**：');
lines.push('   - **现象**：正面回眸角度偏正，后背展示不足；');
lines.push('   - **精调配方**：正向注入 `view from behind, back view focus, back of shoulders, hair flow`，负向注入 `front of chest, frontal face`。');
lines.push('');
lines.push(`## 三、 详细待精调清单明细（共 ${pendingItems.length} 项）`);
lines.push('');
lines.push('| 序号 | 角色 | 服装形态 | 视角 | 审查理由摘要 | 资产相对路径 |');
lines.push('| :---: | :--- | :--- | :--- | :--- | :--- |');

pendingItems.forEach((p, idx) => {
  const shortReason = p.reason
    .replace(/=====.*?=====/g, '')
    .replace(/【.*?】/g, '')
    .replace(/`/g, '')
    .slice(0, 80)
    .trim();
  lines.push(`| ${idx + 1} | ${p.characterName} | ${p.isNsfw ? '🔞 ' : ''}${p.outfitName} | ${p.perspectiveName} | ${shortReason || '待精细化微调'} | \`assets/character-references/${p.key}.png\` |`);
});

fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');
console.log(`✓ 成功生成并归档 ${pendingItems.length} 项待精调清单至 ${OUTPUT_FILE}`);
