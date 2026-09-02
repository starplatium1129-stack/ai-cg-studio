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
    desc: 'popular→分片（仅写分片文件，不重建聚合；如需重建用 popular:import）',
    cmd: ['node', 'scripts/maintenance/split-popular.js', '--write'],
    docs: 'docs/maintenance.md',
  },
  'popular:import': {
    desc: 'popular→分片+重建聚合（popular:split 超集，改完分片后跑此重建）',
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
    desc: '参考库批量出图 59 角色×多服装（MiaoMiao v1.2 832x1216, 并发3）',
    cmd: ['node', 'scripts/maintenance/render-all-outfits-references.js'],
    docs: 'docs/character-reference-audit-pending.md',
    needs: 'ComfyUI + gateway http://127.0.0.1:3000',
  },
  'reference:audit': {
    desc: '纯视觉审核 4并发 (Gemini)',
    cmd: ['node', 'scripts/maintenance/pure-vision-audit.js'],
    docs: 'docs/workflow.md#参考库',
    opts: '[--force] [--keys char/outfit/pers,...] 强制重审指定项',
  },
  'reference:repair': {
    desc: '定向修复未通过项（每项3次重渲染+重审）',
    cmd: ['node', 'scripts/maintenance/fine-tuned-repair.js'],
    docs: 'docs/workflow.md#参考库',
  },
  'reference:design': {
    desc: '三视图设计图批量渲染（增量默认跑 pending，--all 重跑）',
    cmd: ['node', 'scripts/maintenance/render-design-sheets.js'],
    docs: 'docs/workflow.md#参考库',
    opts: '[--chars=a,b] [--outfits=x,y] [--views=f,s,b] [--all] [--dry-run] [--limit=N]',
    needs: 'ComfyUI http://127.0.0.1:8188（--disable-smart-memory）',
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
  'showcase:batch-miaomiao': {
    desc: 'MiaoMiao v1.2 全库场景样张批量生成与自动发布流水线（832x1216/1216x832，3并发）',
    cmd: ['node', 'scripts/maintenance/generate-all-scenes-showcase-miaomiao.js'],
    docs: 'docs/showcase-generation-craft.md',
    opts: '[--force] [--character <id>] [--limit <n>]',
  },
  'showcase:audit': {
    desc: '批量审核 popular showcase (Gemini 4并发，rella)',
    cmd: ['node', 'scripts/maintenance/audit-showcase-rella.js', '--help'],
    docs: 'scripts/maintenance/audit-showcase-rella.js:1',
  },
  'showcase:audit:scene': {
    desc: '批量审核 scene showcase (Gemini 4并发，scene 版)',
    cmd: ['node', 'scripts/maintenance/audit-scene-showcase-run.js', '--help'],
    docs: 'scripts/maintenance/audit-scene-showcase-run.js:1',
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
  'showcase:full': {
    desc: '样张全链路：generate -> audit -> publish',
    cmd: null,
    docs: 'docs/showcase-generation-craft.md',
    steps: ['showcase:generate', 'showcase:audit', 'showcase:publish'],
  },
  'check:quick': {
    desc: '并行质量门 npm run check（13项全跑；与 gate:quick 区别：本命令全量并行，gate:quick 按改动面积只跑相关）',
    cmd: ['npm', 'run', 'check'],
    docs: 'AGENTS.md#质量门禁',
  },
  'gate:quick': {
    desc: '按改动类型分层门禁（ui|server|data|all；与 check:quick 区别：只跑改动相关面积，更快，缺省自动检测 git 改动）',
    cmd: ['node', 'scripts/maintenance/gate-quick.js'],
    opts: '[ui|server|data|all] [--verbose] [--all]',
    docs: 'docs/workflow.md',
  },
  'gate:full': {
    desc: '全量门禁：typecheck + check + 前端 + unit + contract + 打包预算（横切重构/提交前）',
    cmd: ['node', 'scripts/maintenance/gate-quick.js', 'full'],
    docs: 'docs/workflow.md',
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
  'deploy:desktop:full': {
    desc: '桌面完整部署（前端构建 + 复制 + 清缓存 + 验证 + 重启）',
    cmd: ['powershell', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/maintenance/deploy-desktop-quick.ps1'],
    docs: 'AGENTS.md:56',
  },
  // ── check: 单项门禁（可单独跑或组合）──────────────────────────────
  'check:monolith': {
    desc: '600 行红线只降不升门禁（基线 20 文件，回涨/超线/死条目 FAIL）',
    cmd: ['node', 'scripts/tests/test-monolith-budget.js'],
    docs: 'scripts/tests/test-monolith-budget.js:1',
    opts: '[--update-baseline] 重新生成基线（体量真降后用）',
  },
  'check:contrast': {
    desc: '深色主题文字对比度门禁（WCAG AA）',
    cmd: ['node', 'scripts/maintenance/check-contrast.js', '--check'],
    docs: 'AGENTS.md#动效与视觉性能铁律',
  },
  'check:animations': {
    desc: 'GPU 合成属性门禁（禁 left/top/width/height 补间）',
    cmd: ['npm', 'run', 'lint:animations'],
    docs: 'AGENTS.md#动效与视觉性能铁律',
  },
  'check:ref-urls': {
    desc: '参考库 URL 断链门禁（1869 条目全量）',
    cmd: ['node', 'scripts/maintenance/check-ref-urls.js'],
    docs: 'scripts/maintenance/check-ref-urls.js:1',
  },
  'check:pinned-scenes': {
    desc: '定稿场景字节级保护门禁（100 条手工定稿）',
    cmd: ['node', 'scripts/tests/test-pinned-scene-prompts.js'],
    docs: 'AGENTS.md#定稿场景提示词保护',
  },
  'check:rewrite': {
    desc: '批量改写完整性门禁（覆盖率/模板签名/跨条目雷同）',
    cmd: ['node', 'scripts/tests/test-prompt-rewrite-integrity.js'],
    docs: 'AGENTS.md#严禁偷懒式批量交付',
    opts: '[--delivery <交付文件>] 复检指定交付',
  },
  'check:popular': {
    desc: '热门角色与提示词契约',
    cmd: ['node', 'scripts/tests/test-popular-content.js'],
    docs: 'scripts/tests/test-popular-content.js:1',
  },
  'check:anima-routes': {
    desc: 'Anima 接口与生成边界契约',
    cmd: ['node', 'scripts/tests/test-anima-routes.js'],
    docs: 'scripts/tests/test-anima-routes.js:1',
  },
  'check:frontend': {
    desc: '前端单测（vitest，stores/utils/composables 主战场）',
    cmd: ['npm', 'run', 'test:frontend'],
    docs: 'vitest.config.ts',
  },
  'check:style-debt': {
    desc: '样式债聚合门禁（style-debt + style-literals + contrast + colors + animations）',
    cmd: ['npm', 'run', 'test:style-debt'],
    docs: 'package.json:53',
  },
  'check:bundle': {
    desc: '140KB 打包预算门禁（全站 19 路由，build:web 隐含，单独跑入口）',
    cmd: ['node', 'scripts/maintenance/check-bundle-budget.js'],
    docs: 'AGENTS.md#质量门禁',
  },
  // ── backup / runtime: 磁盘债治理 ────────────────────────────────
  'backup:git': {
    desc: 'git bundle 异地快照（v2 增量链：锚点×2 + 增量×10）',
    cmd: ['node', 'scripts/maintenance/git-bundle-backup.js'],
    docs: 'scripts/maintenance/git-bundle-backup.js:1',
    opts: '[--keep N] 增量保留份数（默认 10）',
  },
  'runtime:clean': {
    desc: '实验孤儿目录清理（dry-run 默认、白名单保护、30 天 mtime 门槛）',
    cmd: ['node', 'scripts/maintenance/clean-runtime-experiments.js'],
    docs: 'scripts/maintenance/clean-runtime-experiments.js:1',
    opts: '[--prune] 真删  [--days N] 改门槛',
  },
  'comfy:start': {
    desc: '启动本机 ComfyUI（reference/showcase 链路依赖前置，--disable-smart-memory）',
    cmd: ['powershell', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/maintenance/start-comfyui.ps1'],
    docs: 'scripts/maintenance/start-comfyui.ps1:1',
    needs: 'ComfyUI 已安装且权重就位',
  },
  // ── test: 套件入口 ────────────────────────────────────────────────
  'test:contract': {
    desc: '契约测试套件（内容/接口/热门/Anima 等聚合）',
    cmd: ['npm', 'run', 'test:contract'],
    docs: 'package.json',
  },
  'test:e2e:critical': {
    desc: '关键 e2e 套件（5 spec 132 tests，studio/flows/a11y/anima-quick/interaction-polish）',
    cmd: ['npm', 'run', 'test:e2e:critical:run'],
    docs: 'package.json',
    needs: 'playwright 浏览器已安装（npx playwright install）',
  },
  'audit:orphans': {
    desc: '探测 scripts/maintenance/ 下零引用的孤儿脚本（只读，列清单不删）',
    cmd: ['node', 'scripts/maintenance/detect-orphan-scripts.js'],
    docs: 'scripts/maintenance/detect-orphan-scripts.js:1',
    opts: '[--json] 机器可读输出',
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
