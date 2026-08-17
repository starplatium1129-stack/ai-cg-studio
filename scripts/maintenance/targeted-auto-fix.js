#!/usr/bin/env node
'use strict';

/**
 * 专项定向自愈修图器（Targeted Auto-Fix & Re-Audit Engine）：
 * - 针对 multi-outfit-audit-report.json 中被红灯标记的 158 项
 * - 提取其具体不通过理由（如“视角变成了全身”、“景别不够近”等）
 * - 定向强化 Prompt 与视角负面清单，使用 Anima 重新渲染
 * - 渲染后立即调用 Gemini 3.7 Flash 视觉复审，直至全部变为 PASS
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const REPORT_FILE = path.join(ROOT, 'runtime', 'multi-outfit-audit-report.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const BASE = 'http://127.0.0.1:3000';

const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));
let auditReport = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));

function saveReport() {
  fs.writeFileSync(REPORT_FILE, JSON.stringify(auditReport, null, 2), 'utf8');
}

const PERSPECTIVE_CONFIGS = {
  ref_01_face_closeup: {
    guide: "此图是否为标准的角色【面部与微表情特写】（平视或微俯视，胸部以上或头部特写，85mm浅景深）？画面中是否单人、五官清晰、无崩坏、无双人或分身、无漫画分格？",
    suffix: "eye-level straight-on portrait, close-up face shot, head and shoulders portrait, 85mm f/1.4 lens, shallow depth of field, looking straight at viewer, calm expressive anime eyes, detailed skin and hair texture, cinematic soft portrait studio lighting",
    negative: "bird's eye view, extreme high angle, top-down view, foreshortening, full body, lower body, legs, feet, shoes, wide shot, distant shot, out of frame"
  },
  ref_02_half_medium: {
    guide: "此图是否为标准的角色【3/4侧身半身定妆中景】（腰部至胸部服饰）？画面中是否单人、双手与服装层次清晰、无崩坏、无双人或分身？",
    suffix: "medium shot, waist up, cowboy shot, 3/4 view angle, hands visible resting naturally near waist, detailed outfit layers, fabric folds, cinematic studio lighting",
    negative: "full body, legs, feet, shoes, boots, extreme closeup, face only, cropped shoulders"
  },
  ref_03_full_dynamic: {
    guide: "此图是否为标准的角色【正面全身立姿】（从头顶到双脚鞋履完整可见、无截断）？画面中是否单人、正面朝向镜头、无双人分身、无背面？",
    suffix: "full body standing, entire figure visible from head to toe, front view, facing camera, looking at viewer, complete head, entire legs, full feet and shoes completely on the ground without cropping, clean studio floor shadow, balanced standing posture",
    negative: "back view, from behind, rear view, cropped head, cropped feet, cut off feet, out of frame, bad proportions"
  },
  ref_04_back_rear: {
    guide: "此图是否为标准的角色【45°侧后背影 / 回眸】（展现后背服饰或发型流向）？画面中是否单人、轮廓光清晰、无崩坏？",
    suffix: "45 degree angle from behind, looking back over shoulder toward camera, back view focus, back of hair, hair flow, rear outfit details, cinematic rim lighting, dramatic backlight, edge glow",
    negative: "front view, facing camera, frontal face, front of chest"
  }
};

function runVisionInspect(imagePath, promptGuide) {
  return new Promise((resolve) => {
    const inspectScript = path.join(ROOT, 'scripts', 'maintenance', 'image-inspect.js');
    const promptText = `${promptGuide}\n\n请按以下格式回答：\n【审核结论】：通过 / 不通过\n【详细理由】：...`;
    
    execFile('node', [inspectScript, imagePath, '-p', promptText], { timeout: 60000 }, (error, stdout, stderr) => {
      const output = (stdout || '') + (stderr || '');
      let passed = false;
      const conclusionMatch = output.match(/【审核结论】[：:]\s*(通过|不通过)/);
      if (conclusionMatch) {
        passed = (conclusionMatch[1] === '通过');
      } else if (output.includes('不通过')) {
        passed = false;
      } else if (output.includes('通过')) {
        passed = true;
      }

      if (passed && /(分身|双人|复制体|多格|分镜拼贴|并排两人)/.test(output) && !/(无分身|无双人|非双人|非分身)/.test(output)) {
        passed = false;
      }

      resolve({ passed, reason: output.trim() });
    });
  });
}

function buildFixPrompt(char, outfit, persId) {
  const pConfig = PERSPECTIVE_CONFIGS[persId];
  const isNude = outfit.id === 'nsfw_nude' || outfit.name.includes('全裸') || outfit.name.includes('纯粹');

  let charTokens = Array.isArray(char.identityTokens) ? char.identityTokens.join(', ') : char.id;
  if (isNude) {
    charTokens = charTokens.replace(/\b(witch_hat|cape|dress|uniform|blazer|skirt|shoes|boots|gloves|jacket|coat|hoodie|thighhighs|socks)\b/gi, '');
  }

  const outfitTokens = Array.isArray(outfit.tokens) && outfit.tokens.length > 0 ? outfit.tokens.join(', ') : '';
  const outfitProse = outfit.prose || '';

  const promptParts = [
    isNude ? "nude, completely naked, uncensored, full body bare, natural skin" : "",
    charTokens,
    outfitTokens,
    outfitProse,
    pConfig.suffix,
    "@rella, masterpiece, best quality, pristine anime aesthetic, clean cinematic lighting"
  ].filter(Boolean);

  const negParts = [
    "bad anatomy, bad hands, extra limbs, extra arms, extra legs, poorly drawn face, poorly drawn hands, missing fingers, extra digits, cropped, split image, split screen, multiple views, comic panel, collaged, sketch, lowres, blurry, jpeg artifacts, watermark, signature",
    isNude ? "clothes, clothing, shirt, pants, dress, kimono, robe, towel, underwear, bra, panties, swimsuit, bikini, skirt, socks, footwear, shoes, fabric covering" : "",
    pConfig.negative
  ].filter(Boolean);

  return {
    prompt: promptParts.join(', '),
    negative: negParts.join(', ')
  };
}

async function renderImage(char, outfit, persId, targetPath) {
  const { prompt, negative } = buildFixPrompt(char, outfit, persId);
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

async function fixFailedItems() {
  const failedKeys = Object.keys(auditReport).filter(k => !auditReport[k].passed);
  console.log(`[Auto-Fix Engine] 待修复红灯项: ${failedKeys.length} 张`);

  let fixedCount = 0;
  for (let i = 0; i < failedKeys.length; i++) {
    const key = failedKeys[i];
    const [charId, outfitId, persId] = key.split('/');
    const char = standards.characters.find(c => c.id === charId);
    if (!char) continue;
    const outfit = char.outfits.find(o => o.id === outfitId);
    if (!outfit) continue;
    const targetPath = path.join(OUT_BASE, charId, outfitId, `${persId}.png`);
    const pConfig = PERSPECTIVE_CONFIGS[persId];

    console.log(`\n[Fix ${i + 1}/${failedKeys.length}] 正在强化重绘: [${char.displayName}] - [${outfit.name}] - [${persId}]...`);
    
    let pass = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await renderImage(char, outfit, persId, targetPath);
        const res = await runVisionInspect(targetPath, pConfig.guide);
        if (res.passed) {
          console.log(`  🎉 第 ${attempt} 次重绘复审判定通过！`);
          auditReport[key] = { passed: true, retries: attempt, verifiedAt: new Date().toISOString() };
          saveReport();
          fixedCount++;
          pass = true;
          break;
        } else {
          console.log(`  ⚠️ 第 ${attempt} 次复审仍未达标，换 seed 重试...`);
        }
      } catch (err) {
        console.warn(`  ⚠️ 异常: ${err.message}`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (!pass) {
      console.warn(`  ❌ 3 次尝试后仍未达成标准，暂保留记录`);
    }
  }

  console.log(`\n[Auto-Fix Engine] 修复完成！成功转绿灯: ${fixedCount}/${failedKeys.length}`);
}

fixFailedItems().catch(console.error);
