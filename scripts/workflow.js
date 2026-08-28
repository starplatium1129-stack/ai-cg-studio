#!/usr/bin/env node
'use strict';

/**
 * scripts/workflow.js — 统一工作流入口
 *
 * 解决：140 个 maintenance 脚本分散、入口难发现、参数不统一。
 * 用法：
 *   node scripts/workflow.js --help
 *   node scripts/workflow.js <group> --help
 *   node scripts/workflow.js <group>:<action> [options]
 *   npm run workflow -- <group>:<action> [options]
 *
 * 设计：薄封装，不接管业务逻辑，仅做发现、校验与转发，
 * 保持对现有脚本的完全兼容（直接 node 旧脚本仍可用）。
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const WORKFLOWS = {
  'data:build': {
    desc: '聚合场景分片 -> scenes.json（热门角色见 popular:build）',
    cmd: ['node', 'scripts/maintenance/build-scenes.js'],
    docs: 'docs/maintenance.md#文件职责',
  },
  'popular:build': {
    desc: '聚合热门角色分片 -> popular-characters.json',
    cmd: ['node', 'scripts/maintenance/build-popular.js'],
    docs: 'docs/maintenance.md#文件职责',
  },
  'popular:split': {
    desc: 'popular-characters.json -> 系列分片（覆盖写入）',
    cmd: ['node', 'scripts/maintenance/split-popular.js', '--write'],
    docs: 'docs/maintenance.md',
  },
  'popular:import': {
    desc: 'popular-characters.json -> 系列分片并重建聚合',
    cmd: ['npm', 'run', 'popular:import'],
    docs: 'docs/maintenance.md',
  },
  'data:import': {
    desc: 'scenes.json -> 分片（覆盖写入）',
    cmd: ['node', 'scripts/maintenance/split-scenes.js', '--write'],
    docs: 'docs/maintenance.md',
  },
  'data:normalize': {
    desc: '分类评级 + 规范标签 + 校验',
    cmd: ['npm', 'run', 'scenes:normalize'],
    docs: 'package.json:93',
  },
  'data:validate': {
    desc: '内容契约 + DATA_VERSION 校验',
    cmd: ['node', 'scripts/maintenance/validate-content-contracts.js'],
    docs: 'docs/maintenance.md',
  },
  'data:apply': {
    desc: '合并 refine-map chunks (替代 4 个 apply-*.js)',
    cmd: ['node', 'scripts/maintenance/apply-chunks.js', '--help'],
    docs: 'scripts/maintenance/apply-chunks.js:1',
    opts: '--target popular|scenes --chunks 1-17',
  },
  'reference:render': {
    desc: '参考库批量出图 45×236×4=944 张 (Anima 832x1216, 并发3)',
    cmd: ['node', 'scripts/maintenance/render-all-outfits-references.js'],
    docs: 'docs/character-reference-audit-pending.md',
    needs: 'ComfyUI + gateway http://127.0.0.1:3000',
  },
  'reference:audit': {
    desc: '纯视觉审核 4并发 (Gemini)',
    cmd: ['node', 'scripts/maintenance/pure-vision-audit.js'],
    docs: 'scripts/maintenance/pure-vision-audit.js:1',
    opts: '[--force] [--keys char/outfit/pers,...] 强制重审指定项',
  },
  'reference:repair': {
    desc: '定向修复未通过项（每项3次重渲染+重审）',
    cmd: ['node', 'scripts/maintenance/fine-tuned-repair.js'],
    docs: 'scripts/maintenance/fine-tuned-repair.js:1',
  },
  'reference:full': {
    desc: '参考库全链路：render -> audit -> repair',
    cmd: null,
    docs: 'docs/workflow.md#参考库',
    steps: ['reference:render', 'reference:audit', 'reference:repair'],
  },
  'showcase:generate': {
    desc: 'Anima 批量出图（热门/场景）',
    cmd: ['node', 'scripts/maintenance/generate-popular-showcase-anima11.js', '--help'],
    docs: 'docs/showcase-generation-craft.md',
    opts: '--gateway 3123 --keys a,b --concurrency 3',
  },
  'showcase:audit': {
    desc: '批量审核 showcase (Gemini 4并发)',
    cmd: ['node', 'scripts/maintenance/audit-showcase-rella.js', '--help'],
    docs: 'scripts/maintenance/audit-showcase-rella.js:1',
  },
  'showcase:publish': {
    desc: '发布审核通过的样张到线上',
    cmd: ['node', 'scripts/maintenance/publish-popular-showcase.js', '--help'],
    docs: 'docs/showcase-generation-craft.md',
  },
  'showcase:batch': {
    desc: '统一批量调度（替代 8 个 run-batch-* 脚本）',
    cmd: ['node', 'scripts/maintenance/run-batch.js', '--help'],
    docs: 'scripts/maintenance/run-batch.js:1',
    opts: '--source popular|scenes --batch-size 10 --concurrency 3',
  },
  'check:quick': {
    desc: '并行质量门（typecheck + 契约 + 风格）',
    cmd: ['npm', 'run', 'check'],
    docs: 'AGENTS.md#质量门禁',
  },
  'check:full': {
    desc: '完整校验：check + frontend + unit + contract',
    cmd: ['npm', 'run', 'validate'],
    docs: 'AGENTS.md',
  },
  'check:content': {
    desc: '仅内容契约 + DATA_VERSION',
    cmd: ['npm', 'run', 'test:content'],
    docs: 'scripts/maintenance/validate-content-contracts.js:1',
  },
  'build:web': {
    desc: '前端构建 + 预算 + 预压',
    cmd: ['npm', 'run', 'build'],
    docs: 'AGENTS.md:53',
  },
  'build:runtime': {
    desc: '编译 services/*.ts -> .js',
    cmd: ['npm', 'run', 'build:runtime'],
    docs: 'package.json:29',
  },
  'deploy:desktop': {
    desc: '桌面增量部署（跳过构建）',
    cmd: ['powershell', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/maintenance/deploy-desktop-quick.ps1', '-SkipBuild'],
    docs: 'AGENTS.md:56',
  },
  'character:onboard': {
    desc: '一站式新角色接入（档案/标准/粒子/参考图/样张/DATA_VERSION）',
    cmd: ['npm', 'run', 'character:onboard', '--', '--help'],
    docs: 'docs/character-onboarding-workflow.md',
  },
};

function printHelp(group) {
  const allKeys = Object.keys(WORKFLOWS).sort();
  if (!group) {
    console.log(`
AI-CG-Studio 统一工作流  (scripts/workflow.js)

用法:
  node scripts/workflow.js <workflow> [options]
  npm run workflow -- <workflow> [options]

工作流一览:
`);
    const groups = {};
    for (const k of allKeys) {
      const g = k.split(':')[0];
      if (!groups[g]) groups[g] = [];
      groups[g].push(k);
    }
    for (const [g, keys] of Object.entries(groups)) {
      console.log(`  ${g}:`);
      for (const k of keys) {
        const w = WORKFLOWS[k];
        console.log(`    ${k.padEnd(22)} ${w.desc}`);
      }
    }
    console.log(`
示例:
  node scripts/workflow.js data:validate
  node scripts/workflow.js reference:audit --force --keys alisa_mikhailovna_kujou/school_uniform/ref_01_face_closeup
  node scripts/workflow.js showcase:batch --source popular --batch-size 10
  node scripts/workflow.js check:full

查看子工作流帮助:
  node scripts/workflow.js <workflow> --help

文档总览: docs/workflow.md  |  维护手册: docs/maintenance.md  |  门禁: AGENTS.md
`);
    return;
  }
  // group help: filter keys by group prefix
  const matched = allKeys.filter(k => k === group || k.startsWith(group + ':'));
  if (!matched.length) {
    console.error(`未知工作流: ${group}\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }
  if (matched.length === 1 && WORKFLOWS[matched[0]]) {
    const w = WORKFLOWS[matched[0]];
    console.log(`\n${matched[0]} — ${w.desc}`);
    if (w.docs) console.log(`文档: ${w.docs}`);
    if (w.needs) console.log(`依赖: ${w.needs}`);
    if (w.opts) console.log(`参数: ${w.opts}`);
    if (w.cmd) console.log(`执行: ${w.cmd.join(' ')}`);
    if (w.steps) console.log(`步骤: ${w.steps.join(' -> ')}`);
    console.log('');
    // forward --help to underlying cmd if exists
    if (w.cmd) {
      spawnSync(w.cmd[0], [...w.cmd.slice(1), '--help'], { stdio: 'inherit', cwd: ROOT, shell: w.cmd[0] === 'npm' || w.cmd[0] === 'powershell' });
      // ignore exit
    }
    return;
  }
  console.log(`\n${group} 分组:`);
  for (const k of matched) console.log(`  ${k.padEnd(22)} ${WORKFLOWS[k].desc}`);
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    const group = args.find(a => !a.startsWith('-'));
    // if --help with specific workflow, show that workflow help
    if (group && group !== '--help' && group !== '-h') {
      printHelp(group);
      return;
    }
    printHelp();
    return;
  }

  const workflow = args[0];
  const extra = args.slice(1);
  const def = WORKFLOWS[workflow];

  // support group -> list
  if (!def) {
    const maybeGroup = Object.keys(WORKFLOWS).some(k => k.startsWith(workflow + ':'));
    if (maybeGroup) {
      printHelp(workflow);
      return;
    }
    console.error(`未知工作流: ${workflow}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (def.steps) {
    console.log(`执行复合工作流: ${workflow} -> ${def.steps.join(' -> ')}`);
    for (const step of def.steps) {
      console.log(`\n=== ${step} ===`);
      const sdef = WORKFLOWS[step];
      const result = spawnSync(sdef.cmd[0], [...sdef.cmd.slice(1), ...extra], { stdio: 'inherit', cwd: ROOT, shell: sdef.cmd[0] === 'npm' || sdef.cmd[0] === 'powershell' });
      if (result.status !== 0) {
        console.error(`步骤 ${step} 失败，终止`);
        process.exitCode = result.status || 1;
        return;
      }
    }
    return;
  }

  const cmd = def.cmd[0];
  const cmdArgs = [...def.cmd.slice(1), ...extra];
  const useShell = cmd === 'npm' || cmd === 'powershell';
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: ROOT, shell: useShell });
  process.exitCode = result.status ?? 1;
}

if (require.main === module) main();
module.exports = { WORKFLOWS };
