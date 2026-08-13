#!/usr/bin/env node
/**
 * generate-fix-guides.js — 从审核报告生成修复指南
 *
 * 读 audit-unified-sweep.js 产出的 audit-report.json，汇总所有
 * 「不通过 / 需复核 / 快筛不通过 / 请求失败」的图，输出 fix-guides.md：
 * 每张图的审核结论、问题清单（位置 + 修复方向）与总评。
 *
 * 加 --try-images 时逐张尝试用 gemini-3.1-flash-image 图像编辑生成修复示意图
 * （spawn scripts/maintenance/image-generate.js --input 原图）；上游失败
 * （Google 区域限制 / 配额耗尽，见 image-generate.js 头部说明）时自动降级为
 * 纯文本指南并记录原因，不影响主产出。
 *
 * 用法：
 *   node scripts/maintenance/generate-fix-guides.js <audit-report.json> [选项]
 *
 * 选项：
 *       --out-dir <目录>    输出目录（默认 <report 所在目录>/fix-guides）
 *       --try-images        尝试为每张待修复图生成修复示意图（较慢，串行）
 *   -m, --model <模型名>    透传 image-generate.js（默认 gemini-3.1-flash-image）
 *       --timeout <ms>      单张示意图超时（默认 240000）
 *   -h, --help              显示帮助
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_DIR = __dirname;
const GENERATE_JS = path.join(SCRIPT_DIR, 'image-generate.js');

function printHelp() {
  console.log(`用法：node ${path.basename(process.argv[1])} <audit-report.json> [选项]

从 audit-unified-sweep.js 的审核报告生成修复指南。

选项：
      --out-dir <目录>    输出目录（默认 <report 所在目录>/fix-guides）
      --try-images        尝试为每张待修复图生成修复示意图（较慢，串行）
  -m, --model <模型名>    透传 image-generate.js（默认 gemini-3.1-flash-image）
      --timeout <ms>      单张示意图超时（默认 240000）
  -h, --help              显示帮助`);
}

function parseArgs(argv) {
  const opts = { report: null, outDir: null, tryImages: false, model: null, timeoutMs: 240000, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--out-dir': opts.outDir = next(); break;
      case '--try-images': opts.tryImages = true; break;
      case '-m': case '--model': opts.model = next(); break;
      case '--timeout': opts.timeoutMs = Number(next()); break;
      case '-h': case '--help': opts.help = true; break;
      default:
        if (a.startsWith('-')) { console.error(`[错误] 未知选项: ${a}（--help 查看用法）`); process.exit(2); }
        if (opts.report === null) opts.report = a;
    }
  }
  return opts;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** 从八维审核全文里提取「问题清单」段落（位置+问题+修复方向），截断到 600 字。 */
function extractIssues(content) {
  if (!content) return '';
  const m = content.match(/问题清单[：:]([\s\S]*?)(?:\n\s*总评|\n\s*总分|$)/);
  const raw = m ? m[1].trim() : content.slice(0, 600).trim();
  return raw.length > 600 ? raw.slice(0, 600) + '…' : raw;
}

/** 尝试生成一张修复示意图；失败返回错误信息（降级用）。 */
function tryFixImage(record, imagePath, outDir, opts) {
  const prompt = `请根据以下审核意见修复这张图：${extractIssues(record.content) || record.quickError || record.error || '修复画面中的明显问题'}`;
  const name = `fix-${record.candidate}-${record.sceneId}-s${record.seed}.png`;
  const out = path.join(outDir, name);
  const r = spawnSync(process.execPath, [
    GENERATE_JS, prompt,
    '--input', imagePath,
    '-o', out,
    '--timeout', String(opts.timeoutMs),
    ...(opts.model ? ['-m', opts.model] : []),
  ], { encoding: 'utf8', timeout: opts.timeoutMs + 30000 });
  if (r.status === 0 && fs.existsSync(out)) return { ok: true, file: name };
  const err = (r.stderr || r.stdout || '').split('\n').filter(Boolean).slice(-2).join(' ');
  return { ok: false, error: err || `退出码 ${r.status}` };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { printHelp(); return; }
  if (!opts.report) {
    console.error('[错误] 缺少 audit-report.json（--help 查看用法）');
    process.exit(2);
  }
  if (!fs.existsSync(opts.report)) {
    console.error(`[错误] 报告不存在: ${opts.report}`);
    process.exit(2);
  }
  const report = readJson(opts.report);
  const outDir = opts.outDir || path.join(path.dirname(path.resolve(opts.report)), 'fix-guides');
  fs.mkdirSync(outDir, { recursive: true });

  const pending = (report.results || []).filter(x =>
    x.quickVerdict === '不通过' || x.verdict === '不通过' || x.verdict === '需复核' || x.ok === false
  );
  if (pending.length === 0) {
    console.log('[无待修复项] 报告内没有「不通过 / 需复核 / 失败」的图。');
    return;
  }

  console.log(`[待修复] ${pending.length} 张（快筛不通过/精审不通过/需复核/失败）`);
  // manifest 路径优先取报告里记录的；相对路径时相对报告所在目录解析
  // （audit-unified-sweep.js 写报告时原样存 manifestFile，可能是相对路径）。
  const reportDir = path.dirname(path.resolve(opts.report));
  const manifestPath = String(report.manifest || opts.report);
  const manifestDir = path.isAbsolute(manifestPath)
    ? path.dirname(manifestPath)
    : path.dirname(path.resolve(reportDir, manifestPath));
  const rows = [];
  for (let i = 0; i < pending.length; i++) {
    const x = pending[i];
    const rel = String(x.image || '');
    const imagePath = path.isAbsolute(rel) ? rel : path.join(manifestDir, rel);
    const summary = x.ok
      ? `${x.verdict}${x.score !== null ? `（${x.score}/80）` : ''}`
      : (x.quickVerdict === '不通过' ? '快筛不通过（未精审）' : '请求失败');
    console.log(`[${i + 1}/${pending.length}] ${x.candidate} ${x.sceneId} seed-${x.seed} → ${summary}`);
    let guide = { candidate: x.candidate, epoch: x.epoch, sceneId: x.sceneId, sceneTitle: x.sceneTitle, seed: x.seed, mature: x.mature, summary, issues: extractIssues(x.content) || x.quickError || x.error || '', image: x.image };
    if (opts.tryImages && fs.existsSync(imagePath)) {
      const r = tryFixImage(x, imagePath, outDir, opts);
      if (r.ok) {
        guide.fixImage = r.file;
        console.log(`  ✓ 修复示意: ${r.file}`);
      } else {
        guide.fixImageError = r.error;
        console.log(`  ⚠ 示意图未生成（降级文本）: ${r.error}`);
      }
    } else if (opts.tryImages) {
      guide.fixImageError = `原图不存在: ${imagePath}`;
    }
    rows.push(guide);
  }

  const md = [];
  md.push(`# 修复指南（${report.paramGroup || 'unknown'}）`);
  md.push('');
  md.push(`> 来源：${opts.report}`);
  md.push(`> 生成时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
  md.push(`> 待修复 ${rows.length} 张${opts.tryImages ? '（含修复示意图尝试，上游配额/区域限制失败时降级为文本）' : '（加 --try-images 可尝试生成修复示意图）'}`);
  md.push('');
  const byCandidate = {};
  rows.forEach(r => {
    (byCandidate[r.candidate] = byCandidate[r.candidate] || []).push(r);
  });
  for (const [candidate, list] of Object.entries(byCandidate)) {
    md.push(`## ${candidate}（e${list[0].epoch}）· ${list.length} 张待修复`);
    md.push('');
    for (const r of list) {
      md.push(`### ${r.sceneId}${r.sceneTitle ? ' ' + r.sceneTitle : ''} · seed-${r.seed}${r.mature ? '（R18）' : ''}`);
      md.push('');
      md.push(`- 结论：${r.summary}`);
      if (r.issues) { md.push(`- 问题与修复方向：${r.issues.replace(/\n+/g, ' ')}`); }
      if (r.fixImage) { md.push(`- 修复示意图：\`${r.fixImage}\``); }
      if (r.fixImageError) { md.push(`- 示意图未生成：${r.fixImageError}`); }
      md.push('');
    }
  }
  const mdFile = path.join(outDir, 'fix-guides.md');
  fs.writeFileSync(mdFile, md.join('\n'), 'utf8');
  fs.writeFileSync(path.join(outDir, 'fix-guides.json'), JSON.stringify({ source: opts.report, paramGroup: report.paramGroup, rows }, null, 2), 'utf8');
  console.log(`\n[完成] 修复指南: ${mdFile}（${rows.length} 张）`);
}

main().catch(e => {
  console.error('[失败] ' + (e && e.message || e));
  process.exitCode = 1;
});
