'use strict';

/**
 * scripts/maintenance/install-git-hooks.js —— postinstall 挂钩。
 * 把 core.hooksPath 指向仓库内 .githooks（pre-push 门禁），使本地推送
 * 前强制 typecheck + lint（2026-08-28 审计 P1-13）。非 git 环境
 * （CI tarball、桌面包派生 npm ci）静默跳过。
 */

const { execFileSync } = require('child_process');

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks']);
  console.log('[hooks] core.hooksPath -> .githooks (pre-push: typecheck:app + lint:js)');
} catch {
  console.log('[hooks] skipped: not a git worktree');
}
