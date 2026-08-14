#!/usr/bin/env node
/**
 * image-inspect.js — 通用识图脚本（本地视觉模型）
 *
 * 通过本地 CLIProxyAPI（OpenAI 兼容 /v1/chat/completions）调用视觉模型识别本地图片，
 * 等价于 opencode 配置中的 vision / gemini-vision agent（gemini-3.7-flash-high）。
 * 零第三方依赖，只使用 Node 内置模块。
 *
 * 用法：
 *   node scripts/maintenance/image-inspect.js <图片|目录>... [选项]
 *
 * 选项：
 *   -t, --task <describe|audit|ocr|score>  任务预设（默认 describe）
 *   -p, --prompt "<文本>"                   自定义提示词（覆盖任务预设）
 *   -m, --model <模型名>                    视觉模型（默认 gemini-3.7-flash-high）
 *       --mode <each|group>                 each=逐张独立请求（默认）；group=多图合并一次请求
 *   -o, --out <文件>                        结果写入 Markdown 文件
 *       --json                              stdout 只输出 JSON 结果
 *       --max-tokens <n>                    单次回答上限（默认 4000）
 *       --timeout <ms>                      单次请求超时（默认 180000）
 *   -h, --help                              显示帮助
 *
 * 环境变量（可选覆盖）：VISION_BASE_URL / VISION_API_KEY / VISION_MODEL
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const DEFAULT_BASE_URL = process.env.VISION_BASE_URL || 'http://127.0.0.1:8317/v1';
const DEFAULT_API_KEY = process.env.VISION_API_KEY || 'sk-local-proxy-key-2024';
const DEFAULT_MODEL = process.env.VISION_MODEL || 'gemini-3.7-flash-high';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // base64 后 ≈20MB，对齐 opencode attachment 上限

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

const TASKS = {
  describe:
    '请详细、准确地描述这张图片的内容：主体、人物、场景、构图、色彩、光照、风格与氛围；' +
    '画面中的文字请一并转录。请用中文回答。',
  audit:
    '你是资深二次元 AI 绘画项目主审，审核标准对齐项目展示集定稿样张水准。审核必须同时覆盖【人物细节】与【整体画面】两类维度，规则严格遵守：\n' +
    '【判定铁律】出现以下任一硬伤，结论必须为「不通过」：\n' +
    '  a. 手指/手掌结构崩坏、明显粘连或数量错误；\n' +
    '  b. 五官崩坏、错位或表情僵硬失真；\n' +
    '  c. 肢体缺失、比例严重错误、姿势扭曲僵硬或透视错误；\n' +
    '  d. 服装穿模、错乱或与角色设定冲突；\n' +
    '  e. 双人图两人特征/服装互相串位（双人图必查）；\n' +
    '  f. 明显伪影、异物悬浮、水印或乱码文字。\n' +
    '无硬伤但存在明显可提升项（细节含糊、构图平庸、氛围平淡、背景空泛）⇒「需复核」；无硬伤且整体达到定稿水准 ⇒「通过」。不得用「需复核」为硬伤开脱。\n' +
    '【量化打分】八维各 0-10 分（满分 80）：\n' +
    '  1. 身份特征还原（发型/发色/瞳色/标志性装饰与设定一致）\n' +
    '  2. 脸部与神态（五官精致度、表情自然度、神态传达与情绪契合）\n' +
    '  3. 服装（款式/配色/细节完整度）\n' +
    '  4. 肢体结构与姿势（结构正确性、姿势动态自然度与表现力、透视）\n' +
    '  5. 构图（取景、主体位置、平衡、节奏、留白、景深层次）\n' +
    '  6. 背景与细节（背景实体感、细节丰富度、前后景层次、物体合理性）\n' +
    '  7. 光影与氛围（光照逻辑、明暗层次、氛围营造、通透度）\n' +
    '  8. 完成度与叙事（整体完成度、场景叙事成立、画面感染力）\n' +
    '存在硬伤时总分强制 ≤48。\n' +
    '【禁止含糊】每个问题必须给出具体位置（如"画面右侧，人物左手小指与无名指粘连"）与修复方向；不得使用"略有""似乎""可能"等模糊措辞。\n' +
    '【输出格式】每张图严格按以下结构：\n' +
    '  结论：通过 / 需复核 / 不通过\n' +
    '  各维度评分：维度 | 分数 | 一句话依据（八维全列）\n' +
    '  问题清单：位置 + 问题 + 修复方向（无则写"无"；人物细节与整体画面问题都算）\n' +
    '  总评：一句话（点出该图最强的维度和最拖后腿的维度）\n' +
    '宁可多标问题，不可放过硬伤；请用中文回答。',
  ocr:
    '请识别这张图片中的全部文字，按出现位置整理输出；若图片不含文字请明确说明。请用中文回答。',
  score:
    '请按以下维度为这张图片打分（每维 0-20，满分 100）：光影通透、背景实体感、角色服装发型细节、氛围、完成度。' +
    '输出各维度分数、总分与一句总评。请用中文回答。',
};

function printHelp() {
  console.log(`用法：node ${path.basename(process.argv[1])} <图片|目录>... [选项]

通过本地 CLIProxyAPI 调用视觉模型识别图片（等价于 opencode 的 vision agent）。

选项：
  -t, --task <describe|audit|ocr|score>  任务预设（默认 describe）
  -p, --prompt "<文本>"                   自定义提示词（覆盖任务预设）
  -e, --expect "<预期>"                   audit 任务专用：预期内容（提示词），审核时判断画面是否符合
  -m, --model <模型名>                    视觉模型（默认 ${DEFAULT_MODEL}）
      --mode <each|group>                 each=逐张独立请求（默认）；group=多图合并一次请求
  -o, --out <文件>                        结果写入 Markdown 文件
      --json                              stdout 只输出 JSON 结果
      --max-tokens <n>                    单次回答上限（默认 4000）
      --timeout <ms>                      单次请求超时（默认 180000）
  -h, --help                              显示帮助

环境变量（可选覆盖）：VISION_BASE_URL / VISION_API_KEY / VISION_MODEL
示例：
  node scripts/maintenance/image-inspect.js out.png
  node scripts/maintenance/image-inspect.js AI/Reviews/SceneFix/sc001 -t audit -o audit.md
  node scripts/maintenance/image-inspect.js a.png b.png --mode group -p "对比两张图并说明差异"`);
}

function parseArgs(argv) {
  const opts = {
    task: 'describe', mode: 'each', model: null, prompt: null, expect: null,
    out: null, json: false, maxTokens: 4000, timeoutMs: 180000, help: false, paths: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '-t': case '--task': opts.task = next(); break;
      case '-p': case '--prompt': opts.prompt = next(); break;
      case '-e': case '--expect': opts.expect = next(); break;
      case '-m': case '--model': opts.model = next(); break;
      case '--mode': opts.mode = next(); break;
      case '-o': case '--out': opts.out = next(); break;
      case '--json': opts.json = true; break;
      case '--max-tokens': opts.maxTokens = Number(next()); break;
      case '--timeout': opts.timeoutMs = Number(next()); break;
      case '-h': case '--help': opts.help = true; break;
      default:
        if (a.startsWith('-')) {
          console.error(`[错误] 未知选项: ${a}（--help 查看用法）`);
          process.exit(2);
        }
        opts.paths.push(a);
    }
  }
  return opts;
}

function collectImages(inputs) {
  const files = [];
  for (const p of inputs) {
    if (!fs.existsSync(p)) { console.error(`[错误] 路径不存在: ${p}`); continue; }
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) {
        const full = path.join(p, f);
        if (!IMAGE_EXT.has(path.extname(f).toLowerCase())) continue;
        if (fs.statSync(full).isFile()) files.push({ file: full, size: fs.statSync(full).size });
      }
      files.sort((a, b) => a.file.localeCompare(b.file));
    } else if (st.isFile()) {
      files.push({ file: p, size: st.size });
    }
  }
  return files;
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

async function chatCompletion(messages, opts, model) {
  return httpJson('POST', '/chat/completions', {
    model,
    messages,
    max_tokens: opts.maxTokens,
  }, opts);
}

function imageUrl(file) {
  const ext = path.extname(file).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return 'data:image/' + mime + ';base64,' + fs.readFileSync(file).toString('base64');
}

async function requestWithRetry(messages, opts, model, file) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.error(`[重试 ${attempt}] ${file || 'group'}（等待 2s）`);
      await new Promise(r => setTimeout(r, 2000));
    }
    try {
      const j = await chatCompletion(messages, opts, model);
      const content = j.choices && j.choices[0] && j.choices[0].message
        ? j.choices[0].message.content
        : JSON.stringify(j).slice(0, 800);
      return { ok: true, content };
    } catch (e) {
      lastErr = e;
      const retriable = /HTTP 5\d\d/.test(e.message) || /超时/.test(e.message) || /ECONN|EPIPE|ETIMEDOUT/.test(e.message);
      if (!retriable) break;
    }
  }
  return { ok: false, content: null, error: lastErr.message };
}

function buildTextAndImages(prompt, files, labeled) {
  const text = labeled
    ? `${prompt}\n\n本次共 ${files.length} 张图片，请严格按编号逐一分析，不要遗漏。`
    : prompt;
  const content = [{ type: 'text', text }];
  files.forEach((f, i) => {
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl(f.file) },
    });
    if (labeled) {
      content.push({ type: 'text', text: `图片 ${i + 1}: ${f.file}` });
    }
  });
  return content;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { printHelp(); return; }
  if (opts.paths.length === 0) {
    console.error('[错误] 至少需要一个图片路径或目录（--help 查看用法）');
    process.exit(2);
  }
  if (!['each', 'group'].includes(opts.mode)) {
    console.error(`[错误] --mode 只支持 each 或 group，收到: ${opts.mode}`);
    process.exit(2);
  }
  const taskPrompt = opts.prompt || TASKS[opts.task];
  if (!taskPrompt) {
    console.error(`[错误] 未知任务: ${opts.task}（describe|audit|ocr|score）`);
    process.exit(2);
  }
  const finalPrompt = (opts.task === 'audit' && opts.expect)
    ? `${taskPrompt}\n【预期内容】${opts.expect}\n审核时先判断画面是否符合预期（人物、服装、姿势、构图、环境），不符合预期本身也要作为问题列出。`
    : taskPrompt;

  const files = collectImages(opts.paths);
  if (files.length === 0) {
    console.error('[错误] 没有找到可识别的图片');
    process.exit(2);
  }
  const model = opts.model || DEFAULT_MODEL;
  const results = [];
  const skipped = [];

  if (opts.mode === 'group') {
    const tooBig = files.find(f => f.size > MAX_IMAGE_BYTES);
    if (tooBig) {
      console.error(`[错误] group 模式图片过大（>${MAX_IMAGE_BYTES / 1024 / 1024}MB）: ${tooBig.file}`);
      process.exit(2);
    }
    console.error(`[识图] ${files.length} 张图 → ${model}（group）`);
    const content = buildTextAndImages(finalPrompt, files, true);
    const r = await requestWithRetry([{ role: 'user', content }], opts, model, files.map(f => f.file).join('; '));
    results.push({
      mode: 'group',
      model,
      prompt: taskPrompt,
      files: files.map(f => f.file),
      ok: r.ok,
      content: r.content,
      error: r.error || null,
    });
  } else {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.size > MAX_IMAGE_BYTES) {
        console.error(`[跳过] 图片过大（>${MAX_IMAGE_BYTES / 1024 / 1024}MB）: ${f.file}`);
        skipped.push(f.file);
        results.push({ mode: 'each', model, file: f.file, ok: false, content: null, error: '图片过大被跳过' });
        continue;
      }
      console.error(`[识图 ${i + 1}/${files.length}] ${f.file} → ${model}`);
      const content = [
        { type: 'text', text: `${finalPrompt}\n\n图片文件：${f.file}` },
        { type: 'image_url', image_url: { url: imageUrl(f.file) } },
      ];
      const r = await requestWithRetry([{ role: 'user', content }], opts, model, f.file);
      results.push({ mode: 'each', model, file: f.file, ok: r.ok, content: r.content, error: r.error || null });
    }
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      const label = r.mode === 'group' ? `[group] ${r.files.length} 张图` : r.file;
      console.log(`\n===== ${label} =====`);
      if (r.ok) console.log(r.content);
      else console.error(`[失败] ${r.error}`);
    }
  }
  if (opts.out) {
    const md = results.map(r => {
      const title = r.mode === 'group'
        ? `## Group（${r.files.length} 张图）\n\n${r.files.map(f => `- \`${f}\``).join('\n')}`
        : `## ${r.file}`;
      return `${title}\n\n${r.ok ? r.content : `> 失败：${r.error}`}\n`;
    }).join('\n');
    fs.writeFileSync(opts.out, md, 'utf8');
    console.error(`[已写入] ${opts.out}`);
  }

  const failed = results.filter(r => !r.ok).length;
  if (skipped.length) console.error(`[跳过] ${skipped.length} 张（图片过大）`);
  process.exit(failed ? 1 : 0);
}

if (require.main === module) {
  main().catch(function (error) { console.error('[错误]', error.message); process.exit(1); });
}

module.exports = {
  TASKS: TASKS,
  DEFAULT_BASE_URL: DEFAULT_BASE_URL,
  DEFAULT_API_KEY: DEFAULT_API_KEY,
  DEFAULT_MODEL: DEFAULT_MODEL,
  MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
  imageUrl: imageUrl,
  chatCompletion: chatCompletion,
  requestWithRetry: requestWithRetry,
};
