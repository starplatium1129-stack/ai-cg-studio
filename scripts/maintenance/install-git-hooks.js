'use strict';

/**
 * scripts/maintenance/install-git-hooks.js —— postinstall 挂钩。
 * 2026-08-29 经用户决策移除 pre-push 本地门禁：秒推回归，推送后由
 * CI quality.yml 全量拦截。只清理指向已移除目录的旧配置，保留用户自设钩子。
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function migrateHooks(root = path.resolve(__dirname, '../..'), run = execFileSync) {
  const options = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true };
  let configured;
  try {
    configured = run('git', ['config', '--local', '--get', 'core.hooksPath'], options).trim();
  } catch {
    return 'no local hooks override';
  }
  if (configured !== '.githooks' || fs.existsSync(path.join(root, '.githooks'))) return 'existing hooks preserved';
  run('git', ['config', '--local', '--unset-all', 'core.hooksPath'], options);
  return 'removed obsolete .githooks override';
}

if (require.main === module) console.log(`[hooks] ${migrateHooks()}`);
module.exports = { migrateHooks };
