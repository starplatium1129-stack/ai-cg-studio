#!/usr/bin/env node
'use strict';

/**
 * git bundle 异地快照（2026-08-29 产品运营审计 P0-2）。
 *
 * 背景：2026-08-29 00:38 本地 .git 因中断的 repack/gc 几乎全毁（refs/heads 消失、
 * 对象库仅剩 217 个对象），唯一救回路径是 origin 远端。bundle 是无需服务端的
 * 本地第二副本：单文件、可 clone、可 fetch 恢复，覆盖「远端推送不及时」的窗口。
 *
 * 用法：node scripts/maintenance/git-bundle-backup.js [--keep N]（默认保留 14 份）
 * 排入 start.ps1 每次启动尽力执行；也可手动或计划任务调用。
 * 恢复：git clone runtime/git-backups/aics-<stamp>.bundle <目录>
 *       或 git fetch runtime/git-backups/aics-<stamp>.bundle main:<分支>
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKUP_DIR = path.join(ROOT, 'runtime', 'git-backups');
const keepIndex = process.argv.indexOf('--keep');
const KEEP = (keepIndex > -1 && Number(process.argv[keepIndex + 1])) || 14;

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function main() {
  try {
    git(['rev-parse', '--is-inside-work-tree']);
    git(['rev-parse', 'HEAD']); // HEAD 不可解析（如 refs 损坏）时无内容可备，直接退出
  } catch (error) {
    console.error('[git-bundle-backup] 仓库不可用，跳过备份：' + String(error.message).split('\n')[0]);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(BACKUP_DIR, `aics-${stamp}.bundle`);
  try {
    git(['bundle', 'create', file, '--all']);
  } catch (error) {
    console.error('[git-bundle-backup] bundle 创建失败：' + String(error.message).split('\n')[0]);
    process.exitCode = 1;
    return;
  }

  // 只在本次成功创建后清理旧份，按文件名时间戳倒序保留 KEEP 份
  const stale = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.bundle'))
    .sort()
    .reverse()
    .slice(KEEP);
  for (const name of stale) {
    try { fs.unlinkSync(path.join(BACKUP_DIR, name)); } catch { /* 被占用则留待下次 */ }
  }

  const sizeMB = (fs.statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`[git-bundle-backup] ${path.relative(ROOT, file)} (${sizeMB} MB)，保留最近 ${KEEP} 份`);
}

main();
