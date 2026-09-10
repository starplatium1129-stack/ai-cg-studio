#!/usr/bin/env node
'use strict';

/**
 * scripts/workflow.js — 统一工作流入口
 *
 * 解决：maintenance 脚本分散、入口难发现、参数不统一。
 * 用法：
 *   node scripts/workflow.js --help
 *   node scripts/workflow.js <group> --help
 *   node scripts/workflow.js <group>:<action> [options]
 *   npm run workflow -- <group>:<action> [options]
 *
 * 设计：薄封装，不接管业务逻辑，仅做发现、校验与转发，
 * 保持对现有脚本的完全兼容（直接 node 旧脚本仍可用）。
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const WORKFLOWS = {
  'desktop:verify-gateway': { desc: '按安装包资源映射隔离验证网关和桌宠页面', cmd: ['node', 'scripts/maintenance/verify-desktop-gateway.js'], docs: 'docs/desktop-deployment.md' },
  'desktop:doctor': { desc: '检查 Windows 桌面打包工具链与 Cubism SDK', cmd: ['node', 'scripts/maintenance/desktop-build-environment.js'], docs: 'docs/desktop-deployment.md' },
  'desktop:package-local': { desc: '跳过压缩生成本机测试安装包', cmd: ['npm', 'run', 'package:tauri', '--', '--config', 'tauri.local.json'], docs: 'docs/desktop-deployment.md' },
  'brand:build': { desc: '从手绘 SVG 母版生成绘遇字标、网站与桌面图标', cmd: ['node', 'scripts/maintenance/build-brand-assets.js'], docs: 'docs/workflow.md' },
  'docs:check': { desc: '检查文档文件链接与旧地址映射', cmd: ['node', 'scripts/maintenance/check-doc-links.js'], docs: 'docs/workflow.md' },
  'audit:workflows': { desc: '只读审计注册入口、npm 脚本、文档及复合依赖', builtin: 'audit', docs: 'docs/workflow.md' },
  'check:workflows': { desc: '工作流执行与门禁路由回归测试', cmd: ['node', 'scripts/tests/test-workflow-runner.js'], docs: 'docs/workflow.md' },
  'dev:web': { desc: '启动前端开发服务', cmd: ['npm', 'run', 'dev'], docs: 'docs/workflow.md' },
  'dev:server': { desc: '编译并启动网关', cmd: ['npm', 'start'], docs: 'docs/workflow.md' },
  'installer:modern': {
    desc: '构建现代原生安装器（--preview --capture 可安全预览，不安装）',
    cmd: ['node', 'scripts/maintenance/build-modern-installer.js'],
    docs: 'docs/guides/desktop/game-installer.md',
  },
  'installer:bundle': {
    desc: '仅重打包已构建的桌面程序并签名（只改安装界面时使用）',
    cmd: ['node', 'scripts/maintenance/release-desktop-update.js', '--bundle-only'],
    docs: 'docs/guides/desktop/game-installer.md',
  },
  'installer:build': {
    desc: '构建二游风格原生安装界面（固定版本 Tauri 模板）',
    cmd: ['node', 'scripts/maintenance/build-game-installer.js'],
    docs: 'docs/guides/desktop/game-installer.md',
  },
  'installer:preview': {
    desc: '编译安全界面预览（不安装、不提权；--page=welcome|directory|install|finish|maintenance）',
    cmd: ['node', 'scripts/maintenance/build-game-installer.js', '--preview'],
    docs: 'docs/guides/desktop/game-installer.md',
  },
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
    desc: 'popular→分片+重建聚合（popular:split 超集，从聚合文件导入；改分片用 build）',
    cmd: ['npm', 'run', 'popular:import'],
    docs: 'docs/maintenance.md',
  },
  'blueprints:build': {
    desc: '聚合场景蓝图分片 -> scene-blueprints.json',
    cmd: ['node', 'scripts/maintenance/build-blueprints.js'],
    docs: 'docs/maintenance.md#文件职责',
  },
  'blueprints:split': {
    desc: 'blueprints→分片（仅写分片文件，不重建聚合；如需重建用 blueprints:import）',
    cmd: ['node', 'scripts/maintenance/split-blueprints.js', '--write'],
    docs: 'docs/maintenance.md',
  },
  'blueprints:import': {
    desc: 'blueprints→分片+重建聚合（blueprints:split 超集，从聚合文件导入；改分片用 build）',
    cmd: ['npm', 'run', 'blueprints:import'],
    docs: 'docs/maintenance.md',
  },
  'data:import': {
    desc: 'scenes.json -> 分片 + 重建聚合（覆盖写入）',
    cmd: ['npm', 'run', 'scenes:import'],
    docs: 'docs/maintenance.md',
  },
  'data:normalize': {
    desc: '分类评级 + 规范标签 + 校验',
    cmd: ['npm', 'run', 'scenes:normalize'],
    docs: 'package.json',
  },
  'data:validate': {
    desc: '内容契约 + DATA_VERSION 校验',
    cmd: ['node', 'scripts/maintenance/validate-content-contracts.js'],
    docs: 'docs/maintenance.md',
  },
  'data:apply': {
    desc: '合并 refine-map chunks (替代 4 个 apply-*.js)',
    cmd: ['node', 'scripts/maintenance/apply-chunks.js'],
    docs: 'scripts/maintenance/apply-chunks.js:1',
    opts: '--target popular|scenes --chunks 1-17',
  },
  'reference:register': {
    desc: '登记尚无参考资产的角色形态（standards/view 形态集合对账，pending 占位不制造断链）',
    cmd: ['node', 'scripts/maintenance/register-pending-reference-outfits.js'],
    docs: 'scripts/maintenance/register-pending-reference-outfits.js:1',
    opts: '[--dry-run] [--ids=a,b,c] 默认处理所有「standards 空 + view 已有形态」的角色；登记后仍需 reference:render 出图',
  },
  'reference:render': {
    desc: '参考库批量出图（按当前角色与服装索引）（MiaoMiao v1.2 832x1216, 并发3）',
    cmd: ['node', 'scripts/maintenance/render-all-outfits-references.js'],
    docs: 'docs/workflow.md#参考库',
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
    desc: 'Anima 热门角色 × 蓝图候选出图',
    cmd: ['node', 'scripts/maintenance/generate-popular-showcase-anima11.js'],
    docs: 'docs/archive/troubleshooting/showcase-generation-craft.md',
    required: ['--output'],
    opts: '--output <候选目录> --gateway http://127.0.0.1:3000 --keys popular:角色:蓝图 --model anima-miaomiao-v1.2 --concurrency 3',
  },
  'showcase:batch-miaomiao': {
    desc: 'MiaoMiao v1.2 全库场景样张批量生成与自动发布流水线（832x1216/1216x832，3并发）',
    cmd: ['node', 'scripts/maintenance/generate-all-scenes-showcase-miaomiao.js'],
    docs: 'docs/archive/troubleshooting/showcase-generation-craft.md',
    opts: '[--force] [--character <id>] [--limit <n>]',
  },
  'showcase:scene-candidates': {
    desc: '独立场景 MiaoMiao v1.2 候选生成（仅指定 ID，不发布）',
    cmd: ['node', 'scripts/maintenance/generate-scene-showcase-anima11.js', '--model', 'anima-miaomiao-v1.2'],
    docs: 'docs/workflow.md#样张',
    required: ['--output', '--ids'],
    opts: '--output <候选目录> --ids sc001,sc002 [--concurrency 1] [--dry-run]',
  },
  'showcase:fill-gaps': {
    desc: '样张缺口补齐：对照活跃版本manifest批量渲染缺失的pc_<角色>_<场景>样张（miaomiao v1.2，按蓝图recommendedSize出图，并发3）',
    cmd: ['node', 'scripts/maintenance/render-showcase-gaps.js'],
    opts: '[--only <charId1,charId2>] [--concurrency <n>] [--gateway <url>] [--redo-mine]',
  },
  'showcase:audit': {
    required: ['--manifest', '--out'],
    desc: '批量审核 popular showcase (Gemini 4并发，rella)',
    cmd: ['node', 'scripts/maintenance/audit-showcase-rella.js'],
    docs: 'scripts/maintenance/audit-showcase-rella.js:1',
  },
  'showcase:audit:scene': {
    required: ['--manifest'],
    desc: '批量审核 scene showcase (Gemini 4并发，scene 版)',
    cmd: ['node', 'scripts/maintenance/audit-scene-showcase-run.js'],
    docs: 'scripts/maintenance/audit-scene-showcase-run.js:1',
  },
  'showcase:publish': {
    required: ['--from', '--source', '--target'],
    desc: '预览审核通过的样张发布（--apply 写入版本目录）',
    cmd: ['node', 'scripts/maintenance/publish-popular-showcase.js'],
    docs: 'docs/archive/troubleshooting/showcase-generation-craft.md',
  },
  'showcase:batch': {
    desc: '统一批量调度（替代 8 个 run-batch-* 脚本）',
    cmd: ['node', 'scripts/maintenance/run-batch.js'],
    docs: 'scripts/maintenance/run-batch.js:1',
    opts: '--source popular|scenes --batch-size 10 --concurrency 3',
  },
  'showcase:full': {
    desc: '样张链路：generate -> audit -> 发布预览（--output / --source / --target 必填）',
    cmd: null,
    docs: 'docs/archive/troubleshooting/showcase-generation-craft.md',
    steps: ['showcase:generate', 'showcase:audit', 'showcase:publish'],
  },
  'check:quick': {
    desc: '并行质量门 npm run check（注册项全跑；与 gate:quick 区别：本命令全量并行，gate:quick 按改动面积只跑相关）',
    cmd: ['npm', 'run', 'check'],
    docs: 'AGENTS.md#实施与交付',
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
    docs: 'AGENTS.md#实施与交付',
  },
  'build:runtime': {
    desc: '编译 services/*.ts -> .js',
    cmd: ['npm', 'run', 'build:runtime'],
    docs: 'package.json',
  },
  'deploy:desktop': {
    desc: '桌面增量部署（跳过构建）',
    cmd: ['deploy-desktop.bat', '-SkipBuild'],
    docs: 'docs/desktop-deployment.md',
  },
  'deploy:desktop:full': {
    desc: '桌面完整部署（前端构建 + 复制 + 清缓存 + 验证 + 重启）',
    cmd: ['deploy-desktop.bat'],
    docs: 'docs/desktop-deployment.md',
  },
  // ── check: 单项门禁（可单独跑或组合）──────────────────────────────
  'check:monolith': {
    desc: '600 行红线只降不升门禁（以 monolith-baseline.json 为准）',
    cmd: ['node', 'scripts/tests/test-monolith-budget.js'],
    docs: 'scripts/tests/test-monolith-budget.js:1',
    opts: '[--update-baseline] 重新生成基线（体量真降后用）',
  },
  'check:contrast': {
    desc: '双主题全局与角色强调色对比度门禁（WCAG AA）',
    cmd: ['node', 'scripts/maintenance/check-contrast.js', '--check'],
    docs: 'AGENTS.md#质量红线',
  },
  'check:animations': {
    desc: 'GPU 合成属性门禁（禁 left/top/width/height 补间）',
    cmd: ['npm', 'run', 'lint:animations', '--', '--check'],
    docs: 'AGENTS.md#质量红线',
  },
  'check:ref-urls': {
    desc: '参考库 URL 断链门禁（按当前索引，pending 不算已发布）',
    cmd: ['node', 'scripts/maintenance/check-ref-urls.js'],
    docs: 'scripts/maintenance/check-ref-urls.js:1',
  },
  'check:pinned-scenes': {
    desc: '定稿场景字节级保护门禁（100 条手工定稿）',
    cmd: ['node', 'scripts/tests/test-pinned-scene-prompts.js'],
    docs: 'AGENTS.md#质量红线',
  },
  'check:rewrite': {
    desc: '批量改写完整性门禁（覆盖率/模板签名/跨条目雷同）',
    cmd: ['node', 'scripts/tests/test-prompt-rewrite-integrity.js'],
    docs: 'AGENTS.md#质量红线',
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
    docs: 'package.json',
  },
  'check:bundle': {
    desc: '打包预算门禁（路由与依赖闭包，build:web 隐含）',
    cmd: ['node', 'scripts/maintenance/check-bundle-budget.js'],
    docs: 'AGENTS.md#实施与交付',
  },
  // ── backup / runtime: 磁盘债治理 ────────────────────────────────
  'backup:git': {
    desc: 'git bundle 本地第二副本（v2 增量链：锚点×2 + 增量×10）',
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
    desc: '关键 e2e 套件（用例数以执行结果为准；studio/flows/a11y/anima-quick/interaction-polish）',
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
    cmd: ['npm', 'run', 'character:onboard'],
    docs: 'docs/guides/characters/character-onboarding-workflow.md',
  },
};

const { main } = require('./lib/workflow-runner');
if (require.main === module) process.exitCode = main(process.argv.slice(2), WORKFLOWS, ROOT);
module.exports = { WORKFLOWS };
