#!/usr/bin/env node
'use strict';

/**
 * 持续流水线式并行视觉审核与自愈闭环（Continuous Vision Auditor & Auto-Fix）
 * - 模型：Gemini 3.7 Flash（本地 CLIProxyAPI）
 * - 并发度：4 并发审查
 * - 机制：
 *   1. 持续扫描 assets/character-references/<charId>/<outfitId>/*.png
 *   2. 对未审核图片进行并行 4 视角八维红线审核
 *   3. 判定不通过时：自动调用 Anima 重新渲染并复审
 *   4. 结果实时记录至 runtime/multi-outfit-audit-report.json
 *   5. 当所有 708 张（177 套服装 × 4 视角）全部 PASS 时圆满退出
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const REPORT_FILE = path.join(ROOT, 'runtime', 'multi-outfit-audit-report.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const BASE = 'http://127.0.0.1:3000';
const AUDIT_CONCURRENCY = 4;

const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));

// 载入已有审核进度
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
    promptGuide: "此图是否为标准的角色【面部与微表情特写】（85mm浅景深胸部以上或头部特写）？画面中是否单人、五官清晰秀丽、无崩坏、无双人或分身、无漫画分格？",
    suffix: "face and eyes extreme close-up portrait, 85mm f/1.4 shallow depth of field, soft bokeh, expressive anime eyes, looking at viewer, subtle gentle expression, soft cinematic studio key light, highly detailed facial features and skin texture",
    negSuffix: "full body, upper body, hands, extra limbs, blurry face, bad eyes, lowres"
  },
  ref_02_half_medium: {
    promptGuide: "此图是否为标准的角色【3/4侧身半身定妆中景】（腰部至胸部服饰）？画面中是否单人、双手与服装层次清晰、无崩坏、无双人或分身？",
    suffix: "upper body focus, medium shot, waist up, cowboy shot, 3/4 view angle, hands visible resting naturally near waist, detailed outfit layers, fabric folds, cinematic soft studio lighting",
    negSuffix: "full body, legs, feet, shoes, boots, bad anatomy, bad hands, extra limbs, cropped shoulders, blurry"
  },
  ref_03_full_dynamic: {
    promptGuide: "此图是否为标准的角色【正面全身立姿】（从头顶到双脚鞋履完整可见、无截断）？画面中是否单人、正面朝向镜头、无双人分身、无背面？",
    suffix: "full body standing, entire figure visible from head to toe, front view, facing camera, looking at viewer, complete head, entire legs, full feet and shoes completely on the ground without cropping, clean studio floor shadow, balanced standing posture, full outfit details",
    negSuffix: "back view, from behind, rear view, cropped head, cropped feet, cut off feet, out of frame, bad proportions, distorted legs"
  },
  ref_04_back_rear: {
    promptGuide: "此图是否为标准的角色【45°侧后背影 / 回眸】（展现后背服饰或发型流向）？画面中是否单人、轮廓光清晰、无崩坏？",
    suffix: "45 degree angle from behind, looking back over shoulder toward camera, back view focus, back of hair, hair flow, rear outfit details, cinematic rim lighting, dramatic backlight, edge glow",
    negSuffix: "front view, facing camera, frontal face, bad anatomy, lowres"
  }
};

function runVisionInspect(imagePath, promptGuide) {
  return new Promise((resolve) => {
    const inspectScript = path.join(ROOT, 'scripts', 'maintenance', 'image-inspect.js');
    const promptText = `${promptGuide}\n\n请按以下格式回答：\n【审核结论】：通过 / 不通过\n【详细理由】：...`;
    
    execFile('node', [inspectScript, imagePath, '-p', promptText], { timeout: 60000 }, (error, stdout, stderr) => {
      const output = (stdout || '') + (stderr || '');
      // 防漏判策略：先判不通过，再判通过
      let passed = false;
      let reason = output.trim();
      
      const conclusionMatch = output.match(/【审核结论】[：:]\s*(通过|不通过)/);
      if (conclusionMatch) {
        if (conclusionMatch[1] === '通过') {
          passed = true;
        } else {
          passed = false;
        }
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

function buildPrompt(char, outfit, persId) {
  const pConfig = PERSPECTIVE_CONFIGS[persId];
  const charTokens = Array.isArray(char.identityTokens) ? char.identityTokens.join(', ') : char.id;
  const outfitTokens = Array.isArray(outfit.tokens) && outfit.tokens.length > 0 ? outfit.tokens.join(', ') : '';
  const outfitProse = outfit.prose || '';

  const promptParts = [
    charTokens,
    outfitTokens,
    outfitProse,
    pConfig.suffix,
    "@rella, masterpiece, best quality, pristine anime aesthetic, clean lighting"
  ].filter(Boolean);

  const negParts = [
    "bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature",
    pConfig.negSuffix
  ].filter(Boolean);

  return {
    prompt: promptParts.join(', '),
    negative: negParts.join(', ')
  };
}

async function renderImage(char, outfit, persId, targetPath) {
  const { prompt, negative } = buildPrompt(char, outfit, persId);
  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt,
    negative,
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 4.5,
    seed: Math.floor(Math.random() * 1000000000) + 100000000
  };

  const submitRes = await fetch(`${BASE}/api/anima/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const submitJson = await submitRes.json();
  if (!submitRes.ok || !submitJson.ok || !submitJson.job?.id) {
    throw new Error(`提交重绘失败: ${JSON.stringify(submitJson)}`);
  }

  const jobId = submitJson.job.id;
  const deadline = Date.now() + 10 * 60 * 1000;
  let jobState = null;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    const queryRes = await fetch(`${BASE}/api/anima/jobs/${encodeURIComponent(jobId)}`);
    const queryJson = await queryRes.json();
    if (queryRes.ok && queryJson.ok && queryJson.job) {
      jobState = queryJson.job;
      if (jobState.status === 'succeeded' && jobState.resultUrl) break;
      if (jobState.status === 'failed' || jobState.status === 'cancelled') {
        throw new Error(`重绘失败: ${jobState.error || jobState.status}`);
      }
    }
  }

  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(targetPath, buffer);
}

// 获取全部 708 项元数据
function getAllItems() {
  const items = [];
  for (const char of standards.characters) {
    for (const outfit of char.outfits) {
      for (const pers of standards.perspectives) {
        const key = `${char.id}/${outfit.id}/${pers.id}`;
        const targetPath = path.join(OUT_BASE, char.id, outfit.id, `${pers.id}.png`);
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
  console.log(`🔍 [审核] [${item.char.displayName}] - [${item.outfit.name}] - [${item.pers.name}]...`);
  
  let result = await runVisionInspect(item.targetPath, pConfig.promptGuide);
  if (result.passed) {
    console.log(`  ✓ 判定通过: ${item.key}`);
    auditReport[item.key] = { passed: true, verifiedAt: new Date().toISOString() };
    saveReport();
    return true;
  }

  console.log(`  ❌ 判定不通过: ${item.key} (${result.reason.slice(0, 80)}...)`);
  
  // 最多尝试 2 次自动强化重绘
  for (let retry = 1; retry <= 2; retry++) {
    console.log(`    ↳ 启动第 ${retry} 次 Anima 强化重绘修复视角...`);
    try {
      await renderImage(item.char, item.outfit, item.pers.id, item.targetPath);
      result = await runVisionInspect(item.targetPath, pConfig.promptGuide);
      if (result.passed) {
        console.log(`    ↳ 🎉 重绘复审判定通过: ${item.key}`);
        auditReport[item.key] = { passed: true, retries: retry, verifiedAt: new Date().toISOString() };
        saveReport();
        return true;
      }
    } catch (err) {
      console.warn(`    ↳ ⚠️ 重绘发生异常: ${err.message}`);
    }
  }

  // 记录未通过状态
  auditReport[item.key] = { passed: false, reason: result.reason, verifiedAt: new Date().toISOString() };
  saveReport();
  return false;
}

async function main() {
  const allItems = getAllItems();
  console.log(`[Continuous Auditor] 总需审核资产: ${allItems.length} 张`);

  let isAllDone = false;
  while (!isAllDone) {
    // 找出已落盘但尚未审核（或审核失败需要重试）的项
    const pendingItems = allItems.filter(item => {
      if (auditReport[item.key]?.passed) return false;
      if (!fs.existsSync(item.targetPath)) return false;
      const stat = fs.statSync(item.targetPath);
      return stat.size > 20000;
    });

    if (pendingItems.length === 0) {
      const passedCount = Object.values(auditReport).filter(r => r.passed).length;
      if (passedCount >= allItems.length) {
        console.log(`🎉 [Continuous Auditor] 全量 ${allItems.length} 张多服装 4 视角资产已 100% 全部审核通过！`);
        break;
      }
      // 等待出图生成新图片
      console.log(`[Continuous Auditor] 当前已通过: ${passedCount}/${allItems.length}，等待后续图片生成中 (10s)...`);
      await new Promise(r => setTimeout(r, 10000));
      continue;
    }

    console.log(`\n================================================`);
    console.log(`[Continuous Auditor] 发现 ${pendingItems.length} 张新生成图片，启动 ${AUDIT_CONCURRENCY} 并发视觉审核...`);
    console.log(`================================================\n`);

    // 4 并发池审查
    let cursor = 0;
    async function worker(workerId) {
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
