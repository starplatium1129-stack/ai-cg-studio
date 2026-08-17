#!/usr/bin/env node
'use strict';

/**
 * 全量多服装形态 4 视角参考图视觉审核与自愈闭环脚本
 * - 视觉模型：Gemini 3.7 Flash
 * - 并发度：4 并发审查
 * - 规则：特写面部、半身中景、全身完整无裁切、侧后背影轮廓
 * - 自愈：未通过时自动触发 Anima 重绘并二次复审
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const BASE = 'http://127.0.0.1:3000';

const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));

// 收集所有已落盘的图片路径
function collectAllExistingImages() {
  const images = [];
  for (const char of standards.characters) {
    for (const outfit of char.outfits) {
      for (const pers of standards.perspectives) {
        const imgPath = path.join(OUT_BASE, char.id, outfit.id, `${pers.id}.png`);
        if (fs.existsSync(imgPath)) {
          images.push({
            charId: char.id,
            charName: char.displayName,
            outfitId: outfit.id,
            outfitName: outfit.name,
            persId: pers.id,
            persName: pers.name,
            imgPath
          });
        }
      }
    }
  }
  return images;
}

console.log(`[Audit Scanner] 当前已就绪图片总数: ${collectAllExistingImages().length}`);
