'use strict';

/**
 * scripts/maintenance/install-git-hooks.js —— postinstall 挂钩。
 * 把 core.hooksPath 指向仓库内 .githooks（历史 pre-push 门禁目录）。
 * 2026-08-29 经用户决策移除 pre-push 本地门禁：秒推回归，推送后由
 * CI quality.yml 全量拦截。非 git 环境
 * （CI tarball、桌面包派生 npm ci）静默跳过。
 */

const { execFileSync } = require('child_process');

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
  console.log('[hooks] core.hooksPath -> .githooks');
} catch {
  console.log('[hooks] skipped: not a git worktree');
}
