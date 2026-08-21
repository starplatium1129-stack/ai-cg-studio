#!/usr/bin/env node
'use strict';

/* summarize-audit-dimensions.js — 从 audit-report.json 提取逐维度均分与不通过原因归类。
 *
 * 输出：每候选的八维平均分 + 不通过问题归类分布 + 典型问题摘录，
 * 回答「e12 好在哪 / e16 好在哪不好在哪 / 为什么不通过」。
 *
 * 用法：node scripts/tests/summarize-audit-dimensions.js <audit-report.json>...
 */

var fs = require('fs');
var path = require('path');

var DIMENSIONS = [
  '身份特征还原', '脸部与神态', '服装', '肢体结构与姿势',
  '构图', '背景与细节', '光影与氛围', '完成度与叙事',
];

var REASON_CATEGORIES = [
  { key:'手部', re:/手|手指|指节|手掌|拇指|腕/ },
  { key:'脚部', re:/脚|鞋|脚趾|脚踝/ },
  { key:'腿部', re:/腿|膝|脚踝/ },
  { key:'面部', re:/脸|五官|眼|嘴|表情/ },
  { key:'服装', re:/服装|衣服|袖|裙|布料|领|穿模|外套/ },
  { key:'头发发饰', re:/头发|发丝|发带|呆毛|发饰/ },
  { key:'背景伪影', re:/背景|伪影|异物|乱码|水印|悬浮|杂物/ },
  { key:'构图', re:/构图|裁切|留白|取景/ },
  { key:'光影', re:/光影|光照|阴影|接地|反光|曝光/ },
  { key:'姿势结构', re:/姿势|透视|比例|肢体|结构崩坏|解剖|身体/ },
];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function parseDimensionScores(content) {
  var scores = {};
  var lines = String(content || '').split('\n');
  lines.forEach(function (line) {
    for (var i = 0; i < DIMENSIONS.length; i++) {
      var dim = DIMENSIONS[i];
      // 严格行结构：维度名 + 可选星号 + |或： + 可选星号 + 分数(0-10) + 分 或 /10
      var m = line.match(new RegExp(dim + '\\s*\\*{0,2}\\s*[|:：]\\s*\\*{0,2}\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*(?:分|\\/10)'));
      if (m) {
        var v = parseFloat(m[1]);
        if (v >= 0 && v <= 10) scores[dim] = v;
        break;
      }
    }
  });
  return scores;
}

function classifyReasons(content) {
  // 只分析「问题清单」段落（问题清单标题之后到总评之前），避免维度行误匹配
  var text = String(content || '');
  var start = text.indexOf('问题清单');
  if (start >= 0) text = text.slice(start);
  var end = text.indexOf('总评');
  if (end > start) text = text.slice(0, end);
  return REASON_CATEGORIES
    .filter(function (c) { return c.re.test(text); })
    .map(function (c) { return c.key; });
}

function summarize(report) {
  var byCandidate = {};
  report.results.forEach(function (x) {
    var b = byCandidate[x.candidate] || (byCandidate[x.candidate] = {
      epoch: x.epoch, total: 0, pass: 0, review: 0, reject: 0, quickReject: 0,
      dimSums: {}, dimCounts: {}, reasons: {},
      rejected: [], passed: [],
    });
    b.total += 1;
    if (x.ok) {
      if (x.verdict === '通过') b.pass += 1;
      else if (x.verdict === '需复核') b.review += 1;
      else if (x.verdict === '不通过') {
        b.reject += 1;
        b.rejected.push({ sceneId: x.sceneId, seed: x.seed, content: x.content });
      }
      var scores = parseDimensionScores(x.content);
      Object.keys(scores).forEach(function (dim) {
        b.dimSums[dim] = (b.dimSums[dim] || 0) + scores[dim];
        b.dimCounts[dim] = (b.dimCounts[dim] || 0) + 1;
      });
      if (x.verdict === '不通过') {
        classifyReasons(x.content).forEach(function (k) { b.reasons[k] = (b.reasons[k] || 0) + 1; });
      }
    } else if (x.quickVerdict === '不通过') {
      b.reject += 1;
      b.quickReject += 1;
    }
  });
  return byCandidate;
}

function fmt(report) {
  var byCandidate = summarize(report);
  var order = Object.keys(byCandidate).sort(function (a, b) { return byCandidate[a].epoch - byCandidate[b].epoch; });
  var md = '## ' + path.basename(path.dirname(report.manifest || '')) || report.manifest;
  md += '\n\n参数组：' + report.paramGroup + ' ｜ 审核模型：' + (report.auditModel || 'gemini-3.7-flash-high') + '\n\n';
  order.forEach(function (id) {
    var b = byCandidate[id];
    md += '### ' + id + '（epoch ' + b.epoch + '）· 通过 ' + b.pass + ' / 需复核 ' + b.review + ' / 不通过 ' + b.reject + (b.quickReject ? '（其中快筛淘汰 ' + b.quickReject + '）' : '') + '\n\n';
    md += '**八维均分**（精审有分记录）：\n\n';
    md += '| 维度 | 均分 |\n|---|---|\n';
    var avgAll = [];
    DIMENSIONS.forEach(function (dim) {
      var n = b.dimCounts[dim] || 0;
      var avg = n ? (b.dimSums[dim] / n).toFixed(1) : '—';
      if (n) avgAll.push(parseFloat(avg));
      md += '| ' + dim + ' | ' + avg + '（n=' + n + '） |\n';
    });
    if (avgAll.length) md += '| **总均分** | **' + (avgAll.reduce(function (a, c) { return a + c; }, 0) / avgAll.length).toFixed(1) + '** |\n';
    md += '\n**不通过原因分布**（同张可多类）：\n\n';
    var reasons = Object.keys(b.reasons).sort(function (a, c) { return b.reasons[c] - b.reasons[a]; });
    if (!reasons.length) md += '无（快筛淘汰或无精审记录）\n\n';
    else {
      reasons.forEach(function (k) { md += '- ' + k + ' ×' + b.reasons[k] + '\n'; });
      md += '\n';
    }
    // 典型问题摘录：不通过记录的问题清单前几条
    if (b.rejected.length) {
      md += '**不通过分布**：' + b.rejected.map(function (r) { return r.sceneId + '(s' + r.seed + ')'; }).join('、') + '\n\n';
      var sample = b.rejected[0];
      if (sample && sample.content) {
        var lines = sample.content.split('\n').filter(function (l) { return /问题|位置|修复/.test(l); });
        md += '示例问题（' + sample.sceneId + ' seed-' + sample.seed + '）：\n\n';
        md += lines.slice(0, 6).map(function (l) { return '> ' + l; }).join('\n') + '\n\n';
      }
    }
  });
  return md;
}

function main() {
  var files = process.argv.slice(2).filter(function (a) { return a.endsWith('.json'); });
  if (!files.length) {
    console.error('用法: node scripts/tests/summarize-audit-dimensions.js <audit-report.json>...');
    process.exit(2);
  }
  files.forEach(function (file) {
    var report = readJson(file);
    var md = fmt(report);
    var out = file.replace(/\.json$/, '-dimensions.md');
    fs.writeFileSync(out, md, 'utf8');
    console.log('written: ' + out);
  });
}

main();
