'use strict';

/**
 * 桌面本地工具执行器测试（routes/desktop-tools.js —— Tauri 壳经网关 /api/desktop-tools 调用）。
 *
 * 由已退役 Electron 版 desktop/toolRunner.ts 的 test-companion-tools.js 移植：
 * - 路径白名单、大小写不敏感、读写上限、命令执行与未知工具拒绝（直接测 runTool 纯函数）；
 * - 真实 HTTP 路由装配（断言 /api/desktop-tools 输出，含 localOnly 拒绝代理头）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const {
  runTool,
  isPathInsideWorkspace,
  resolveWorkspacePath,
  createDesktopToolsRouter,
} = require('../../routes/desktop-tools.js');

function tempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aics-tools-'));
}

test('路径白名单：拒绝绝对路径与 .. 逃逸', () => {
  const root = tempWorkspace();
  try {
    assert.throws(() => resolveWorkspacePath(root, 'C:/Windows/System32'), /相对路径/);
    assert.throws(() => resolveWorkspacePath(root, '/etc/passwd'), /相对路径/);
    assert.throws(() => resolveWorkspacePath(root, '../outside'), /\.\./);
    assert.throws(() => resolveWorkspacePath(root, 'a/../../b'), /\.\./);
    assert.equal(resolveWorkspacePath(root, ''), path.resolve(root));
    assert.equal(resolveWorkspacePath(root, 'x/y.txt'), path.join(path.resolve(root), 'x', 'y.txt'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('路径边界：Windows 大小写不敏感', () => {
  const root = tempWorkspace();
  try {
    const nested = path.join(root, 'SubDir', 'File.txt');
    fs.mkdirSync(path.dirname(nested), { recursive: true });
    fs.writeFileSync(nested, 'ok');
    const resolved = resolveWorkspacePath(root, 'subdir/file.txt');
    assert.equal(isPathInsideWorkspace(root, resolved), true);
    assert.equal(isPathInsideWorkspace(root, path.join(root, 'SUBdir', '..', '..', '..', 'Windows')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('list_files：列出目录内容（含子目录标记）', async () => {
  const root = tempWorkspace();
  try {
    fs.mkdirSync(path.join(root, 'dir-a'));
    fs.writeFileSync(path.join(root, 'file-a.txt'), 'hello');
    const result = await runTool(root, 'list_files', { path: '' });
    assert.equal(result.ok, true);
    assert.match(result.output, /dir-a\//);
    assert.match(result.output, /file-a\.txt/);
    assert.match(result.output, /共 2 项/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('read_file：文本可读、二进制拒绝、超限拒绝', async () => {
  const root = tempWorkspace();
  try {
    fs.writeFileSync(path.join(root, 'note.txt'), '你好，世界');
    const text = await runTool(root, 'read_file', { path: 'note.txt' });
    assert.equal(text.ok, true);
    assert.equal(text.output, '你好，世界');

    fs.writeFileSync(path.join(root, 'blob.bin'), Buffer.from([0x00, 0x01, 0xff]));
    const binary = await runTool(root, 'read_file', { path: 'blob.bin' });
    assert.equal(binary.ok, false);
    assert.match(binary.output, /二进制/);

    const missing = await runTool(root, 'read_file', { path: 'nope.txt' });
    assert.equal(missing.ok, false);

    const escaped = await runTool(root, 'read_file', { path: '../secret.txt' });
    assert.equal(escaped.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('write_file：写入并原子替换', async () => {
  const root = tempWorkspace();
  try {
    const written = await runTool(root, 'write_file', { path: 'notes/idea.md', content: '第一版' });
    assert.equal(written.ok, true);
    assert.equal(fs.readFileSync(path.join(root, 'notes', 'idea.md'), 'utf8'), '第一版');
    const overwritten = await runTool(root, 'write_file', { path: 'notes/idea.md', content: '第二版' });
    assert.equal(overwritten.ok, true);
    assert.equal(fs.readFileSync(path.join(root, 'notes', 'idea.md'), 'utf8'), '第二版');
    const tooBig = await runTool(root, 'write_file', { path: 'big.txt', content: 'x'.repeat(512 * 1024 + 1) });
    assert.equal(tooBig.ok, false);
    const escaped = await runTool(root, 'write_file', { path: '../../evil.txt', content: 'x' });
    assert.equal(escaped.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('run_command：参数数组执行，无 shell 注入面', async () => {
  const root = tempWorkspace();
  try {
    const version = await runTool(root, 'run_command', { command: 'node', args: ['--version'] });
    assert.equal(version.ok, true);
    assert.match(version.output, /^v\d+/);

    // 若 `;` 被 shell 解释，stdout 会出现 "pwned"；execFile 参数数组化下不应出现
    const injection = await runTool(root, 'run_command', {
      command: 'node',
      args: ['-p', '"ok"', ';', 'echo', 'pwned'],
    });
    assert.equal(injection.ok, true);
    assert.equal(injection.output.includes('pwned'), false, 'shell metacharacters must not be interpreted');

    const missing = await runTool(root, 'run_command', { command: 'definitely-not-a-real-command-xyz', args: [] });
    assert.equal(missing.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('read_image：图片转 data URL，非图片与超限拒绝', async () => {
  const root = tempWorkspace();
  try {
    // 1x1 透明 PNG（魔数 + IHDR 最小结构）
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    fs.writeFileSync(path.join(root, 'pic.png'), png);
    const image = await runTool(root, 'read_image', { path: 'pic.png' });
    assert.equal(image.ok, true);
    assert.match(image.output, /png/);
    assert.ok(image.imageDataUrl && image.imageDataUrl.startsWith('data:image/png;base64,'), 'read_image must return a png data url');

    fs.writeFileSync(path.join(root, 'fake.jpg'), Buffer.from('not an image at all'));
    const fake = await runTool(root, 'read_image', { path: 'fake.jpg' });
    assert.equal(fake.ok, false);
    assert.match(fake.output, /不支持的文件格式/);

    const escaped = await runTool(root, 'read_image', { path: '../photo.png' });
    assert.equal(escaped.ok, false);

    const textOnly = await runTool(root, 'read_image', { path: 'pic.png', extra: 'ignored' });
    assert.equal(textOnly.ok, true, 'extra args must be ignored');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('get_workspace_info 与未知工具', async () => {
  const root = tempWorkspace();
  try {
    const info = await runTool(root, 'get_workspace_info', {});
    assert.equal(info.ok, true);
    assert.match(info.output, /workspaceRoot/);
    const unknown = await runTool(root, 'delete_everything', {});
    assert.equal(unknown.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('generate_character_image：组装角色 LoRA 与生图任务', async () => {
  const root = tempWorkspace();
  try {
    const res = await runTool(root, 'generate_character_image', {
      character: 'natsume',
      description: '在海边喝汽水',
      outfit: 'swimsuit',
    });
    assert.equal(res.ok, true);
    assert.equal(res.character, 'natsume');
    assert.equal(res.bonusAffection, 2);
    assert.match(res.output, /四季夏目/);
    assert.match(res.imageRelativePath, /^generated-images\/companion_natsume_\d+\.png$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('generate_character_image：R18 双门 fail-closed（白名单 × adultEnabled）', async () => {
  const root = tempWorkspace();
  try {
    // 1) 未授权（缺 context）：mature=true 直接拒绝，且不落任何生成元数据
    const denied = await runTool(root, 'generate_character_image', {
      character: 'natsume', description: 'x', mature: true,
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'adult_not_enabled');
    assert.match(denied.error, /未获本机授权/);
    assert.equal(fs.existsSync(path.join(root, 'generated-images')), false, '拒绝时不得写入元数据');

    // 2) falsy 授权同样拒绝（fail-closed 不做 truthy 宽松转换）
    const weakConsent = await runTool(root, 'generate_character_image', {
      character: 'nene', description: 'x', outfit: 'nsfw_nude',
    }, { adultEnabled: 'yes' });
    assert.equal(weakConsent.ok, false);

    // 3) 有授权但角色不在成人白名单：按 adultEligibility 拒绝
    const ineligible = await runTool(root, 'generate_character_image', {
      character: 'raiden_shogun', description: 'x', outfit: 'nsfw_nude',
    }, { adultEnabled: true });
    assert.equal(ineligible.ok, false);
    assert.equal(ineligible.code, 'adult_character_not_eligible');
    assert.match(ineligible.output, /白名单/);

    // 4) 双门齐备 + 大小写归一：放行并注入裸露 token
    const allowed = await runTool(root, 'generate_character_image', {
      character: 'Natsume', description: 'x', outfit: 'nsfw_nude',
    }, { adultEnabled: true });
    assert.equal(allowed.ok, true);
    const metaFiles = fs.readdirSync(path.join(root, 'generated-images')).filter((f) => f.endsWith('.json'));
    assert.equal(metaFiles.length, 1);
    const meta = JSON.parse(fs.readFileSync(path.join(root, 'generated-images', metaFiles[0]), 'utf8'));
    assert.equal(meta.mature, true);
    assert.ok(meta.promptTokens.includes('completely naked'), '放行时必须注入裸露 token');

    // 5) 非 R18 请求不受门控影响：任意角色无 context 也照常组装
    const plain = await runTool(root, 'generate_character_image', {
      character: 'raiden_shogun', description: 'y', outfit: 'dress',
    });
    assert.equal(plain.ok, true);

    // 6) 错误信封对齐：runTool 失败结果带 error/msg 镜像
    assert.equal(typeof denied.msg, 'string');
    assert.equal(denied.msg, denied.error);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('capture_screen：Windows 原生截屏', async () => {
  const root = tempWorkspace();
  try {
    const res = await runTool(root, 'capture_screen', {});
    if (process.platform === 'win32') {
      assert.equal(res.ok, true);
      assert.match(res.imageDataUrl, /^data:image\/jpeg;base64,/);
      assert.match(res.output, /捕获当前桌面屏幕画面/);
    } else {
      assert.equal(res.ok, false);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('HTTP 装配：/api/desktop-tools 本机可用、代理头拒绝、缺工具名 400', async () => {
  const root = tempWorkspace();
  const previous = process.env.AI_WORKSPACE_ROOT;
  process.env.AI_WORKSPACE_ROOT = root;
  const app = express();
  app.use(createDesktopToolsRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    fs.writeFileSync(path.join(root, 'hello.txt'), 'hi');

    const ok = await fetch(`${base}/api/desktop-tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'read_file', args: { path: 'hello.txt' } }),
    });
    assert.equal(ok.status, 200);
    const okBody = await ok.json();
    assert.equal(okBody.ok, true);
    assert.equal(okBody.output, 'hi');

    // 带代理头的请求等同非本机来源：localOnly 必须 403
    const forwarded = await fetch(`${base}/api/desktop-tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ name: 'get_workspace_info', args: {} }),
    });
    assert.equal(forwarded.status, 403);

    const noName = await fetch(`${base}/api/desktop-tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ args: {} }),
    });
    assert.equal(noName.status, 400);
    const noNameBody = await noName.json();
    assert.equal(noNameBody.ok, false);
    assert.equal(noNameBody.error, '缺少工具名');
    assert.equal(noNameBody.output, '缺少工具名', 'output 镜像保留，供对话模型 tool 消息消费');

    // R18 传输层授权：顶层 adultEnabled !== true 时 mature 参数必须被拒
    const adultDenied = await fetch(`${base}/api/desktop-tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'generate_character_image', args: { character: 'nene', description: 'x', mature: true } }),
    });
    assert.equal(adultDenied.status, 200);
    const adultDeniedBody = await adultDenied.json();
    assert.equal(adultDeniedBody.ok, false);
    assert.equal(adultDeniedBody.code, 'adult_not_enabled');

    // 模型在 args 里自行声明授权无效：args.adultEnabled 不参与判定
    const selfDeclared = await fetch(`${base}/api/desktop-tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'generate_character_image', args: { character: 'nene', description: 'x', mature: true, adultEnabled: true } }),
    });
    const selfDeclaredBody = await selfDeclared.json();
    assert.equal(selfDeclaredBody.ok, false);
    assert.equal(selfDeclaredBody.code, 'adult_not_enabled');

    // 顶层显式授权 + 白名单角色：放行
    const adultAllowed = await fetch(`${base}/api/desktop-tools`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'generate_character_image', args: { character: 'nene', description: '海边散步' }, adultEnabled: true }),
    });
    const adultAllowedBody = await adultAllowed.json();
    assert.equal(adultAllowedBody.ok, true);
  } finally {
    server.close();
    if (previous === undefined) delete process.env.AI_WORKSPACE_ROOT;
    else process.env.AI_WORKSPACE_ROOT = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
