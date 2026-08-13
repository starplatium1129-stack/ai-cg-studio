#!/usr/bin/env node
/**
 * image-generate.js — 本地文生图 / 图像编辑脚本（CLIProxyAPI + gemini-3.1-flash-image）
 *
 * 通过本地 CLIProxyAPI（OpenAI 兼容 /v1/chat/completions）调用 Gemini 原生图像
 * 生成模型。与 image-inspect.js 共用 VISION_* 环境变量约定：
 *   VISION_BASE_URL（默认 http://127.0.0.1:8317/v1）、VISION_API_KEY、VISION_MODEL。
 *
 * 纯文生图：messages 只带文本，modalities=["text","image"]；
 * 图像编辑（--input）：把原图作为 image_url 输入，prompt 作为编辑指令
 * （Gemini 原生图像编辑，可修复手部/构图/背景等并输出新图）。
 *
 * 注意：Gemini 有内容安全过滤，R18 等敏感内容大概率被拒绝；正式角色图请走
 * Anima/SD 绘图链路（有角色 LoRA），本工具适合概念图、修复示意与快速试验。
 *
 * 用法：
 *   node scripts/maintenance/image-generate.js "<prompt>" [选项]
 *
 * 选项：
 *   -o, --out <文件>       输出文件（默认 generated-<时间戳>.png；--n>1 时作前缀）
 *       --n <count>        生成张数（默认 1）
 *       --input <图片>     图像编辑模式：该图作为输入，prompt 为编辑指令
 *       --aspect <ratio>   目标宽高比（如 16:9、3:4；服务端不支持时忽略）
 *   -m, --model <模型名>   生成模型（默认 gemini-3.1-flash-image）
 *       --max-tokens <n>   单次回答上限（默认 4096）
 *       --timeout <ms>     单次请求超时（默认 300000，图像生成较慢）
 *   -h, --help             显示帮助
 *
 * 环境变量（可选覆盖）：VISION_BASE_URL / VISION_API_KEY / VISION_MODEL
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const DEFAULT_BASE_URL = process.env.VISION_BASE_URL || 'http://127.0.0.1:8317/v1';
const DEFAULT_API_KEY = process.env.VISION_API_KEY || 'sk-local-proxy-key-2024';
const DEFAULT_MODEL = process.env.VISION_MODEL || 'gemini-3.1-flash-image';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

function printHelp() {
  console.log(`用法：node ${path.basename(process.argv[1])} "<prompt>" [选项]

通过本地 CLIProxyAPI 调用 gemini-3.1-flash-image 生成/编辑图片。

选项：
  -o, --out <文件>       输出文件（默认 generated-<时间戳>.png；--n>1 时作前缀）
      --n <count>        生成张数（默认 1）
      --input <图片>     图像编辑模式：该图作为输入，prompt 为编辑指令
      --aspect <ratio>   目标宽高比（如 16:9、3:4；服务端不支持时忽略）
  -m, --model <模型名>   生成模型（默认 ${DEFAULT_MODEL}）
      --max-tokens <n>   单次回答上限（默认 4096）
      --timeout <ms>     单次请求超时（默认 300000）
  -h, --help             显示帮助

环境变量（可选覆盖）：VISION_BASE_URL / VISION_API_KEY / VISION_MODEL
示例：
  node scripts/maintenance/image-generate.js "anime girl with white hair under cherry blossoms, warm evening light"
  node scripts/maintenance/image-generate.js "fix the left hand: fingers should not be merged" --input bad.png -o fixed.png
  node scripts/maintenance/image-generate.js "wallpaper concept, night city neon" --n 3 --aspect 16:9 -o concept.png`);
}

function parseArgs(argv) {
  const opts = {
    prompt: null, out: null, n: 1, input: null, aspect: null,
    model: null, maxTokens: 4096, timeoutMs: 300000, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '-o': case '--out': opts.out = next(); break;
      case '--n': opts.n = Number(next()); break;
      case '--input': opts.input = next(); break;
      case '--aspect': opts.aspect = next(); break;
      case '-m': case '--model': opts.model = next(); break;
      case '--max-tokens': opts.maxTokens = Number(next()); break;
      case '--timeout': opts.timeoutMs = Number(next()); break;
      case '-h': case '--help': opts.help = true; break;
      default:
        if (a.startsWith('-')) {
          console.error(`[错误] 未知选项: ${a}（--help 查看用法）`);
          process.exit(2);
        }
        if (opts.prompt === null) opts.prompt = a;
        else opts.prompt += ' ' + a;
    }
  }
  return opts;
}

function httpJson(method, urlPath, body, opts) {
  return new Promise((resolve, reject) => {
    const url = new URL(DEFAULT_BASE_URL + urlPath);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: url.hostname, port: url.port || 80, path: url.pathname, method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEFAULT_API_KEY}`,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(d); } catch { /* raw below */ }
        if (res.statusCode >= 200 && res.statusCode < 300 && json) return resolve(json);
        const detail = json && json.error ? JSON.stringify(json.error) : d.slice(0, 600);
        reject(new Error(`HTTP ${res.statusCode}: ${detail}`));
      });
    });
    req.setTimeout(opts.timeoutMs, () => req.destroy(new Error(`请求超时（${opts.timeoutMs}ms）`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function imageDataUrl(file) {
  const ext = path.extname(file).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return 'data:image/' + mime + ';base64,' + fs.readFileSync(file).toString('base64');
}

/** 从响应 message.images 提取 base64 图片数组；兼容 data URL 与裸 base64。 */
function extractImages(message) {
  const out = [];
  if (message && Array.isArray(message.images)) {
    for (const img of message.images) {
      const u = img && img.image_url && img.image_url.url;
      if (typeof u === 'string' && u.length > 0) {
        out.push({ mime: 'image/png', b64: u.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '') });
      }
    }
  }
  return out;
}

async function generate(opts) {
  const content = [{ type: 'text', text: opts.prompt }];
  if (opts.input) {
    if (!fs.existsSync(opts.input)) throw new Error(`输入图片不存在: ${opts.input}`);
    content.push({ type: 'image_url', image_url: { url: imageDataUrl(opts.input) } });
  }
  const body = {
    model: opts.model || DEFAULT_MODEL,
    messages: [{ role: 'user', content }],
    modalities: ['text', 'image'],
    max_tokens: opts.maxTokens,
  };
  if (opts.aspect) {
    // Gemini 原生 aspectRatio 经 generationConfig 传递；代理不支持时忽略该参数
    body.generationConfig = { aspectRatio: opts.aspect };
  }
  const j = await httpJson('POST', '/chat/completions', body, opts);
  const msg = j && j.choices && j.choices[0] && j.choices[0].message;
  if (!msg) throw new Error('响应缺少 message: ' + JSON.stringify(j).slice(0, 300));
  const text = typeof msg.content === 'string' ? msg.content : '';
  const images = extractImages(msg);
  if (images.length === 0) {
    // 部分代理把图放在 content 数组的 image_url 项里
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part && part.type === 'image_url' && part.image_url && part.image_url.url) {
          images.push({ mime: 'image/png', b64: part.image_url.url.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '') });
        }
      }
    }
  }
  return { text, images };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { printHelp(); return; }
  if (opts.prompt === null || opts.prompt.trim() === '') {
    console.error('[错误] 缺少 prompt（--help 查看用法）');
    process.exit(2);
  }
  if (!Number.isFinite(opts.n) || opts.n < 1 || opts.n > 4) {
    console.error('[错误] --n 需为 1-4 的整数');
    process.exit(2);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = opts.out || `generated-${stamp}.png`;
  const baseNoExt = base.replace(/\.(png|jpg|jpeg|webp)$/i, '');

  console.log(`[生成] model=${opts.model || DEFAULT_MODEL}${opts.input ? ' 编辑模式 input=' + opts.input : ''} n=${opts.n}`);
  console.log(`[prompt] ${opts.prompt}`);
  let attempt = 0;
  let lastErr = null;
  let result = null;
  while (attempt < 2) {
    if (attempt > 0) {
      console.error(`[重试 ${attempt}]（等待 3s）`);
      await new Promise(r => setTimeout(r, 3000));
    }
    try {
      result = await generate(opts);
      break;
    } catch (e) {
      lastErr = e;
      // location 错误（Google 区域限制）是间歇性的：上游出口节点波动时偶发，
      // 实测重试可成功；5xx/超时/连接错误同理可重试。
      const retriable = /HTTP 5\d\d/.test(e.message) || /超时/.test(e.message) || /ECONN|EPIPE|ETIMEDOUT/.test(e.message) || /location is not supported/.test(e.message);
      if (!retriable) break;
    }
    attempt++;
  }
  if (!result) {
    console.error('[失败] ' + (lastErr ? lastErr.message : '未知错误'));
    process.exit(1);
  }
  if (result.text) console.log(`[说明] ${result.text.slice(0, 500)}`);
  if (result.images.length === 0) {
    console.error('[失败] 响应中没有图片（模型可能拒绝了该 prompt 或代理不支持 image modality）');
    process.exit(1);
  }
  for (let i = 0; i < result.images.length; i++) {
    const file = result.images.length === 1 ? base : `${baseNoExt}-${i + 1}.png`;
    fs.writeFileSync(file, Buffer.from(result.images[i].b64, 'base64'));
    console.log(`[保存] ${file} (${fs.statSync(file).size} bytes)`);
  }
}

main().catch(e => {
  console.error('[失败] ' + (e && e.message || e));
  process.exitCode = 1;
});
