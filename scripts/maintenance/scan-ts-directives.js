'use strict';

/**
 * scripts/maintenance/scan-ts-directives.js
 *
 * 前端源码静默绕过门禁指令的入库门禁（2026-08-28 工程审计 P0 固化）。
 *
 * 背景：src/composables/useGenerationSession.ts 曾以首行 `// @ts-nocheck`
 * 静默绕过 typecheck:app 门禁入库，注释与真实代码状态矛盾，对 AI 协作
 * 项目是最高危的误导源。此后 src/ 一律禁止以下指令：
 *   - @ts-nocheck / @ts-ignore / @ts-expect-error：绕过 typecheck 门禁
 *   - eslint-disable*：绕过 lint 门禁（确需豁免时走 eslint 配置文件，
 *     让豁免集中可审计）
 *
 * 用法: node scripts/maintenance/scan-ts-directives.js --check
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TARGET_DIRS = ['src'];
const EXTENSIONS = /\.(?:ts|vue|tsx)$/;

const FORBIDDEN = [
  '@ts-nocheck',
  '@ts-ignore',
  '@ts-expect-error',
  'eslint-disable',
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.test(full) ? [full] : [];
  });
}

function main() {
  const violations = [];
  for (const dir of TARGET_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const directive of FORBIDDEN) {
          if (line.includes(directive)) {
            violations.push(path.relative(ROOT, file) + ':' + (index + 1) + ' — ' + directive);
          }
        }
      });
    }
  }
  if (violations.length) {
    console.error('src/ 内发现静默绕过门禁的指令（一律禁止入库）:');
    violations.forEach((v) => console.error('  - ' + v));
    process.exit(1);
  }
  console.log('TypeScript directive scan passed: no @ts-nocheck/@ts-ignore/eslint-disable in src/.');
}

if (require.main === module) main();

module.exports = { FORBIDDEN };
