#!/usr/bin/env node
'use strict';

/**
 * 4 视角标准参考资产库：全量视觉模型深度审核与自动重绘闭环
 *
 * 审核契约（基于 Gemini 3.7 Flash 视觉）：
 *  - ref_01_face_closeup: 必须为近景/正脸特写（胸部以上），五官清晰无多余人物或畸变。
 *  - ref_02_half_medium: 必须为 3/4 侧身半身中景，服装结构与姿态完整。
 *  - ref_03_full_dynamic: 必须为【正面视角】且【从头到脚完整】（严禁背影、严禁截断脚踝/鞋子）。
 *  - ref_04_back_rear: 必须为【侧后背影或回眸】（严禁正脸直视镜头）。
 *  - 通用判定：严禁分身、严禁双人/多头、严禁多格漫画拼贴、严禁肢体严重崩坏。
 *
 * 任何不通过的项立即自动调整 seed 并由 Anima 重新渲染，循环直到全部达标！
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'http://127.0.0.1:3000';
const POPULAR_FILE = path.join(ROOT, 'data', 'popular-characters.json');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const AUDIT_REPORT_FILE = path.join(OUT_BASE, 'audit-results.json');

const PERSPECTIVE_SPECS = {
  ref_01_face_closeup: {
    name: '面部与微表情特写',
    promptExtra: 'extreme close-up portrait, head and shoulders, 85mm lens, looking slightly off-camera with a nuanced focused gaze, diffused soft studio lighting, subtle rim light on hair, catchlight in eyes, neutral clean solid background, sharp facial focus, @rella',
    negative: 'bad anatomy, bad hands, deformed, blurry, lowres, split image, split panel, multiple frames, comic strip, extra person, duplicate subject, extreme expression, wide shot, full body',
    auditCriteria: '此图是否为标准的角色正面或微侧【头部与胸部以上大特写/肖像】？画面中是否只有一个角色且面部五官正常无崩坏、无分身？'
  },
  ref_02_half_medium: {
    name: '3/4侧身半身定妆',
    promptExtra: 'medium shot, upper body, 3/4 view angle, hands visible resting naturally near waist, cinematic soft studio lighting, accurate fabric textures and seams, clean minimalistic studio background, @rella',
    negative: 'bad anatomy, bad hands, extra limbs, cropped shoulders, blurry, lowres, split image, split panel, comic strip, multiple people, extra person, full body',
    auditCriteria: '此图是否为标准的角色【3/4侧身或半身中景】（显示腰部至胸部服饰）？画面中是否单人、无分身、服装结构正常？'
  },
  ref_03_full_dynamic: {
    name: '正面全身立姿',
    promptExtra: 'front view, facing camera, looking at viewer, full body shot, standing from head to toe, wide 50mm framing, subtle dynamic elegant stance with weight on one leg, complete footwear visible, neutral seamless studio cyclorama, floor reflection, @rella',
    negative: 'back view, from behind, rear view, bad anatomy, cropped feet, high-heels cut off, sitting, lying down, ground clutter, multiple people, split image, split panel',
    auditCriteria: '此图是否为【正面朝向镜头】且【从头顶到脚底鞋履完整无截断】的全身立姿？是否无分身、非背面？'
  },
  ref_04_back_rear: {
    name: '45°侧后背影',
    promptExtra: 'rear 3/4 back view, from behind, character looking slightly over shoulder towards the side, showing hair structure from behind and back of outfit, soft backlighting, detailed hair structure, clean neutral background, cinematic edge light, @rella',
    negative: 'facing camera directly, frontal view, bad anatomy, deformed, blurry, lowres, split image, split panel, multiple people, extra arms',
    auditCriteria: '此图是否为【45度侧后方或背面回眸】（主要展现背部发型走向/后背服饰结构）？是否并非纯正面直视？'
  }
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** 调本地 image-inspect 视觉模型单张审核 */
async function auditImage(imagePath, criteria) {
  return new Promise((resolve) => {
    const prompt = `请作为最严苛的动画电影角色资产审核员，针对以下标准进行审核判断：\n【审核标准】：${criteria}\n【通用红线】：严禁分身、严禁双人、严禁肢体严重畸形、严禁多格拼贴。\n\n请按如下格式简明输出：\n【审核结论】：通过 / 不通过\n【详细理由】：(一句话说明具体表现与是否符合视角要求)`;
    const inspectScript = path.join(ROOT, 'scripts', 'maintenance', 'image-inspect.js');
    const proc = spawn('node', [inspectScript, imagePath, '-p', prompt], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const full = stdout + stderr;
      const pass = full.includes('【审核结论】：通过') || (full.includes('通过') && !full.includes('不通过'));
      resolve({
        pass: Boolean(pass),
        raw: full.trim()
      });
    });
  });
}

/** 重新渲染单张图像 */
async function reRenderImage(character, pId, attempt) {
  const spec = PERSPECTIVE_SPECS[pId];
  const charDir = path.join(OUT_BASE, character.id);
  const targetFile = path.join(charDir, `${pId}.png`);

  const identityTokens = (character.identityTokens || []).join(', ');
  const outfit = (character.outfits || []).find(o => o.default) || character.outfits?.[0];
  const outfitTokens = (outfit?.tokens || []).join(', ');

  const prompt = [identityTokens, outfitTokens, spec.promptExtra].filter(Boolean).join(', ');
  const seed = 2026110000 + (character.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 100) + (attempt * 7);

  const payload = {
    modelId: 'anima-aesthetic-v1.1',
    prompt,
    negative: spec.negative,
    width: 832,
    height: 1216,
    steps: 30,
    cfg: 4.5,
    seed
  };

  const submitRes = await fetch(`${BASE}/api/anima/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const submitJson = await submitRes.json();
  if (!submitRes.ok || !submitJson.ok || !submitJson.job?.id) {
    throw new Error(`重新渲染提交失败: ${JSON.stringify(submitJson)}`);
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
        throw new Error(`重新渲染失败: ${jobState.error || jobState.status}`);
      }
    }
  }

  const imgRes = await fetch(`${BASE}${jobState.resultUrl}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(targetFile, buffer);
  return { jobId, size: buffer.length };
}

async function main() {
  console.log(`================================================================`);
  console.log(`[Audit & Fix] 启动角色标准参考资产库：严苛视觉审核与重绘闭环...`);

  const popular = readJson(POPULAR_FILE);
  const characters = popular.characters;

  let auditStore = {};
  if (fs.existsSync(AUDIT_REPORT_FILE)) {
    try { auditStore = readJson(AUDIT_REPORT_FILE); } catch (e) {}
  }

  let totalAudited = 0;
  let totalFixed = 0;

  for (const char of characters) {
    const charDir = path.join(OUT_BASE, char.id);
    if (!fs.existsSync(charDir)) continue;

    console.log(`\n----------------------------------------------------------------`);
    console.log(`🔍 正在审核角色: [${char.displayName}] (${char.id})`);

    for (const [pId, spec] of Object.entries(PERSPECTIVE_SPECS)) {
      const imgPath = path.join(charDir, `${pId}.png`);
      if (!fs.existsSync(imgPath)) continue;

      totalAudited++;
      process.stdout.write(`  [审核] ${spec.name} (${pId})... `);

      let audit = await auditImage(imgPath, spec.auditCriteria);
      let attempt = 1;

      while (!audit.pass && attempt <= 3) {
        console.log(`❌ 判定不通过 (理由: ${audit.raw.slice(0, 100)}...)`);
        console.log(`    ↳ 启动第 ${attempt} 次 Anima 强化重绘 (修复视角与特征)...`);

        try {
          await reRenderImage(char, pId, attempt);
          console.log(`    ↳ 重绘落盘成功，正在二次复审...`);
          audit = await auditImage(imgPath, spec.auditCriteria);
          if (audit.pass) {
            console.log(`    ↳ 🎉 二次复审判定通过！`);
            totalFixed++;
            break;
          }
        } catch (err) {
          console.error(`    ↳ 重绘发生异常:`, err.message);
        }
        attempt++;
      }

      if (audit.pass) {
        if (attempt === 1) console.log(`✓ 判定通过`);
        auditStore[`${char.id}:${pId}`] = { status: 'PASS', time: new Date().toISOString() };
      } else {
        console.log(`⚠️ 经过 3 次重试仍未达标，暂保留当前版本记录`);
        auditStore[`${char.id}:${pId}`] = { status: 'FAIL', raw: audit.raw, time: new Date().toISOString() };
      }
      writeJson(AUDIT_REPORT_FILE, auditStore);
    }
  }

  console.log(`\n================================================================`);
  console.log(`[Audit & Fix] 全量审核与重绘闭环完成！总审核图数: ${totalAudited}，自动修复重绘: ${totalFixed} 张`);
}

main().catch(console.error);
