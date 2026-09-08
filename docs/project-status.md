# 项目当前状态

> 2026-09-08 仓库快照；版本 1.5.9（package.json）。本页是规模与已实现能力的唯一总入口。数据变化后重新统计，不把 DATA_VERSION 当作固定发布日期。

## 数据规模

| 项目 | 数量 | 事实源与口径 |
| --- | ---: | --- |
| 角色档案 | 160 | data/characters.json 数组长度 |
| 热门角色 | 158 | data/popular-characters.json 的 characters；候选四十九位已全部接入 |
| 热门服装形态 | 896 | 上述 characters[].outfits 长度之和 |
| 通用场景 | 302 | data/scenes.json 数组长度 |
| 场景蓝图 | 1,681 | data/scene-blueprints.json 的 blueprints |
| 参考库角色 / 已登记形态 | 160 / 593 | standards.characters 与 view 的 outfits；不同于热门服装总数 |
| 参考条目 | 4,151 | view 中全部 outfits[].references |
| 非 pending 且有 URL / pending | 2,534 / 1,617 | 登记统计，不代表出图或视觉审核完成 |

## 已有能力与边界

- Vue 3、Vite、TypeScript、Pinia；Express 网关与 Tauri 2 桌面壳。业务状态在 composable/store，服务端服务以 TypeScript 源与生成产物协同维护。
- 深浅主题已接入，默认深色；实现见 useTheme.ts、AppThemeToggle.vue、light-theme.css。对比度脚本已覆盖双主题全局令牌与角色强调色；组件级动态样式仍需浏览器视觉验收。
- SD/WAI、Anima、Krea 2 分引擎编译。Anima 当前默认 MiaoMiao Harem v1.2；具体模型/采样参数从生产配置与路由读取，不沿用历史实验表。
- Krea 2 的基础 T-Enhancer 已接线（routes/anima/workflows.js），旧文档“Enhancer 关闭”失效；高级节点与风格 API 仍需独立验证。
- 场景/热门角色/参考库、作品册、聊天/语音/Live2D、视频分镜与桌宠已有实现。已有实现不等于本轮真实设备或出图复验通过。
- 训练页面与路由已移除；历史 LoRA 训练协议仍可查阅 [训练记录](anima-training-record.md)，不是当前在线模块。
- 分级遵循本机/远程边界，素材占位与真实图片分开计数。参考图不入 Git，经 view 索引懒加载。
- 当前 158 位热门角色均登记为成年资格；R18 蓝图仍必须经过本机授权与成人开关，远程/未知状态继续 fail-closed。
- Git bundle 当前是最多 2 个全量锚点与默认 10 个增量（git-bundle-backup.js），属于本地第二副本；提交后仍须推送远端。

## 验证与后续

新增 49 位角色本轮已补充 36 位待补立绘，并精修 71 条全年龄场景、新增 59 套日常服装。样张生成与逐图发布进度见[本轮记录](new49-character-refinement-2026-09-08.md)，新增服装的参考机位仍为 pending。

文档审计结果见 [审计记录](documentation-audit-2026-09-08.md)。第五批 6 位与第六至九批 36 位角色现已按用户确认统一登记为成年角色；新增角色均具备完整 R18 蓝图，第六至九批另补齐 6~7 条 SFW（含圣洁花嫁与海滨泳装）。36 条首条 R18 样张已使用生产 MiaoMiao v1.2 完成本地真实渲染抽查，完整图像发布、参考图与其余样张仍按待补状态管理。此前的测试、截图、模型和桌面验收只代表各自记录时点，集中保留在 [归档](archive/README.md)。后续工作只在 [未来规划](roadmap.md) 排序。
