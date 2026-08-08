'use strict';

/**
 * 桌宠本地工具执行器（从 desktop/toolRunner.ts 下沉到网关的 CJS 版）。
 *
 * 安全边界（与 toolRunner.ts 一致）：
 * - localOnly：仅本机可调（与 /api/training 同级别）。
 * - 所有路径解析后必须落在 AI 工作区（AI_WORKSPACE_ROOT）内（Windows 大小写不敏感）。
 * - 命令以参数数组 execFile 执行，不经过 shell —— 没有 `;`/`|`/`&&` 注入面。
 * - 读 1MB / 写 512KB / 命令 120s 超时 + 64KB 输出上限。
 */

var express = require('express');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

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

function runTool(workspaceRoot, name, args) {
  var root = path.resolve(workspaceRoot || '.');
  function fail(error) {
    return {
      ok: false,
      output: String(error instanceof Error ? error.message : error).slice(0, 2000),
    };
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
            var temporary = writeFile + '.' + process.pid + '.tool.tmp';
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
      res.status(400).json({ ok: false, output: '缺少工具名' });
      return;
    }
    var workspaceRoot = process.env.AI_WORKSPACE_ROOT || path.join(__dirname, '..', 'AI');
    runTool(workspaceRoot, name, args).then(function (result) {
      res.json(result);
    }).catch(function (error) {
      res.status(500).json({ ok: false, output: String(error && error.message || error).slice(0, 2000) });
    });
  });

  return router;
}

module.exports = { createDesktopToolsRouter: createDesktopToolsRouter, runTool: runTool, isPathInsideWorkspace: isPathInsideWorkspace, resolveWorkspacePath: resolveWorkspacePath };
