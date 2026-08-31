#!/usr/bin/env node
'use strict';

/**
 * render-design-sheets.js — 角色三视图设计图（character sheet）批量渲染
 *
 * 用途：为热门角色生成 front / side / back 三视角的人物设计图基线，
 *       供 H3 视频创作当「2D 设定图 → 3D 模型」流程中的设定图使用。
 *
 * 数据源：
 *   - data/character-reference-view.json     任务事实源（哪些 design 条目还是 pending）
 *   - data/character-reference-standards.json 提示词素材（identityTokens + outfit.tokens）
 * 输出：E:/code/2/lora/AI/CharacterReferences/<角色>/[<服装>/]ref_design_<view>.png
 *
 * 增量与断点续跑：默认只跑 view.json 中 pending 的 design 条目；目标文件已存在则跳过；
 *   --all 强制重跑（同条目同 seed，可复现；要变体请加 --seed-shift）。
 * 稳定 seed：sha1(角色/服装/视角) 派生，同一条目任何时候重跑都得到同一张图。
 *
 * 引擎与参数（与 2026-08-30 首轮 153 张基线一致）：
 *   anima-aesthetic-v1.1 + qwen_3_06b CLIP + qwen_image_vae，
 *   960×1536，30 steps res_multistep，CFG 4.5，ImageSharpenKJ RCAS 0.75。
 *
 * 用法：
 *   node scripts/maintenance/render-design-sheets.js [--chars=a,b] [--outfits=x,y]
 *        [--views=front,side,back] [--all] [--dry-run] [--limit=N] [--seed-shift=N]
 *   --chars/--outfits/--views   按角色/服装/视角过滤（不传 = 全部）
 *   --all                       强制重跑已生成的条目（默认只跑 pending）
 *   --dry-run                   只列出任务不真正出图
 *   --limit=N                   只跑前 N 个任务（试跑）
 *   --seed-shift=N              seed 偏移，用于同条目换变体（默认 0）
 *
 * 环境变量：
 *   COMFY_HOST     默认 http://127.0.0.1:8188
 *   COMFY_OUTPUT   默认 <AI 工作区>/ComfyUI/output
 *   AI_WORKSPACE_ROOT 默认 <项目根>/../AI（参考图根目录所在）
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compress } = require('./precompress.js');

const HOST = process.env.COMFY_HOST || 'http://127.0.0.1:8188';
const ROOT = path.resolve(__dirname, '..', '..');
const VIEW_FILE = path.join(ROOT, 'data', 'character-reference-view.json');
const STANDARDS_FILE = path.join(ROOT, 'data', 'character-reference-standards.json');
const REF_ROOT = process.env.AI_WORKSPACE_ROOT
  ? path.join(process.env.AI_WORKSPACE_ROOT, 'CharacterReferences')
  : path.resolve(ROOT, '..', 'AI', 'CharacterReferences');
const COMFY_OUTPUT = process.env.COMFY_OUTPUT || path.resolve(REF_ROOT, '..', 'ComfyUI', 'output');

const NEGATIVE =
  'worst quality, low quality, lowres, bad anatomy, bad hands, extra fingers, fewer fingers, missing fingers, extra limbs, missing limbs, deformed, mutilated, disfigured, bad proportions, duplicate, cloned face, ugly, blurry, jpeg artifacts, watermark, text, signature, logo, monochrome, grayscale, frame, border, username, artist name, bad_prompt, bad_prompt_version2, bad-hands-5, ng_deepnegative_v1_75t, scenery, cityscape, complex_background';

const VIEWS = {
  front: 'front_view, facing_viewer, looking_at_viewer',
  side: 'side_view, profile',
  back: 'back_view, from_behind',
};
const SHEET =
  'standing, full_body, symmetrical_pose, arms_at_sides, simple_background, plain_background, gray_background, even_lighting, uniform_lighting, character_sheet';

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}
function fail(msg) {
  console.error(`[${new Date().toISOString().slice(11, 19)}] ✗ ${msg}`);
  process.exit(1);
}

// ── CLI 解析 ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`用法: node scripts/maintenance/render-design-sheets.js [选项]

三视图设计图批量渲染（增量默认只跑 view.json 中 pending 的条目，已存在自动跳过）

选项:
  --chars=a,b      只跑指定角色（逗号分隔，默认全部）
  --outfits=x,y    只跑指定服装（逗号分隔，默认全部）
  --views=f,s,b    只跑指定视角 front/side/back（逗号分隔，默认全部）
  --all            强制重跑已生成的条目（同条目同 seed 可复现）
  --dry-run        只列出任务不出图
  --limit=N        只跑前 N 个任务（试跑）
  --seed-shift=N   seed 偏移，同条目换变体用

环境变量: COMFY_HOST / COMFY_OUTPUT / AI_WORKSPACE_ROOT
依赖: ComfyUI http://127.0.0.1:8188（--disable-smart-memory）`);
  process.exit(0);
}
function pick(flag, splitter = ',') {
  const hit = args.find((a) => a.startsWith(flag + '='));
  if (!hit) return null;
  return hit.slice(flag.length + 1).split(splitter).map((s) => s.trim()).filter(Boolean);
}
const charsFilter = pick('--chars');
const outfitsFilter = pick('--outfits');
const viewsFilter = pick('--views');
const all = args.includes('--all');
const dryRun = args.includes('--dry-run');
const limit = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0) || null;
const seedShift = Number((args.find((a) => a.startsWith('--seed-shift=')) || '').split('=')[1] || 0) || 0;

// ── 工具 ─────────────────────────────────────────────────────────────────────
function stableSeed(charId, outfitId, view) {
  const digest = crypto.createHash('sha1').update(`${charId}/${outfitId}/${view}`).digest();
  return (digest.readUInt32BE(0) % 1000000) + seedShift * 1000000;
}

function buildPrompt(identity, outfit, viewTags) {
  return `score_7, score_6, masterpiece, best quality, ${identity}, ${outfit}, ${viewTags}, ${SHEET}`;
}

function buildWorkflow(text, seed) {
  return {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: 'anima-aesthetic-v1.1.safetensors', weight_dtype: 'default' } },
    '2': { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_06b_base.safetensors', type: 'qwen_image' } },
    '3': { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' } },
    '4': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text } },
    '5': { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: NEGATIVE } },
    '6': { class_type: 'EmptyLatentImage', inputs: { width: 960, height: 1536, batch_size: 1 } },
    '7': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0], seed, steps: 30, cfg: 4.5, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1 } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['3', 0] } },
    '35': { class_type: 'ImageSharpenKJ', inputs: { image: ['8', 0], method: 'rcas', 'method.strength': 0.75 } },
    '10': { class_type: 'SaveImage', inputs: { images: ['35', 0], filename_prefix: 'design_batch_tmp' } },
  };
}

async function comfyAlive() {
  try {
    const resp = await fetch(HOST + '/system_stats', { signal: AbortSignal.timeout(5000) });
    return resp.ok;
  } catch {
    return false;
  }
}

/** 提交工作流并等待完成；成功后返回 ComfyUI 保存的输出文件名（精确取自 history，不扫目录）。 */
async function submitAndWait(text, seed) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let resp;
    try {
      resp = await fetch(HOST + '/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildWorkflow(text, seed) }),
      });
    } catch {
      log('  submit 网络错误，重试');
      continue;
    }
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      log('  submit fail: ' + JSON.stringify(data).slice(0, 120));
      continue;
    }
    const id = data.prompt_id;
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const h = await (await fetch(HOST + '/history/' + id)).json();
        const entry = h[id];
        if (!entry) continue;
        if (entry.status && entry.status.completed) {
          const images = entry.outputs && entry.outputs['10'] && entry.outputs['10'].images;
          if (images && images.length) {
            const img = images[0];
            return img.subfolder ? path.join(img.subfolder, img.filename) : img.filename;
          }
          return null;
        }
        if (entry.status && entry.status.status_str === 'error') {
          log('  渲染错误，重试');
          break;
        }
      } catch {
        /* 轮询瞬时错误忽略 */
      }
    }
  }
  return null;
}

/** 把 ComfyUI 输出移到参考图目录（同盘 rename 原子移动，避开 unlink 钩子）。 */
function moveOutput(relFile, destDir, destFile) {
  const src = path.join(COMFY_OUTPUT, relFile);
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destFile);
  try {
    fs.renameSync(src, dest);
  } catch {
    try {
      fs.copyFileSync(src, dest); // 兜底：rename 失败则复制（源文件留待手工清理）
    } catch (e) {
      log('  moveOutput 失败: ' + e.message);
      return false;
    }
  }
  return true;
}

/** 目标文件在参考图根下的相对路径（沿用「有自定义服装目录则用，否则角色根目录」的约定）。 */
function targetRelPath(charId, outfitId, view) {
  const hasCustomDir = fs.existsSync(path.join(REF_ROOT, charId, outfitId));
  return hasCustomDir
    ? path.join(charId, outfitId, `ref_design_${view}.png`)
    : path.join(charId, `ref_design_${view}.png`);
}

// ── 收集任务 ─────────────────────────────────────────────────────────────────
if (!fs.existsSync(VIEW_FILE)) fail('缺 data/character-reference-view.json');
if (!fs.existsSync(STANDARDS_FILE)) fail('缺 data/character-reference-standards.json');

const view = JSON.parse(fs.readFileSync(VIEW_FILE, 'utf8'));
const standards = JSON.parse(fs.readFileSync(STANDARDS_FILE, 'utf8'));
const stdByChar = new Map((standards.characters || []).map((c) => [c.id, c]));

const tasks = [];
const skipped = { existing: 0, missingTokens: 0 };

for (const profile of Object.values(view)) {
  const charId = profile.characterId;
  if (charsFilter && !charsFilter.includes(charId)) continue;
  const stdChar = stdByChar.get(charId);
  const identity = stdChar && (stdChar.identityTokens || []).join(', ');
  for (const o of profile.outfits || []) {
    if (outfitsFilter && !outfitsFilter.includes(o.outfitId)) continue;
    const stdOutfit = stdChar && stdChar.outfits && stdChar.outfits.find((x) => x.id === o.outfitId);
    const outfitTokens = stdOutfit && (stdOutfit.tokens || []).join(', ');
    for (const ref of o.references || []) {
      if (!ref.id || !String(ref.id).startsWith('ref_design_')) continue;
      const viewName = ref.id.replace('ref_design_', '');
      if (viewsFilter && !viewsFilter.includes(viewName)) continue;
      const needRun = all || (ref.pending === true && !ref.url);
      const rel = targetRelPath(charId, o.outfitId, viewName);
      const abs = path.join(REF_ROOT, rel);
      if (!needRun && fs.existsSync(abs)) { skipped.existing++; continue; }
      if (!identity || !outfitTokens) { skipped.missingTokens++; continue; }
      tasks.push({ charId, outfitId: o.outfitId, viewName, identity, outfitTokens, rel, abs });
    }
  }
}

if (dryRun) {
  log(`[dry-run] 待跑 ${tasks.length} 张（跳过：已存在 ${skipped.existing} / 缺 token ${skipped.missingTokens}）`);
  tasks.slice(0, limit || 20).forEach((t, i) =>
    log(`  ${i + 1}. ${t.charId}/${t.outfitId}/${t.viewName} -> ${t.rel}`));
  process.exit(0);
}

async function main() {
  if (!(await comfyAlive())) {
    fail(`ComfyUI 不可达（${HOST}）——请先启动 ComfyUI（--disable-smart-memory）再跑`);
  }
if (!tasks.length) {
  log('没有待跑任务（全部已完成或已被过滤），退出');
  process.exit(0);
}

log(`待跑 ${tasks.length} 张（跳过：已存在 ${skipped.existing} / 缺 token ${skipped.missingTokens}）`);
const slice = limit ? tasks.slice(0, limit) : tasks;
let ok = 0, failCount = 0;

for (const t of slice) {
  const seed = stableSeed(t.charId, t.outfitId, t.viewName);
  const text = buildPrompt(t.identity, t.outfitTokens, VIEWS[t.viewName]);
  log(`▶ ${t.charId}/${t.outfitId}/${t.viewName} (seed ${seed})`);
  const outFile = await submitAndWait(text, seed);
  if (!outFile) {
    log('  ✗ 生成失败');
    failCount++;
    continue;
  }
  const destDir = path.dirname(t.abs);
  if (moveOutput(outFile, destDir, path.basename(t.abs))) {
    ok++;
    log(`  ✓ 已存 ${path.relative(REF_ROOT, t.abs)}`);
  } else {
    log(`  ✗ 未找到输出文件（${outFile}）`);
    failCount++;
  }
}
log(`=== 完成: 本次 ${slice.length} 成功 ${ok} 失败 ${failCount} ===`);

// ── 后处理：view.json pending→url + 重建预压缩产物 ─────────────────────────
try {
  let filled = 0;
  for (const profile of Object.values(view)) {
    for (const o of profile.outfits || []) {
      for (const ref of o.references || []) {
        if (!ref.id || !String(ref.id).startsWith('ref_design_') || !ref.pending) continue;
        const hasCustomDir = fs.existsSync(path.join(REF_ROOT, profile.characterId, o.outfitId));
        const rel = hasCustomDir
          ? `/character-references/${profile.characterId}/${o.outfitId}/${ref.id}.png`
          : `/character-references/${profile.characterId}/${ref.id}.png`;
        if (fs.existsSync(path.join(REF_ROOT, rel.replace(/^\/character-references\//, '')))) {
          ref.url = rel;
          delete ref.pending;
          filled++;
        }
      }
    }
  }
  if (filled) {
    fs.writeFileSync(VIEW_FILE, JSON.stringify(view, null, 2) + '\n', 'utf8');
    const c = compress(VIEW_FILE);
    log(`view.json 已更新: ${filled} 个 design 条目填 url，预压缩产物已重建（br ${c.brotli}B / gz ${c.gzip}B）`);
  } else {
    log('view.json 无新增可填条目');
  }
} catch (e) {
  log('view.json 更新失败: ' + e.message);
}
}

main().catch((e) => fail(e.stack || e.message));
