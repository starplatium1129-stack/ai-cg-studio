#!/usr/bin/env node
'use strict';

/**
 * 角色标准 4 视角参考图：4 并发 Gemini 3.7 视觉模型深度审核
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_BASE = path.join(ROOT, 'assets', 'character-references');
const AUDIT_REPORT_FILE = path.join(OUT_BASE, 'audit-results.json');
const INSPECT_SCRIPT = path.join(ROOT, 'scripts', 'maintenance', 'image-inspect.js');

const PERSPECTIVE_SPECS = {
  ref_01_face_closeup: {
    name: '面部特写',
    criteria: '此图是否为标准的角色正面或微侧【头部与胸部以上大特写/肖像】？画面中是否单人、五官端正正常无严重崩坏、无分身？'
  },
  ref_02_half_medium: {
    name: '3/4半身定妆',
    criteria: '此图是否为标准的角色【3/4侧身或半身中景】（显示腰部至胸部服饰）？画面中是否单人、无分身、服装结构完整？'
  },
  ref_03_full_dynamic: {
    name: '正面全身立姿',
    criteria: '此图是否为【正面朝向镜头】且【从头顶到脚底鞋履完整无截断】的全身立姿？画面中是否单人、非背影、脚底未被裁切？'
  },
  ref_04_back_rear: {
    name: '45°侧后背影',
    criteria: '此图是否为【45度侧后方或背面回眸】（主要展现背部发型走向/后背服饰结构）？是否并非纯正面直视？'
  }
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function auditSingleImage(charId, pId, imgPath) {
  const spec = PERSPECTIVE_SPECS[pId];
  const prompt = `请作为最严苛的动画电影角色资产审核员，针对以下标准进行审核判断：\n【审核标准】：${spec.criteria}\n【通用红线】：严禁分身、严禁双人、严禁肢体严重畸形、严禁多格拼贴。\n\n请按如下格式简明输出：\n【审核结论】：通过 / 不通过\n【详细理由】：(一句话说明具体表现与是否符合视角要求)`;

  return new Promise((resolve) => {
    const proc = spawn('node', [INSPECT_SCRIPT, imgPath, '-p', prompt], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', () => {
      const full = stdout + stderr;
      let pass = false;
      if (full.includes('【审核结论】：通过') || (full.includes('通过') && !full.includes('不通过'))) {
        pass = true;
      }
      resolve({
        charId,
        pId,
        imgPath,
        pass,
        raw: full.trim()
      });
    });
  });
}

async function runParallelAudit() {
  console.log(`================================================================`);
  console.log(`[Parallel Audit] 启动 4 并发视觉模型深度审核...`);

  let auditStore = {};
  if (fs.existsSync(AUDIT_REPORT_FILE)) {
    try { auditStore = readJson(AUDIT_REPORT_FILE); } catch (e) {}
  }

  // 收集所有已存在的待审图片
  const tasks = [];
  const charDirs = fs.readdirSync(OUT_BASE);
  for (const dir of charDirs) {
    const fullDir = path.join(OUT_BASE, dir);
    if (!fs.statSync(fullDir).isDirectory()) continue;

    for (const pId of Object.keys(PERSPECTIVE_SPECS)) {
      const imgPath = path.join(fullDir, `${pId}.png`);
      const taskKey = `${dir}:${pId}`;
      if (fs.existsSync(imgPath) && (!auditStore[taskKey] || auditStore[taskKey].status !== 'PASS')) {
        tasks.push({ charId: dir, pId, imgPath });
      }
    }
  }

  console.log(`[Parallel Audit] 待审核任务数: ${tasks.length} 项`);

  const CONCURRENCY = 4;
  let cursor = 0;
  let passedCount = 0;
  let failedCount = 0;

  async function worker(workerId) {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      const taskKey = `${task.charId}:${task.pId}`;
      const res = await auditSingleImage(task.charId, task.pId, task.imgPath);

      if (res.pass) {
        passedCount++;
        auditStore[taskKey] = { status: 'PASS', time: new Date().toISOString() };
        console.log(`  ✓ [通过] ${task.charId} -> ${PERSPECTIVE_SPECS[task.pId].name} (${task.pId})`);
      } else {
        failedCount++;
        auditStore[taskKey] = { status: 'FAIL', raw: res.raw, time: new Date().toISOString() };
        console.log(`  ✗ [不通过] ${task.charId} -> ${PERSPECTIVE_SPECS[task.pId].name} (${task.pId})\n      理由: ${res.raw.slice(0, 120)}...`);
      }
      writeJson(AUDIT_REPORT_FILE, auditStore);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  console.log(`\n================================================================`);
  console.log(`[Parallel Audit] 审核轮次完成！通过: ${passedCount}, 需修复: ${failedCount}`);
}

runParallelAudit().catch(console.error);
