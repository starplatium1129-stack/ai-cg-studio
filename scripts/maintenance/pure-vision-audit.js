#!/usr/bin/env node
'use strict';

/**
 * 纯并行视觉审核器（Pure Vision Auditor）：
 * - 专注于对 assets/character-references 下已落盘的所有图片进行快速 4 并发审核
 * - 遇到不通过项：记录进 runtime/multi-outfit-audit-report.json，不阻塞其他图的审核
 * - 避免与正在出图的 pwsh-9 争抢 Anima 队列
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const REPORT_FILE = path.join(ROOT, 'runtime', 'multi-outfit-audit-report.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const AUDIT_CONCURRENCY = 4;

const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));

let auditReport = {};
if (fs.existsSync(REPORT_FILE)) {
  try {
    auditReport = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
  } catch (e) {
    auditReport = {};
  }
}

function saveReport() {
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(auditReport, null, 2), 'utf8');
}

const PERSPECTIVE_CONFIGS = {
  ref_01_face_closeup: {
    promptGuide: "此图是否为标准的角色【面部与微表情特写】（胸部以上或头部特写，85mm浅景深）？画面中是否单人、五官清晰、无崩坏、无双人或分身、无漫画分格？"
  },
  ref_02_half_medium: {
    promptGuide: "此图是否为标准的角色【3/4侧身半身定妆中景】（腰部至胸部服饰）？画面中是否单人、双手与服装层次清晰、无崩坏、无双人或分身？"
  },
  ref_03_full_dynamic: {
    promptGuide: "此图是否为标准的角色【正面全身立姿】（从头顶到双脚鞋履完整可见、无截断）？画面中是否单人、正面朝向镜头、无双人分身、无背面？"
  },
  ref_04_back_rear: {
    promptGuide: "此图是否为标准的角色【45°侧后背影 / 回眸】（展现后背服饰或发型流向）？画面中是否单人、轮廓光清晰、无崩坏？"
  }
};

function runVisionInspect(imagePath, promptGuide) {
  return new Promise((resolve) => {
    const inspectScript = path.join(ROOT, 'scripts', 'maintenance', 'image-inspect.js');
    const promptText = `${promptGuide}\n\n请按以下格式回答：\n【审核结论】：通过 / 不通过\n【详细理由】：...`;
    
    execFile('node', [inspectScript, imagePath, '-p', promptText], { timeout: 60000 }, (error, stdout, stderr) => {
      const output = (stdout || '') + (stderr || '');
      let passed = false;
      let reason = output.trim();
      
      const conclusionMatch = output.match(/【审核结论】[：:]\s*(通过|不通过)/);
      if (conclusionMatch) {
        passed = (conclusionMatch[1] === '通过');
      } else if (output.includes('不通过')) {
        passed = false;
      } else if (output.includes('通过')) {
        passed = true;
      }

      // 双人/分身/拼贴防漏审查
      if (passed && /(分身|双人|复制体|多格|分镜拼贴|并排两人)/.test(output) && !/(无分身|无双人|非双人|非分身)/.test(output)) {
        passed = false;
        reason += ' [触发分身/拼贴红线拦截]';
      }

      resolve({ passed, reason });
    });
  });
}

function findActualFile(dir, persId) {
  // 兼容两种磁盘命名：首批无前缀（ref_01_face_closeup.png）与
  // 今日带前缀（<charId>_<outfitId>_ref_01_face_closeup.png）。
  const plain = path.join(dir, `${persId}.png`);
  if (fs.existsSync(plain)) return plain;
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    const match = files.find(f => f.includes(persId) && f.endsWith('.png'));
    if (match) return path.join(dir, match);
  }
  return plain;
}

function getAllItems() {
  const items = [];
  for (const char of standards.characters) {
    for (const outfit of char.outfits) {
      for (const pers of standards.perspectives) {
        const key = `${char.id}/${outfit.id}/${pers.id}`;
        const targetPath = findActualFile(path.join(OUT_BASE, char.id, outfit.id), pers.id);
        items.push({
          key,
          char,
          outfit,
          pers,
          targetPath
        });
      }
    }
  }
  return items;
}

async function auditSingleItem(item) {
  const pConfig = PERSPECTIVE_CONFIGS[item.pers.id];
  const isNude = item.outfit.isNsfw;
  const guide = isNude 
    ? `${pConfig.promptGuide} 特别注意：此图为全裸形态，请确认画面为纯粹裸体，无浴袍、泳装或内衣遮挡。`
    : pConfig.promptGuide;

  console.log(`🔍 [审核] [${item.char.displayName}] - [${item.outfit.name}] - [${item.pers.name}]...`);
  
  const result = await runVisionInspect(item.targetPath, guide);
  if (result.passed) {
    console.log(`  ✓ 判定通过: ${item.key}`);
    auditReport[item.key] = { passed: true, verifiedAt: new Date().toISOString() };
  } else {
    console.log(`  ❌ 判定不通过: ${item.key}`);
    auditReport[item.key] = { passed: false, reason: result.reason.slice(0, 150), verifiedAt: new Date().toISOString() };
  }
  saveReport();
}

async function main() {
  const allItems = getAllItems();
  
  while (true) {
    // 找出磁盘上已有但尚未审核的项（2026-08-18 修复：已审过的条目无论 pass/fail 都跳过，
    // 避免 fail 条目被无限重审；重渲染后的图请先清除对应 report 记录再跑）。
    const pendingItems = allItems.filter(item => {
      if (auditReport[item.key]) return false;
      if (!fs.existsSync(item.targetPath)) return false;
      const stat = fs.statSync(item.targetPath);
      return stat.size > 20000;
    });

    if (pendingItems.length === 0) {
      const passedCount = Object.values(auditReport).filter(r => r.passed).length;
      console.log(`[Pure Auditor] 无待审核项。已审 ${Object.keys(auditReport).length}/${allItems.length}，通过 ${passedCount}。`);
      break;
    }

    console.log(`\n================================================`);
    console.log(`[Pure Auditor] 发现 ${pendingItems.length} 张待审核图片，启动 ${AUDIT_CONCURRENCY} 并发视觉审核...`);
    console.log(`================================================\n`);

    let cursor = 0;
    async function worker() {
      while (cursor < pendingItems.length) {
        const item = pendingItems[cursor++];
        await auditSingleItem(item);
      }
    }

    const workers = Array.from({ length: AUDIT_CONCURRENCY }, (_, i) => worker(i + 1));
    await Promise.all(workers);
    saveReport();
  }
}

main().catch(console.error);
