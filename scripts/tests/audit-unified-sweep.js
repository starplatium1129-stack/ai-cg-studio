#!/usr/bin/env node
'use strict';

/* audit-unified-sweep.js — 对 Anima unified sweep 生成的实图逐张执行八维严格审核并汇总。
 *
 * 读取评估 manifest（evaluate-anima-unified.js 产物），对每张图调用本地视觉模型
 * （复用 image-inspect.js 的 audit 预设与请求逻辑），解析结论/总分，按候选汇总
 * 通过/需复核/不通过 计数与平均分，输出 JSON + Markdown 报告。
 *
 * 用法：
 *   node scripts/tests/audit-unified-sweep.js [manifest.json] [--out-dir <dir>] [--resume]
 */

var fs = require('fs');
var path = require('path');
var http = require('http');
var inspect = require('../maintenance/image-inspect.js');

var ROOT = path.resolve(__dirname, '..', '..');
var AI_ROOT = path.resolve(ROOT, '..', 'AI');
var DEFAULT_MANIFEST = path.join(AI_ROOT, 'Reviews', 'AnimaUnifiedSweep', '2026-08-13_24s_cfg3', 'manifest.json');

var AUDIT_PROMPT = inspect.TASKS.audit;
var MODEL = inspect.DEFAULT_MODEL;

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive:true });
  var temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, file);
}

function httpJson(urlPath, body, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var url = new URL(inspect.DEFAULT_BASE_URL + urlPath);
    var payload = body ? JSON.stringify(body) : null;
    var req = http.request({
      hostname: url.hostname, port: url.port || 80, path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + inspect.DEFAULT_API_KEY,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, function (res) {
      var d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () {
        var json = null;
        try { json = JSON.parse(d); } catch (error) {}
        if (res.statusCode >= 200 && res.statusCode < 300 && json) return resolve(json);
        var detail = json && json.error ? JSON.stringify(json.error) : d.slice(0, 600);
        reject(new Error('HTTP ' + res.statusCode + ': ' + detail));
      });
    });
    req.setTimeout(timeoutMs, function () { req.destroy(new Error('timeout ' + timeoutMs + 'ms')); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function auditImage(imagePath, expectText) {
  var content = [
    { type:'text', text: AUDIT_PROMPT + '\n【预期内容】' + expectText + '\n审核时先判断画面是否符合预期（人物、服装、姿势、构图、环境），不符合预期本身也要作为问题列出。\n\n图片文件：' + imagePath },
    { type:'image_url', image_url:{ url: inspect.imageUrl(imagePath) } },
  ];
  var lastErr = null;
  for (var attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(function (r) { setTimeout(r, 2000); });
    try {
      var j = await httpJson('/chat/completions', {
        model: MODEL,
        messages:[{ role:'user', content:content }],
        max_tokens: 4000,
      }, 180000);
      var text = j.choices && j.choices[0] && j.choices[0].message
        ? String(j.choices[0].message.content) : JSON.stringify(j).slice(0, 800);
      return { ok:true, content:text };
    } catch (e) {
      lastErr = e;
      var retriable = /HTTP 5\d\d/.test(e.message) || /timeout/.test(e.message) || /ECONN|EPIPE|ETIMEDOUT/.test(e.message);
      if (!retriable) break;
    }
  }
  return { ok:false, content:null, error:lastErr.message };
}

function parseVerdict(content) {
  var m = content.match(/结论\s*[：:]\s*\*{0,2}(通过|需复核|不通过)/);
  var score = content.match(/总分\s*[：:]\s*(\d+)\s*\/\s*80/);
  return {
    verdict: m ? m[1] : 'parse-fail',
    score: score ? Number(score[1]) : null,
  };
}

function expectFor(scene, record) {
  var parts = ['场景：' + (scene.title || record.sceneId)];
  if (record.mature) parts.push('R18 成人内容');
  else parts.push('safe 非成人');
  parts.push('角色：绫地宁宁（ayachi_nene，白发/紫瞳/呆毛/粉色发带，宁宁）');
  return parts.join('；');
}

async function main() {
  var args = process.argv.slice(2);
  var manifestFile = args.find(function (a) { return a.endsWith('.json'); }) || DEFAULT_MANIFEST;
  var outDirIndex = args.indexOf('--out-dir');
  var outDir = outDirIndex >= 0 ? args[outDirIndex + 1] : path.join(path.dirname(manifestFile), 'audit');
  var resume = args.includes('--resume');

  if (!fs.existsSync(manifestFile)) {
    console.error('[错误] manifest 不存在: ' + manifestFile);
    process.exit(2);
  }
  var manifest = readJson(manifestFile);
  var scenes = new Map(manifest.scenes.map(function (s) { return [s.id, s]; }));
  var records = manifest.records.filter(function (r) { return r.status === 'succeeded'; });
  console.log('审核对象: ' + records.length + ' 张（' + manifest.paramGroup + '）');

  fs.mkdirSync(outDir, { recursive:true });
  var reportFile = path.join(outDir, 'audit-report.json');
  var report = resume && fs.existsSync(reportFile) ? readJson(reportFile) : { manifest:manifestFile, paramGroup:manifest.paramGroup, results:[] };

  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    var existing = report.results.find(function (x) {
      return x.candidate === r.candidate && x.sceneId === r.sceneId && x.seed === r.seed;
    });
    if (existing) continue;
    var imagePath = path.join(path.dirname(manifestFile), r.image);
    if (!fs.existsSync(imagePath)) {
      console.error('[缺失] ' + imagePath);
      continue;
    }
    var scene = scenes.get(r.sceneId) || { title:r.sceneTitle || r.sceneId };
    process.stderr.write('[' + (i + 1) + '/' + records.length + '] ' + r.candidate + ' ' + r.sceneId + ' seed-' + r.seed + ' → ' + MODEL + '\n');
    var res = await auditImage(imagePath, expectFor(scene, r));
    if (!res.ok) {
      console.error('[失败] ' + r.candidate + ' ' + r.sceneId + ' seed-' + r.seed + ': ' + res.error);
      report.results.push({
        candidate:r.candidate, epoch:r.epoch, sceneId:r.sceneId, sceneTitle:scene.title, mature:r.mature, seed:r.seed,
        image:r.image, ok:false, error:res.error, verdict:null, score:null, content:null,
      });
    } else {
      var parsed = parseVerdict(res.content);
      report.results.push({
        candidate:r.candidate, epoch:r.epoch, sceneId:r.sceneId, sceneTitle:scene.title, mature:r.mature, seed:r.seed,
        image:r.image, ok:true, error:null, verdict:parsed.verdict, score:parsed.score, content:res.content,
      });
    }
    writeJson(reportFile, report);
  }

  // 汇总
  var byCandidate = {};
  report.results.forEach(function (x) {
    if (!byCandidate[x.candidate]) byCandidate[x.candidate] = { epoch:x.epoch, pass:0, review:0, reject:0, fail:0, scores:[] };
    var b = byCandidate[x.candidate];
    if (!x.ok) b.fail += 1;
    else if (x.verdict === '通过') b.pass += 1;
    else if (x.verdict === '需复核') b.review += 1;
    else if (x.verdict === '不通过') b.reject += 1;
    else b.fail += 1;
    if (x.score !== null) b.scores.push(x.score);
  });
  var order = Object.keys(byCandidate).sort(function (a, b) { return byCandidate[a].epoch - byCandidate[b].epoch; });

  var md = '# Anima Unified Sweep 审核汇总\n\n- manifest: `' + manifestFile + '`\n- 参数组: ' + manifest.paramGroup + '\n- 审核模型: ' + MODEL + '\n\n';
  md += '## 各候选汇总（通过 / 需复核 / 不通过 / 失败，平均分满分 80）\n\n';
  md += '| 候选 | epoch | 通过 | 需复核 | 不通过 | 失败 | 平均分 |\n|---|---|---|---|---|---|---|\n';
  order.forEach(function (id) {
    var b = byCandidate[id];
    var avg = b.scores.length ? (b.scores.reduce(function (a, c) { return a + c; }, 0) / b.scores.length).toFixed(1) : '—';
    md += '| ' + id + ' | ' + b.epoch + ' | ' + b.pass + ' | ' + b.review + ' | ' + b.reject + ' | ' + b.fail + ' | ' + avg + ' |\n';
  });
  md += '\n## 逐张明细\n\n';
  report.results.forEach(function (x) {
    md += '### ' + x.candidate + ' · ' + x.sceneId + ' · seed-' + x.seed + (x.mature ? '（R18）' : '') + '\n\n';
    md += '- 结论：' + (x.ok ? (x.verdict + (x.score !== null ? '（' + x.score + '/80）' : '')) : '请求失败') + '\n';
    if (x.ok) md += '\n' + x.content + '\n';
    else md += '- 错误：' + x.error + '\n';
  });
  var mdFile = path.join(outDir, 'audit-report.md');
  fs.writeFileSync(mdFile, md, 'utf8');
  writeJson(reportFile, report);

  console.log('\n===== 汇总（' + manifest.paramGroup + '）=====');
  order.forEach(function (id) {
    var b = byCandidate[id];
    var avg = b.scores.length ? (b.scores.reduce(function (a, c) { return a + c; }, 0) / b.scores.length).toFixed(1) : '—';
    console.log(id + ' (e' + b.epoch + '): 通过 ' + b.pass + ' / 需复核 ' + b.review + ' / 不通过 ' + b.reject + ' / 失败 ' + b.fail + ' / 平均分 ' + avg);
  });
  console.log('报告: ' + mdFile);
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
