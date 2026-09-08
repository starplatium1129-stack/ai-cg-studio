# 统一工作流手册

> 维护日期：2026-09-08。命令注册与默认参数以 scripts/workflow.js 为准；此页解释操作顺序，不重复易漂移的脚本数量、角色规模和历史测试用例数。

## 先查入口

`npm run workflow -- --help` 查看全部命令，`node scripts/workflow.js reference --help` 查看分组。具体命令帮助会转发到脚本，执行前应阅读脚本参数；不能假定所有脚本都实现 --dry-run。

没有入口时查 scripts/maintenance 或运行 `npm run workflow -- audit:orphans --json`。有现成流程必须复用；新增脚本同时登记 WORKFLOWS、本手册分组，新增文档登记 INDEX.md；一次性脚本用完归入 scripts/archive。

## 数据维护

| 操作 | 入口 | 注意事项 |
| --- | --- | --- |
| 场景分片聚合 | data:build | data/scenes → scenes.json |
| 热门角色聚合 | popular:build | data/popular → popular-characters.json |
| 蓝图聚合 | blueprints:build | 使用既有蓝图分片源，不直接改聚合产物 |
| 聚合反向写回分片 | data:import / popular:import / blueprints:import | 覆盖写入操作，先核对 diff；popular:split/blueprints:split 只拆分 |
| 数据契约与版本 | data:validate | DATA_VERSION 哈希域以 scripts/lib/data-version.js 为唯一事实源 |
| 分类与规范化 | data:normalize | 会写数据，不用于只读文档审计；遵守定稿保护 |

详细文件职责见 [维护手册](maintenance.md#文件职责)。构建脚本会同步版本；校验失败需定位来源，不能只改版本掩盖数据漂移。

## 参考库

1. `reference:register --dry-run` 对账待登记形态；核对后按需登记。
2. `reference:render` 生成参考图；`reference:design` 补三视图设计图。合计 4 种肖像机位 + 3 种设计机位。
3. `reference:audit --force --keys <角色/服装/机位前缀>` 定向重审，`reference:repair` 修复。
4. `check:ref-urls` 与网关共用素材目录解析（AICS_CHARACTER_REF_ROOT → AI 工作区 → assets/character-references）。显式目录失效不会静默换库；pending 不等于真实资产，也不等于通过视觉审核。

`reference:full` 是 render → audit → repair，不包含自动完成所有新增形态登记与设计图的承诺。参考图片不入 Git；旧问题配方见 [历史参考审计](archive/audits/character-reference-audit-pending.md)。

## 样张

| 操作 | 入口 |
| --- | --- |
| 热门/场景批量调度 | showcase:batch --source popular 或 --source scenes |
| 当前 MiaoMiao 批次 | showcase:batch-miaomiao |
| 活跃 manifest 缺口补齐 | showcase:fill-gaps |
| 生成、审核、发布 | showcase:generate / showcase:audit / showcase:audit:scene / showcase:publish |
| 复合链路 | showcase:full（generate → audit → publish） |

发布目标必须使用配置解析的活跃版本目录，不写死日期目录。旧参数与实测方法见 [样张工艺记录](showcase-generation-craft.md)，当前 checkpoint 以脚本/网关配置为准。

## 角色接入

`character:onboard --character <id>` 为自动化辅助；`--skip-render` 跳过出图，不能据此声明资产完成；`--deploy` 涉及桌面同步。必须同时核对 [六层契约](engineering-contracts.md#角色接入) 和 [接入步骤](character-onboarding-workflow.md)。

## 门禁与构建

| 入口 | 实际范围 |
| --- | --- |
| gate:quick ui/server/data/all | 按变更面积分层；默认检测 Git 改动 |
| check:quick | npm run check 的全部已注册并行检查 |
| check:full | npm run validate：check + frontend + unit + contract；不包含 typecheck:app 或 build |
| gate:full | typecheck + check + frontend + unit + contract + build，提交前完整入口 |
| build:web / build:runtime | 前端与预算/预压；服务 TypeScript 编译 |
| check:style-debt | 样式字面值、颜色、动画和双主题全局/角色令牌对比度；动态组件另做视觉验收 |
| check:monolith / check:pinned-scenes / check:rewrite | 体量、定稿与改写完整性；rewrite 交付需传 --delivery |
| check:popular / check:anima-routes / check:frontend | 热门、Anima 接口与前端单测 |
| test:contract / test:e2e:critical | 契约套件与关键浏览器回归 |

预算包括路由 JS 140 KiB、CSS、入口与依赖闭包等，完整阈值见 check-bundle-budget.js。测试规模与路由数量以当次输出为准；历史 PASS 不能代替本次检查。

## 服务与桌面部署

现代安装器：`installer:modern --preview --capture --theme=dark --state=ready --dpi=144` 编译安全预览（不安装），支持 dark/light 与 ready/installing/done/error。正式发行脚本将现代展示层与 NSIS 核心一起打包并对最终 exe 签名。

底层游戏式安装器：`installer:build` 生成模板与素材，`installer:preview --capture --page=welcome` 安全预览；详情见 [安装界面维护](game-installer.md)。`package:tauri` 已自动接入，无需手工修改生成的 NSIS 脚本。
仅更改安装界面且已有同版本程序时，`installer:bundle` 重新打包并签名；它不编译应用源码。

参考/样张链路需要 ComfyUI 和网关在线。ComfyUI 默认 8188，接入脚本网关默认 3000，配置可覆盖；3123 是历史端点，不作为通用默认。使用前核对所选脚本与本机服务配置。`comfy:start` 为现成启动入口。

桌面唯一入口是 `deploy-desktop.bat`。`deploy:desktop` 默认跳过构建，必须已有新构建；`deploy:desktop:full` 执行完整增量流程。依赖/exe 变化的完整安装与 UAC 见 [部署指南](desktop-deployment.md)。

## 备份与清理

`backup:git` 创建本地 bundle 增量链（2 个锚点 + 默认 10 个增量），不能替代 push 或异地副本。`runtime:clean` 默认只预览；`--prune --days 60` 会实际清理。先检查路径与白名单，避免清除当前运行资料。
