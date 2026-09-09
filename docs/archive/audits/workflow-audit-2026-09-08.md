# 工作流审计与修复

> 历史记录：本文保留原始结论与验证边界，归档不表示遗留事项已经完成。当前优先级见 [未来规划](../../roadmap.md)。

审计日期：2026-09-08。范围：统一注册入口、npm scripts、快速/完整门禁、桌面批处理、三条 GitHub Actions 配置与维护脚本引用。没有执行实际出图、视觉审核付费服务、发布或桌面安装。

## 入口清单

现有 60 个注册入口，可通过 `npm run wf -- --help` 获取实时清单。分组包括 dev、data、popular、blueprints、reference、showcase、character、check、gate、build、installer、deploy、comfy、test、backup、runtime、audit。完整操作表见 [工作流手册](../../workflow.md)。

## 已修复

| 问题 | 修复 |
| --- | --- |
| 帮助启动底层脚本，部分脚本不识别 --help 而直接运行 | 帮助统一只读展示，不创建子进程 |
| 固定 --help 导致支持帮助的命令永远不执行，不支持帮助的命令反而运行 | 移除执行命令中的固定帮助参数 |
| npm 缺少参数分隔符，shell 转发破坏带空格参数 | 调用 npm JS 入口并补 --，普通脚本不用 shell |
| 样张生成、审核、发布默认各读不同历史目录 | 复合链路显式共享 manifest/audit 路径，单项要求指定文件/版本 |
| 复合工作流把所有参数盲传给所有步骤 | 样张按步骤映射；参考复合入口拒绝公共参数，定向操作用子命令 |
| 场景 import 只拆分，与 npm scenes:import 不一致；popular/blueprints 描述误导 | 统一场景导入并重建；纠正分片编辑应使用 build 的说明 |
| 快速门禁遗漏 server.js、package、配置等改动；Git 错误被当成无改动 | NUL 分隔读取 Git 路径，读取失败报错，横切/未知代码升级 full |
| 门禁 --all 与 --verbose 混淆，跨面积失败仍继续 | --all 独立控制继续运行，默认失败停止；拼错参数报错 |
| 桌面工作流绕开唯一入口，丢失默认 Cleanup；批处理可能丢失失败码 | 统一调用 deploy-desktop.bat，保存退出码，自动调用免按键 |
| build:all/prod 重复预压缩 | 去掉 build 已包含的重复步骤 |
| 检查列表 --list 仍会构建缺失数据 | 展示列表后直接退出，初始化移到实际执行路径 |
| Nightly 使用浮动 Actions 版本，未纳入固定版本检查 | 复用 Quality 中已有固定 SHA/Node 版本，关闭凭据保留，纳入测试 |
| 工作流缺乏搜索和统一预览 | 新增 wf 短入口、search、--plan、audit:workflows、check:workflows |

新增确定性回归已登记 check 套件。入口审计是静态一致性检查，不验证外部服务是否可用。

## 维护脚本发现

只读孤儿探测报告：101 个维护脚本中 94 个有引用，7 个零引用候选：build-scene-manual-audit-sheets.py、compare-sage-ab.py、download-minimax-h3.js、download-torch-cu130.ps1、manual-short-prompt-pilot.js、repair-character-reference-urls.js、short-prompt-batch.js。这是修复前扫描快照；候选没有删除或执行，零引用不等于无用途。

## 本次验证

- audit:workflows：60 个入口，0 个引用/依赖错误。
- check:workflows：7 个行为回归测试通过，覆盖所有入口帮助、预览、失败退出、参数转发、样张文件衔接、门禁分类与桌面隔离失败测试。
- gate:full：PASS，1 分 50 秒；21 步 check、前端测试、411 个 unit 用例、25 个 contract 文件、生产构建及预算全部通过。
- 单独 typecheck:app、data:validate、check:animations 与样张三阶段 --plan 实测通过。
- 首次全量检查发现本轮编辑文件的 CRLF 不符合 LF 规范，已纠正后重跑通过；桌面批处理按其格式保留 CRLF。
- 全量之后对桌面隔离失败测试与入口说明的补充已单独重跑 check:workflows。

未执行：远程 GitHub Actions、浏览器视觉矩阵、真实出图、模型下载、生产发布、桌面同步/安装及 UAC。此次未修改产品 UI、提示词、定稿场景或参考媒体。

## 注册入口完整清单

以下为本次交付快照，后续以 --help 的实时清单为准。

| 入口 | 用途 |
| --- | --- |
| `audit:orphans` | 探测 scripts/maintenance/ 下零引用的孤儿脚本（只读，列清单不删） |
| `audit:workflows` | 只读审计注册入口、npm 脚本、文档及复合依赖 |
| `backup:git` | git bundle 本地第二副本（v2 增量链：锚点×2 + 增量×10） |
| `blueprints:build` | 聚合场景蓝图分片 -> scene-blueprints.json |
| `blueprints:import` | blueprints→分片+重建聚合（blueprints:split 超集，从聚合文件导入；改分片用 build） |
| `blueprints:split` | blueprints→分片（仅写分片文件，不重建聚合；如需重建用 blueprints:import） |
| `build:runtime` | 编译 services/*.ts -> .js |
| `build:web` | 前端构建 + 预算 + 预压 |
| `character:onboard` | 一站式新角色接入（档案/标准/粒子/参考图/样张/DATA_VERSION） |
| `check:anima-routes` | Anima 接口与生成边界契约 |
| `check:animations` | GPU 合成属性门禁（禁 left/top/width/height 补间） |
| `check:bundle` | 打包预算门禁（路由与依赖闭包，build:web 隐含） |
| `check:content` | 仅内容契约 + DATA_VERSION |
| `check:contrast` | 双主题全局与角色强调色对比度门禁（WCAG AA） |
| `check:frontend` | 前端单测（vitest，stores/utils/composables 主战场） |
| `check:full` | 完整校验：check + frontend + unit + contract |
| `check:monolith` | 600 行红线只降不升门禁（以 monolith-baseline.json 为准） |
| `check:pinned-scenes` | 定稿场景字节级保护门禁（100 条手工定稿） |
| `check:popular` | 热门角色与提示词契约 |
| `check:quick` | 并行质量门 npm run check（注册项全跑；与 gate:quick 区别：本命令全量并行，gate:quick 按改动面积只跑相关） |
| `check:ref-urls` | 参考库 URL 断链门禁（按当前索引，pending 不算已发布） |
| `check:rewrite` | 批量改写完整性门禁（覆盖率/模板签名/跨条目雷同） |
| `check:style-debt` | 样式债聚合门禁（style-debt + style-literals + contrast + colors + animations） |
| `check:workflows` | 工作流执行与门禁路由回归测试 |
| `comfy:start` | 启动本机 ComfyUI（reference/showcase 链路依赖前置，--disable-smart-memory） |
| `data:apply` | 合并 refine-map chunks (替代 4 个 apply-*.js) |
| `data:build` | 聚合场景分片 -> scenes.json（热门角色见 popular:build） |
| `data:import` | scenes.json -> 分片 + 重建聚合（覆盖写入） |
| `data:normalize` | 分类评级 + 规范标签 + 校验 |
| `data:validate` | 内容契约 + DATA_VERSION 校验 |
| `deploy:desktop` | 桌面增量部署（跳过构建） |
| `deploy:desktop:full` | 桌面完整部署（前端构建 + 复制 + 清缓存 + 验证 + 重启） |
| `dev:server` | 编译并启动网关 |
| `dev:web` | 启动前端开发服务 |
| `gate:full` | 全量门禁：typecheck + check + 前端 + unit + contract + 打包预算（横切重构/提交前） |
| `gate:quick` | 按改动类型分层门禁（ui / server / data / all；与 check:quick 区别：只跑改动相关面积，更快，缺省自动检测 git 改动） |
| `installer:build` | 构建二游风格原生安装界面（固定版本 Tauri 模板） |
| `installer:bundle` | 仅重打包已构建的桌面程序并签名（只改安装界面时使用） |
| `installer:modern` | 构建现代原生安装器（--preview --capture 可安全预览，不安装） |
| `installer:preview` | 编译安全界面预览（不安装、不提权；--page=welcome / directory / install / finish / maintenance） |
| `popular:build` | 聚合热门角色分片 -> popular-characters.json |
| `popular:import` | popular→分片+重建聚合（popular:split 超集，从聚合文件导入；改分片用 build） |
| `popular:split` | popular→分片（仅写分片文件，不重建聚合；如需重建用 popular:import） |
| `reference:audit` | 纯视觉审核 4并发 (Gemini) |
| `reference:design` | 三视图设计图批量渲染（增量默认跑 pending，--all 重跑） |
| `reference:full` | 参考库全链路：render -> audit -> repair |
| `reference:register` | 登记尚无参考资产的角色形态（standards/view 形态集合对账，pending 占位不制造断链） |
| `reference:render` | 参考库批量出图（按当前角色与服装索引）（MiaoMiao v1.2 832x1216, 并发3） |
| `reference:repair` | 定向修复未通过项（每项3次重渲染+重审） |
| `runtime:clean` | 实验孤儿目录清理（dry-run 默认、白名单保护、30 天 mtime 门槛） |
| `showcase:audit` | 批量审核 popular showcase (Gemini 4并发，rella) |
| `showcase:audit:scene` | 批量审核 scene showcase (Gemini 4并发，scene 版) |
| `showcase:batch` | 统一批量调度（替代 8 个 run-batch-* 脚本） |
| `showcase:batch-miaomiao` | MiaoMiao v1.2 全库场景样张批量生成与自动发布流水线（832x1216/1216x832，3并发） |
| `showcase:fill-gaps` | 样张缺口补齐：对照活跃版本manifest批量渲染缺失的pc_<角色>_<场景>样张（miaomiao v1.2，按蓝图recommendedSize出图，并发3） |
| `showcase:full` | 样张链路：generate -> audit -> 发布预览（--output / --source / --target 必填） |
| `showcase:generate` | Anima 热门角色 × 蓝图候选出图 |
| `showcase:publish` | 预览审核通过的样张发布（--apply 写入版本目录） |
| `test:contract` | 契约测试套件（内容/接口/热门/Anima 等聚合） |
| `test:e2e:critical` | 关键 e2e 套件（用例数以执行结果为准；studio/flows/a11y/anima-quick/interaction-polish） |
