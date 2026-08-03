'use strict';

/**
 * 桌宠本地工具执行器测试（desktop/toolRunner.ts → desktop-dist）。
 * 覆盖：路径白名单、大小写不敏感、读写上限、命令执行与未知工具拒绝。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const toolRunner = require('../../desktop-dist/toolRunner');

function tempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aics-tools-'));
}

test('路径白名单：拒绝绝对路径与 .. 逃逸', () => {
  const root = tempWorkspace();
  try {
    assert.throws(() => toolRunner.resolveWorkspacePath(root, 'C:/Windows/System32'), /相对路径/);
    assert.throws(() => toolRunner.resolveWorkspacePath(root, '/etc/passwd'), /相对路径/);
    assert.throws(() => toolRunner.resolveWorkspacePath(root, '../outside'), /\.\./);
    assert.throws(() => toolRunner.resolveWorkspacePath(root, 'a/../../b'), /\.\./);
    assert.equal(toolRunner.resolveWorkspacePath(root, ''), path.resolve(root));
    assert.equal(toolRunner.resolveWorkspacePath(root, 'x/y.txt'), path.join(path.resolve(root), 'x', 'y.txt'));
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
    const resolved = toolRunner.resolveWorkspacePath(root, 'subdir/file.txt');
    assert.equal(toolRunner.isPathInsideWorkspace(root, resolved), true);
    assert.equal(toolRunner.isPathInsideWorkspace(root, path.join(root, 'SUBdir', '..', '..', '..', 'Windows')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('list_files：列出目录内容（含子目录标记）', async () => {
  const root = tempWorkspace();
  try {
    fs.mkdirSync(path.join(root, 'dir-a'));
    fs.writeFileSync(path.join(root, 'file-a.txt'), 'hello');
    const result = await toolRunner.runTool({ workspaceRoot: root }, 'list_files', { path: '' });
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
    const text = await toolRunner.runTool({ workspaceRoot: root }, 'read_file', { path: 'note.txt' });
    assert.equal(text.ok, true);
    assert.equal(text.output, '你好，世界');

    fs.writeFileSync(path.join(root, 'blob.bin'), Buffer.from([0x00, 0x01, 0xff]));
    const binary = await toolRunner.runTool({ workspaceRoot: root }, 'read_file', { path: 'blob.bin' });
    assert.equal(binary.ok, false);
    assert.match(binary.output, /二进制/);

    const missing = await toolRunner.runTool({ workspaceRoot: root }, 'read_file', { path: 'nope.txt' });
    assert.equal(missing.ok, false);

    const escaped = await toolRunner.runTool({ workspaceRoot: root }, 'read_file', { path: '../secret.txt' });
    assert.equal(escaped.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('write_file：写入并原子替换', async () => {
  const root = tempWorkspace();
  try {
    const written = await toolRunner.runTool({ workspaceRoot: root }, 'write_file', { path: 'notes/idea.md', content: '第一版' });
    assert.equal(written.ok, true);
    assert.equal(fs.readFileSync(path.join(root, 'notes', 'idea.md'), 'utf8'), '第一版');
    const overwritten = await toolRunner.runTool({ workspaceRoot: root }, 'write_file', { path: 'notes/idea.md', content: '第二版' });
    assert.equal(overwritten.ok, true);
    assert.equal(fs.readFileSync(path.join(root, 'notes', 'idea.md'), 'utf8'), '第二版');
    const tooBig = await toolRunner.runTool({ workspaceRoot: root }, 'write_file', { path: 'big.txt', content: 'x'.repeat(512 * 1024 + 1) });
    assert.equal(tooBig.ok, false);
    const escaped = await toolRunner.runTool({ workspaceRoot: root }, 'write_file', { path: '../../evil.txt', content: 'x' });
    assert.equal(escaped.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('run_command：参数数组执行，无 shell 注入面', async () => {
  const root = tempWorkspace();
  try {
    const version = await toolRunner.runTool({ workspaceRoot: root }, 'run_command', { command: 'node', args: ['--version'] });
    assert.equal(version.ok, true);
    assert.match(version.output, /^v\d+/);

    // 若 `;` 被 shell 解释，stdout 会出现 "pwned"；execFile 参数数组化下不应出现
    const injection = await toolRunner.runTool({ workspaceRoot: root }, 'run_command', {
      command: 'node',
      args: ['-p', '"ok"', ';', 'echo', 'pwned'],
    });
    assert.equal(injection.ok, true);
    assert.equal(injection.output.includes('pwned'), false, 'shell metacharacters must not be interpreted');

    const missing = await toolRunner.runTool({ workspaceRoot: root }, 'run_command', { command: 'definitely-not-a-real-command-xyz', args: [] });
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
    const image = await toolRunner.runTool({ workspaceRoot: root }, 'read_image', { path: 'pic.png' });
    assert.equal(image.ok, true);
    assert.match(image.output, /png/);
    assert.ok(image.imageDataUrl && image.imageDataUrl.startsWith('data:image/png;base64,'), 'read_image must return a png data url');

    fs.writeFileSync(path.join(root, 'fake.jpg'), Buffer.from('not an image at all'));
    const fake = await toolRunner.runTool({ workspaceRoot: root }, 'read_image', { path: 'fake.jpg' });
    assert.equal(fake.ok, false);
    assert.match(fake.output, /不支持的文件格式/);

    const escaped = await toolRunner.runTool({ workspaceRoot: root }, 'read_image', { path: '../photo.png' });
    assert.equal(escaped.ok, false);

    const textOnly = await toolRunner.runTool({ workspaceRoot: root }, 'read_image', { path: 'pic.png', extra: 'ignored' });
    assert.equal(textOnly.ok, true, 'extra args must be ignored');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('get_workspace_info 与未知工具', async () => {
  const root = tempWorkspace();
  try {
    const info = await toolRunner.runTool({ workspaceRoot: root }, 'get_workspace_info', {});
    assert.equal(info.ok, true);
    assert.match(info.output, /workspaceRoot/);
    const unknown = await toolRunner.runTool({ workspaceRoot: root }, 'delete_everything', {});
    assert.equal(unknown.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
