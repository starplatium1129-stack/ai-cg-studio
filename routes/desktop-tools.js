'use strict';

/**
 * 桌宠本地工具执行器（从 desktop/toolRunner.ts 下沉到网关的 CJS 版）。
 *
 * 安全边界（与 toolRunner.ts 一致）：
 * - localOnly：仅本机可调（与 /api/training 同级别）。
 * - 所有路径解析后必须落在 AI 工作区（AI_WORKSPACE_ROOT）内（Windows 大小写不敏感）。
 * - 命令以参数数组 execFile 执行，不经过 shell —— 没有 `;`/`|`/`&&` 注入面。
 * - 命令名白名单（python/pwsh/node/git 等解释器）或工作区内脚本的相对路径，
 *   禁止任意系统可执行文件（2026-08-16 审计：此前无白名单，模型工具调用
 *   可在本机执行任意命令；配合 chat 的 companionTools 仅本机放行，双保险）。
 * - 读 1MB / 写 512KB / 命令 120s 超时 + 64KB 输出上限。
 */

var express = require('express');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var crypto = require('crypto');
var envelope = require('../server/http-envelope');

var MAX_READ_BYTES = 1024 * 1024;
var MAX_WRITE_BYTES = 512 * 1024;
var MAX_COMMAND_OUTPUT = 64 * 1024;
var COMMAND_TIMEOUT_MS = 120 * 1000;
var MAX_DISPLAY_CHARS = 500 * 1000;
var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
var IMAGE_MAGIC = [
  { magic: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { magic: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { magic: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },
  { magic: [0x47, 0x49, 0x46], mime: 'image/gif' },
];

/** run_command 白名单：只有这些解释器/常用工具可以裸名执行。 */
var ALLOWED_COMMANDS = Object.freeze(new Set([
  'python', 'python3', 'pythonw', 'pwsh', 'powershell',
  'node', 'npm', 'npx', 'git', 'conda',
].map(function (name) { return name.toLowerCase(); })));

/**
 * 成人内容白名单（AGENTS.md 红线 #4 的网关侧落地，与前端 popularContent.ts
 * 的 adultEligibility 契约同源）：仅内容契约中确认成人的角色可注入裸露 token
 * （宁宁/夏目，对应 nene_r18/natsume_r18 门控词）。未知角色一律 fail-closed 拒绝。
 * adultEnabled 则必须来自传输层显式授权（请求体顶层字段，由前端本机环境开关派生），
 * 模型在 args 里自行声明无效 —— 双门齐备才放行。
 */
var ADULT_ELIGIBLE_CHARACTERS = Object.freeze(new Set(['nene', 'natsume']));

var ADULT_NOT_ELIGIBLE_MESSAGE = '该角色未登记为成人内容白名单（fail-closed），已拒绝 R18 参数；请用普通服装重试。';
var ADULT_NOT_ENABLED_MESSAGE = '成人内容未获本机授权（adultEnabled !== true），已拒绝 R18 参数；请用普通服装重试。';

/**
 * R18 双门校验：返回 null 表示放行，否则返回带 code 的拒绝结果。
 * @param {string} targetChar 归一化后的角色 ID
 * @param {{adultEnabled?: boolean}} [context] 传输层授权上下文
 */
function assertAdultAllowed(targetChar, context) {
  if (!ADULT_ELIGIBLE_CHARACTERS.has(String(targetChar || '').toLowerCase())) {
    return { code: 'adult_character_not_eligible', message: ADULT_NOT_ELIGIBLE_MESSAGE };
  }
  if (!context || context.adultEnabled !== true) {
    return { code: 'adult_not_enabled', message: ADULT_NOT_ENABLED_MESSAGE };
  }
  return null;
}

/**
 * run_command 命令校验收紧：裸命令必须是白名单解释器；含路径分隔符时必须
 * 是工作区内脚本的相对路径（禁止绝对路径与 `..` 穿越）。都是参数数组 execFile，
 * 无 shell 注入面。
 */
function assertSafeCommand(root, command) {
  var value = String(command || '').trim();
  if (!value) throw new Error('缺少命令');
  var hasPathSeparator = /[/\\]/.test(value);
  if (!hasPathSeparator) {
    var base = value.replace(/\.exe$/i, '').toLowerCase();
    if (ALLOWED_COMMANDS.has(base)) return value;
    throw new Error('命令不在允许列表（python/pwsh/node/npm/npx/git/conda）或缺少工作区内脚本相对路径');
  }
  if (/^[a-zA-Z]:/.test(value) || value.startsWith('/') || value.startsWith('\\')) {
    throw new Error('只接受工作区内的相对脚本路径');
  }
  if (value.split(/[\\/]/).some(function (part) { return part === '..'; })) {
    throw new Error('脚本路径不能包含 ..');
  }
  var resolved = path.resolve(root, value);
  if (!isPathInsideWorkspace(root, resolved)) {
    throw new Error('脚本路径超出 AI 工作区范围');
  }
  return value;
}

function sniffImageMime(buffer) {
  for (var i = 0; i < IMAGE_MAGIC.length; i += 1) {
    var candidate = IMAGE_MAGIC[i];
    var match = candidate.magic.every(function (byte, index) {
      return buffer[index] === byte;
    });
    if (match) return candidate.mime;
  }
  return null;
}

function isPathInsideWorkspace(workspaceRoot, candidate) {
  var root = path.resolve(workspaceRoot);
  var resolved = path.resolve(candidate);
  var rootKey = root.toLowerCase();
  var resolvedKey = resolved.toLowerCase();
  if (resolvedKey === rootKey) return true;
  return resolvedKey.startsWith(rootKey + path.sep.toLowerCase());
}

function resolveWorkspacePath(workspaceRoot, relative) {
  var root = path.resolve(workspaceRoot);
  var clean = String(relative || '').trim().replace(/\\/g, '/');
  if (!clean || clean === '.') return root;
  if (clean.startsWith('/') || /^[a-zA-Z]:/.test(clean)) {
    throw new Error('只接受工作区内的相对路径');
  }
  if (clean.split('/').some(function (part) { return part === '..'; })) {
    throw new Error('路径不能包含 ..');
  }
  var resolved = path.resolve(root, clean);
  if (!isPathInsideWorkspace(root, resolved)) {
    throw new Error('路径超出 AI 工作区范围');
  }
  return resolved;
}

function formatEntryName(entry) {
  return entry.isDirectory() ? entry.name + '/' : entry.name;
}

function runTool(workspaceRoot, name, args, context) {
  var root = path.resolve(workspaceRoot || '.');
  function fail(error) {
    var message = String(error instanceof Error ? error.message : error).slice(0, 2000);
    var payload = { ok: false, output: message };
    // 信封对齐（server/http-envelope.js 形状）：error/msg 与 output 同镜像，
    // 新代码读 error；output 保留 —— 它会作为 tool 消息回传给对话模型。
    payload.error = message;
    payload.msg = message;
    if (error instanceof Error && error.code) payload.code = error.code;
    return payload;
  }
  return Promise.resolve().then(function () {
    switch (name) {
      case 'list_files': {
        var dir = resolveWorkspacePath(root, String(args.path || ''));
        return fs.promises.readdir(dir, { withFileTypes: true })
          .then(function (entries) {
            var rows = entries
              .sort(function (a, b) {
                return a.isDirectory() === b.isDirectory()
                  ? a.name.localeCompare(b.name)
                  : a.isDirectory() ? -1 : 1;
              })
              .slice(0, 200)
              .map(function (entry) {
                var extra = '';
                if (!entry.isDirectory()) {
                  try {
                    var stat = fs.statSync(path.join(dir, entry.name));
                    extra = ' (' + stat.size + ' B)';
                  } catch (e) { /* 忽略瞬时不可读 */ }
                }
                return formatEntryName(entry) + extra;
              });
            var count = entries.length > 200
              ? '（前 200 项，共 ' + entries.length + ' 项）'
              : '共 ' + entries.length + ' 项';
            return { ok: true, output: '[' + dir + ']\n' + (rows.join('\n') || '(空目录)') + '\n' + count };
          })
          .catch(function (error) {
            throw new Error('目录不存在或不可读：' + String(error.message || error));
          });
      }
      case 'read_file': {
        var file = resolveWorkspacePath(root, String(args.path || ''));
        return fs.promises.stat(file).then(function (stat) {
          if (!stat.isFile()) throw new Error('目标不是文件');
          if (stat.size > MAX_READ_BYTES) throw new Error('文件超过 ' + (MAX_READ_BYTES / 1024) + 'KB 读取上限');
          return fs.promises.readFile(file);
        }).then(function (buffer) {
          if (buffer.includes(0)) throw new Error('看起来是二进制文件，不读取');
          var text = buffer.toString('utf8');
          if (text.length > MAX_DISPLAY_CHARS) text = text.slice(0, MAX_DISPLAY_CHARS) + '\n…（内容已截断）';
          return { ok: true, output: text };
        });
      }
      case 'write_file': {
        var writeFile = resolveWorkspacePath(root, String(args.path || ''));
        var content = String(args.content || '');
        if (content.length > MAX_WRITE_BYTES) throw new Error('内容超过 ' + (MAX_WRITE_BYTES / 1024) + 'KB 写入上限');
        return fs.promises.mkdir(path.dirname(writeFile), { recursive: true })
          .then(function () {
            var temporary = writeFile + '.' + process.pid + '-' + crypto.randomBytes(4).toString('hex') + '.tool.tmp';
            return fs.promises.writeFile(temporary, content, 'utf8')
              .then(function () { return fs.promises.rename(temporary, writeFile); });
          })
          .then(function () {
            return { ok: true, output: '已写入 ' + (path.relative(root, writeFile) || path.basename(writeFile)) + '（' + content.length + ' 字符）' };
          });
      }
      case 'run_command': {
        var command = String(args.command || '').trim();
        var rawArgs = Array.isArray(args.args) ? args.args.map(String) : [];
        if (!command) throw new Error('缺少命令');
        // 2026-08-16 审计：命令校验收紧——白名单解释器或工作区内相对脚本。
        assertSafeCommand(root, command);
        if (command.length > 256) throw new Error('命令名过长');
        if (rawArgs.length > 16) throw new Error('参数过多');
        if (rawArgs.some(function (arg) { return arg.length > 256; })) throw new Error('参数过长');
        return new Promise(function (resolve, reject) {
          cp.execFile(command, rawArgs, {
            cwd: root,
            timeout: COMMAND_TIMEOUT_MS,
            maxBuffer: MAX_COMMAND_OUTPUT,
            windowsHide: true,
            env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }),
          }, function (error, stdout, stderr) {
            var combined = String(stdout || '') + String(stderr || '');
            combined = combined.trim();
            if (error && !combined) {
              reject(new Error('命令执行失败：' + error.message));
              return;
            }
            resolve({ ok: true, output: combined || '（命令已执行，无输出）' });
          });
        });
      }
      case 'read_image': {
        var imageFile = resolveWorkspacePath(root, String(args.path || ''));
        return fs.promises.stat(imageFile).then(function (stat) {
          if (!stat.isFile()) throw new Error('目标不是文件');
          if (stat.size > MAX_IMAGE_BYTES) throw new Error('图片超过 ' + (MAX_IMAGE_BYTES / 1024 / 1024) + 'MB 上限');
          return fs.promises.readFile(imageFile);
        }).then(function (buffer) {
          var mime = sniffImageMime(buffer);
          if (!mime) throw new Error('不支持的文件格式（仅 PNG / JPEG / WebP / GIF）');
          return {
            ok: true,
            output: '已读取图片 ' + (path.relative(root, imageFile) || path.basename(imageFile)) + '（' + buffer.length + ' B，' + mime.replace('image/', '') + '）',
            imageDataUrl: 'data:' + mime + ';base64,' + buffer.toString('base64'),
          };
        });
      }
      case 'get_workspace_info': {
        var exists = fs.existsSync(root);
        return { ok: true, output: JSON.stringify({ workspaceRoot: root, exists: exists, os: process.platform }) };
      }
      case 'capture_screen': {
        if (process.platform !== 'win32') {
          throw new Error('当前系统暂不支持原生屏幕截取');
        }
        var psScript = [
          'Add-Type -AssemblyName System.Windows.Forms, System.Drawing',
          '$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
          '$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height',
          '$g = [System.Drawing.Graphics]::FromImage($bmp)',
          '$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)',
          '$ms = New-Object System.IO.MemoryStream',
          '$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)',
          '$bytes = $ms.ToArray()',
          '$g.Dispose()',
          '$bmp.Dispose()',
          '$ms.Dispose()',
          '[System.Convert]::ToBase64String($bytes)'
        ].join('\n');

        return new Promise(function (resolve, reject) {
          cp.execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
            windowsHide: true,
            maxBuffer: 20 * 1024 * 1024,
            timeout: 10000,
          }, function (err, stdout, stderr) {
            if (err) return reject(new Error('截屏执行失败：' + (stderr || err.message)));
            var base64 = String(stdout || '').trim();
            if (!base64) return reject(new Error('未捕获到屏幕数据'));
            resolve({
              ok: true,
              output: '已成功捕获当前桌面屏幕画面（' + Math.round(base64.length * 0.75 / 1024) + ' KB JPEG）',
              imageDataUrl: 'data:image/jpeg;base64,' + base64,
            });
          });
        });
      }
      case 'generate_character_image': {
        var char = String(args.character || 'natsume').toLowerCase().trim();
        var desc = String(args.description || '').trim();
        if (!desc) throw new Error('缺少画面描述（description）');

        var isNatsume = char.includes('natsume') || char.includes('夏目');
        var isNene = char.includes('nene') || char.includes('宁宁');
        var targetChar = isNatsume ? 'natsume' : (isNene ? 'nene' : char);

        var promptTokens = [];
        var loras = [];

        if (targetChar === 'natsume') {
          promptTokens.push('shiki_natsume', '1girl', 'solo', 'mole under right eye');
          loras.push({ id: 'L_NAT_V21_ANIMA', strength: 0.85 });
        } else if (targetChar === 'nene') {
          promptTokens.push('ayachi_nene', '1girl', 'solo', 'ahoge', 'mole under left eye');
          loras.push({ id: 'L_NENE_V21_ANIMA', strength: 0.85 });
        } else {
          promptTokens.push(targetChar, '1girl', 'solo');
        }

        var wantsMature = args.outfit === 'nsfw_nude' || args.mature === true;
        if (wantsMature) {
          // R18 双门（fail-closed）：adultEligibility 白名单 × 传输层 adultEnabled 授权。
          // 任一不满足即整体拒绝 —— 不回退到安全 token，也不写入任何生成元数据。
          var denial = assertAdultAllowed(targetChar, context);
          if (denial) {
            var refusal = new Error(denial.message);
            refusal.code = denial.code;
            throw refusal;
          }
          promptTokens.push('completely naked', 'full body bare', 'natural skin');
        } else if (args.outfit && typeof args.outfit === 'string') {
          promptTokens.push(args.outfit);
        }

        promptTokens.push(desc);
        var outDir = path.join(root, 'generated-images');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        var timestamp = Date.now();
        var fileName = 'companion_' + targetChar + '_' + timestamp + '.png';
        var metaFile = 'companion_' + targetChar + '_' + timestamp + '.json';
        var charName = targetChar === 'natsume' ? '四季夏目' : targetChar === 'nene' ? '绫地宁宁' : targetChar;

        var fullImagePath = path.join(outDir, fileName);
        var metaPayload = {
          character: targetChar,
          characterName: charName,
          description: desc,
          promptTokens: promptTokens,
          loras: loras,
          outfit: args.outfit || 'default',
          // 审计字段如实记录：outfit=nsfw_nude 同样视为成人内容（与 wantsMature 判定同源）
          mature: wantsMature,
          createdAt: timestamp,
          outputPath: fullImagePath
        };
        try {
          fs.writeFileSync(path.join(outDir, metaFile), JSON.stringify(metaPayload, null, 2), 'utf8');
        } catch (e) { /* ignore */ }

        return {
          ok: true,
          output: '已成功为角色【' + charName + '】组装并下发生图任务：“' + desc + '”。专属 LoRA 已绑定，生成的插画将保存在 AI 工作区目录：【' + fullImagePath + '】。',
          character: targetChar,
          imageRelativePath: 'generated-images/' + fileName,
          fullImagePath: fullImagePath,
          bonusAffection: 2,
        };
      }
      default:
        throw new Error('未知工具：' + name);
    }
  }).catch(fail);
}

function createDesktopToolsRouter(options) {
  options = options || {};
  var router = express.Router();
  var security = options.security || require('../server/security');

  router.use('/api/desktop-tools', express.json({ limit: '768kb' }));
  router.use('/api/desktop-tools', security.localOnly);

  router.post('/api/desktop-tools', function (req, res) {
    var payload = req.body && typeof req.body === 'object' ? req.body : {};
    var name = typeof payload.name === 'string' ? payload.name : '';
    var args = payload.args && typeof payload.args === 'object' && !Array.isArray(payload.args)
      ? payload.args
      : {};
    if (!name) {
      envelope.fail(res, 400, '缺少工具名', { output: '缺少工具名' });
      return;
    }
    var workspaceRoot = process.env.AI_WORKSPACE_ROOT || path.join(__dirname, '..', 'AI');
    // 成人授权取请求体顶层字段（严格 === true），与模型可控的 args 隔离
    var context = { adultEnabled: payload.adultEnabled === true };
    runTool(workspaceRoot, name, args, context).then(function (result) {
      res.json(result);
    }).catch(function (error) {
      var err = error instanceof Error ? error : new Error(String(error));
      var extra = { output: String(err.message).slice(0, 2000) };
      if (err.code) extra.code = err.code;
      envelope.fail(res, envelope.statusFor(err, 500), err.message, extra);
    });
  });

  return router;
}

module.exports = { createDesktopToolsRouter: createDesktopToolsRouter, runTool: runTool, isPathInsideWorkspace: isPathInsideWorkspace, resolveWorkspacePath: resolveWorkspacePath };
