'use strict';

/**
 * scripts/maintenance/gate-quick.js — 按改动类型分层的精简门禁
 *
 * 用法：
 *   node scripts/maintenance/gate-quick.js                自动检测 git 改动选面积
 *   node scripts/maintenance/gate-quick.js ui|server|data|all|full [--verbose] [--all]
 *
 * 面积 → 步骤：
 *   ui     typecheck:app + vitest（纯前端改动，~1-2 分钟）
 *   server Anima/生成/视频/聊天/安全/桌面工具/控制 7 个契约套件（~2-3 分钟）
 *   data   聚合一致性 + 内容契约 + 分片/参考库/定稿/语料契约（~15 秒）
 *   all    ui + server + data 三块连跑
 *   full   all + check 套件 + 生产打包预算（提交前/发布前一次）
 *
 * 横切重构（目录改名、模块搬迁、依赖变更）请直接用 full——爆炸半径无法事先界定。
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { QUALITY_TEST_SUITES } = require('../tests/quality-test-inventory');
const {
  runSuiteFiles,
  runUnitSuite,
  runNpmScript,
  printExcerpt,
  formatDuration,
  root,
} = require('../tests/run-quality-suite');

const testsDir = path.join(root, 'scripts', 'tests');

function runNpmStep(name, script, timeout, verbose) {
  if (verbose) {
    const started = Date.now();
    const child = spawnSync(`npm run ${script}`, {
      cwd: root,
      stdio: 'inherit',
      timeout,
      shell: true,
    });
    const ok = child.status === 0;
    console.log(`${ok ? '✔' : '✘'} ${name} ${formatDuration(Date.now() - started)}${ok ? '' : ` exit ${child.status ?? '?'}`}`);
    return ok ? 0 : 1;
  }
  const step = runNpmScript(script, timeout);
  if (step.ok) {
    console.log(`✔ ${name} ${formatDuration(step.duration)}`);
    return 0;
  }
  console.log(`✘ ${name} ${formatDuration(step.duration)} ${step.reason}`);
  printExcerpt(step.output, name);
  return 1;
}

function suiteFiles(names, label, { verbose, keepGoing }) {
  return runSuiteFiles(
    names.map((file) => ({ name: file, file: path.join(testsDir, file) })),
    { label, timeout: 180_000, verbose, keepGoing },
  );
}

const AREA_STEPS = {
  ui({ verbose }) {
    let code = runNpmStep('typecheck:app', 'typecheck:app', 300_000, verbose);
    if (code === 0 || verbose) code = runNpmStep('vitest', 'test:frontend', 300_000, verbose) || code;
    return code;
  },
  server({ verbose, keepGoing }) {
    return suiteFiles(
      [
        'test-anima-routes.js',
        'test-generation-routes.js',
        'test-video-routes.js',
        'test-chat.js',
        'test-security.js',
        'test-desktop-tools-route.js',
        'test-control-failure-contract.js',
      ],
      'server',
      { verbose, keepGoing },
    );
  },
  data({ verbose, keepGoing }) {
    return runSuiteFiles(
      [
        { name: 'build-scenes --check', file: path.join(root, 'scripts', 'maintenance', 'build-scenes.js'), args: ['--check'] },
        { name: 'validate-content-contracts', file: path.join(root, 'scripts', 'maintenance', 'validate-content-contracts.js') },
        { name: 'test-scene-shard-integrity', file: path.join(testsDir, 'test-scene-shard-integrity.js') },
        { name: 'test-popular-shard-integrity', file: path.join(testsDir, 'test-popular-shard-integrity.js') },
        { name: 'test-character-reference-contract', file: path.join(testsDir, 'test-character-reference-contract.js') },
        { name: 'test-pinned-scene-prompts', file: path.join(testsDir, 'test-pinned-scene-prompts.js') },
        { name: 'test-prompt-corpus', file: path.join(testsDir, 'test-prompt-corpus.js') },
      ],
      { label: 'data', timeout: 120_000, verbose, keepGoing },
    );
  },
};

function detectAreas() {
  const gitArgs = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  const collect = (args) => String((gitArgs(args).stdout || '')).split(/\r?\n/).filter(Boolean);
  const files = [
    ...collect(['diff', '--name-only', 'HEAD']),
    ...collect(['ls-files', '--others', '--exclude-standard']),
  ];
  const areas = new Set();
  for (const raw of files) {
    const p = raw.replace(/\\/g, '/');
    if (/^(src)\//.test(p) || /\.(vue|ts)$/i.test(p)) areas.add('ui');
    if (/^(routes|server|services)\//.test(p)) areas.add('server');
    if (/^data\//.test(p)) areas.add('data');
    // scripts/ 是横切层（被 server/测试/桌面打包共同消费），保守升级为全量三块
    if (/^scripts\//.test(p)) {
      areas.add('ui');
      areas.add('server');
      areas.add('data');
    }
  }
  return [...areas];
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('用法: node scripts/maintenance/gate-quick.js [ui|server|data|all|full] [--verbose] [--all]');
    console.log('缺省按 git 改动自动选面积；--all 失败后继续；--verbose 子进程输出直通。');
    return 0;
  }
  const verbose = argv.includes('--verbose');
  const keepGoing = argv.includes('--all');
  const areaArg = argv.find((arg) => ['ui', 'server', 'data', 'all', 'full'].includes(arg));

  let areas;
  if (areaArg) {
    areas = areaArg === 'all' ? ['ui', 'server', 'data'] : areaArg === 'full' ? ['ui', 'server', 'data'] : [areaArg];
  } else {
    areas = detectAreas();
    if (!areas.length) {
      console.log('gate:quick 未检测到 git 改动；显式指定面积或用 full。');
      return 0;
    }
    console.log(`gate:quick 自动检测面积: ${areas.join(' + ')}`);
  }

  let exitCode = 0;
  const started = Date.now();
  for (const area of areas) {
    console.log(`── gate ${area} ──`);
    if (area === 'ui') {
      exitCode = AREA_STEPS.ui({ verbose }) || exitCode;
      continue;
    }
    if (area === 'server') {
      exitCode = AREA_STEPS.server({ verbose, keepGoing }) || exitCode;
      continue;
    }
    if (area === 'data') {
      exitCode = AREA_STEPS.data({ verbose, keepGoing }) || exitCode;
      continue;
    }
    // full：三块 + check 套件 + unit + 生产打包预算
    if (runNpmStep('typecheck:app', 'typecheck:app', 300_000, verbose) !== 0) { exitCode = 1; continue; }
    if (runNpmStep('vitest', 'test:frontend', 300_000, verbose) !== 0) { exitCode = 1; continue; }
    if (suiteFiles(QUALITY_TEST_SUITES.check, 'check', { verbose, keepGoing }) !== 0) { exitCode = 1; continue; }
    if (runUnitSuite({ verbose }) !== 0) { exitCode = 1; continue; }
    if (suiteFiles(QUALITY_TEST_SUITES.contract, 'contract', { verbose, keepGoing }) !== 0) { exitCode = 1; continue; }
    if (runNpmStep('build（打包预算）', 'build', 600_000, verbose) !== 0) { exitCode = 1; }
  }
  console.log(`gate 总计: ${exitCode === 0 ? 'PASS' : 'FAIL'} · ${formatDuration(Date.now() - started)}`);
  return exitCode;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { detectAreas, AREA_STEPS };
