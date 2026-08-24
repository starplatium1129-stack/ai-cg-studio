#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const INSPECT_SCRIPT = path.join(ROOT, 'scripts', 'maintenance', 'image-inspect.js');
const REPORT_FILE = path.join(ROOT, 'runtime', 'ai-pre-audit-report.json');

const POPULAR_DIR = 'E:/code/2/lora/AI/Reviews/ShowcaseRefresh/2026-08-14_v18-popular-all-rella/images';
const SCENE_DIR = 'E:/code/2/lora/AI/Reviews/SceneShowcaseRefresh/2026-08-14_v16-anima11-rella/images';

const CONCURRENCY = 4;

function getPngs(dir, category) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getPngs(full, category));
    } else if (entry.isFile() && entry.name.endsWith('.png')) {
      results.push({ full, name: entry.name, category, rel: path.relative(dir, full) });
    }
  }
  return results;
}

const allImages = [...getPngs(POPULAR_DIR, 'popular'), ...getPngs(SCENE_DIR, 'scene')];

let report = { timestamp: new Date().toISOString(), total: allImages.length, passed: [], rejected: [], summary: {} };
if (fs.existsSync(REPORT_FILE)) {
  try { report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8')); } catch (e) {}
}

const auditedMap = new Map();
(report.passed || []).forEach(r => auditedMap.set(r.full, true));
(report.rejected || []).forEach(r => auditedMap.set(r.full, false));

const pending = allImages.filter(img => !auditedMap.has(img.full));
console.log(`[Audit Engine] Total images: ${allImages.length}, Already audited: ${auditedMap.size}, Pending: ${pending.length}`);

const AUDIT_PROMPT = `请作为极度严苛的二次元商业插画总监（对标刚才用户的严苛审美红线），对这张AI生成的动漫图进行综合审核：
【严格拦截红线】：
1. 姿态动作：是否木偶站桩、关节错位、四肢融化、骨盆/脊椎扭曲脱节、手指多指/缺指/粘连？
2. 面部与神态：五官是否扁平/糊化/呆滞、眼神是否空洞无聚焦、标志性特征（呆毛/异色瞳/泪痣/发饰）是否丢失？
3. 背景与空间：下半部分或边缘是否大面积死黑/死白空洞、是否缺乏地面承载与纵深层次？
4. 光影与材质：光影是否生硬无冷暖对比、丝袜/织物是否出现材质割裂（如左右腿一条纯黑一条网袜冲突）、水汽环境是否缺乏湿发湿水细节？
5. 分镜/路人：单人场景是否出现多余路人、双人分身、分屏分镜拼贴？

请按以下格式严格回答：
【审核结论】：通过 / 不通过
【核心理由】：（用1-2句话简要指出关键亮点或致命问题，若不通过必须写明问题点）`;

function auditOne(item) {
  return new Promise((resolve) => {
    execFile('node', [INSPECT_SCRIPT, item.full, '-p', AUDIT_PROMPT], { timeout: 70000 }, (error, stdout, stderr) => {
      const output = (stdout || '') + (stderr || '');
      let passed = false;
      let reason = '识别超时或无响应';
      
      const conclusionMatch = output.match(/【审核结论】[：:]\s*(通过|不通过)/);
      if (conclusionMatch) {
        passed = (conclusionMatch[1] === '通过');
      } else if (output.includes('不通过')) {
        passed = false;
      } else if (output.includes('通过')) {
        passed = true;
      }
      
      const reasonMatch = output.match(/【核心理由】[：:]\s*([\s\S]+?)(?:$|\n\n)/);
      if (reasonMatch) {
        reason = reasonMatch[1].trim();
      } else {
        reason = output.substring(0, 150).trim();
      }

      // 强规则二次拦截
      if (passed && /(分身|双人|复制体|多指|六指|断肢|左右腿材质不一致|网袜冲突)/.test(output) && !/(无分身|无双人|非双人|未出现)/.test(output)) {
        passed = false;
        reason += ' [触发致命瑕疵拦截]';
      }

      resolve({ ...item, passed, reason, timestamp: new Date().toISOString() });
    });
  });
}

async function run() {
  let index = 0;
  let active = 0;
  let finished = 0;

  function save() {
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    report.summary = {
      total: allImages.length,
      audited: (report.passed || []).length + (report.rejected || []).length,
      passedCount: (report.passed || []).length,
      rejectedCount: (report.rejected || []).length,
      passRate: (((report.passed || []).length / (((report.passed || []).length + (report.rejected || []).length) || 1)) * 100).toFixed(1) + '%'
    };
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  }

  return new Promise((resolve) => {
    function next() {
      if (finished >= pending.length) {
        save();
        console.log(`\n[Audit Done] Passed: ${report.passed.length}, Rejected: ${report.rejected.length}`);
        resolve();
        return;
      }

      while (active < CONCURRENCY && index < pending.length) {
        const item = pending[index++];
        active++;
        auditOne(item).then((res) => {
          active--;
          finished++;
          if (res.passed) {
            report.passed.push(res);
            console.log(`[${finished}/${pending.length}] [PASS] ${res.category} | ${res.rel}`);
          } else {
            report.rejected.push(res);
            console.log(`[${finished}/${pending.length}] [REJECT] ${res.category} | ${res.rel} -> ${res.reason}`);
          }
          if (finished % 5 === 0) save();
          next();
        });
      }
    }
    next();
  });
}

run();
