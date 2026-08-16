# 词条组装审计修复记录（2026-08-15）

> 来源：两路审计（词条组装专项 + 跨功能集成）汇总报告。本文件记录本会话
> （词条组装/工作室路径）已落地的修复；**视频链路（`VideoStudioView.vue` /
> `routes/video.js`）的 4 个跨功能 bug 归视频协作者维护，本会话未触碰**。

## 已修复（P1/P2/P3）

| # | 问题 | 修复 | 验证 |
|---|---|---|---|
| 1 | `panelSuppress` 裸字符串拼接绕过去重管道，150 蓝图 `multiple girls`、6 个 `crowd` 在最终负面重复 | `popularContent.ts` 改 `mergeTokenText(negative, panelSuppress)`（tokenize→normalizeKey 精确去重） | 雷电影天守阁实测：51 个负面 token 零重复，`multiple_girls`/`crowd` 各出现一次 |
| 2 | 健康面板分析的是平行组装结果而非真实下发 prompt（Anima/Krea） | `usePromptAssembly` promptReport 非 SD 分支改分析 `renderPromptPlan` 真实渲染文本；与 `usePopularPromptAssembly` 对齐；`analyzeParts` 新增可选 `engine` 参数 | 单测 + corpus 全绿 |
| 3 | 中文 visualDescription 未过 plainEnglish 门控直入英文模型 | `createPromptPlan` 统一门控 `visualDescription: plainEnglish(...)`；两个 composable 在面板提示「已丢弃」 | 实测中文描述被门控为空，面板提示生效 |
| 4 | Krea 禁权重语法无统一强制点，sceneProse 等只过 `clean()` | krea2 渲染分支入口新增 `sanitizeKreaProse()`（剥 `<lora:>`/BREAK/`(tag:1.5)` 权重语法/score·质量词/下划线），覆盖 subject/outfit/scene/visualDescription/artistProse/style/medium | 实测 `(warm_lamp:1.5)`→`warm lamp light`、`score_7` 移除、无下划线 |
| 5 | `negativeTokens` 数据格式不一致（174 字符串 + 162 单元素逗号串） | 解析器 `negativeStringList` 数组分支 flatMap 按逗号切分；新增 `scripts/maintenance/normalize-negative-tokens.js` 并把 336 条数据统一为真数组（token 总数 6556 不变做无损校验）；`enhance-scene-blueprints-lighting.js` / `build-character-scenes.js` / `generate-popular-showcase-anima11.js` 同步输出真数组防回归；`sceneStore.ts DATA_VERSION` 升至 1927222053 | `data/scene-blueprints.json` 336/336 真数组、0 不合规；`test-popular-content.js` 全绿 |
| 6 | 健康面板检测缺口 | `analyzeParts(parts, engine)` 新增五类检测：Krea 权重语法残留、Krea 下划线 token、Krea score/质量词、Krea 负面词非空（应恒空）、非 ASCII 混入（Anima/Krea）、负面 token 重复；Krea 纯散文跳过标签数量阈值避免误报 | 实测五类警告全部触发 |
| 7 | 质量词清单三份漂移 | `promptPolicy.ts` 导出 `QUALITY_WORDS` 单一权威清单，`QUALITY_TOKENS` / `QUALITY_OR_SCORE_RE` 派生；`promptCompiler` 删除本地副本改导入；`PromptHealthPanel.vue` 从 `QUALITY_WORDS` 空格化派生 `QUALITY_RE` | eslint/typecheck/build 全绿 |
| 8 | 光照 part 用 `cls:'c'` 与其余氛围词 `'t'` 不一致 | `usePromptAssembly.ts` 光照 part 改 `cls:'t'` | typecheck 全绿 |

## 未处理（归视频协作者 / 待决策）

- 视频页 4 个跨功能 bug（错误信息被清空、`aspectRatio='original'` 残留 400、
  桥接 prompt 超 1200 字无提示、fallback 语言混杂）——`AGENTS.md` 约定视频链路
  归视频协作者维护，本会话不碰。
- exactTokens 括号消歧 `rem_(re_zero)` → `rem (re zero)` 仍按待办 A/B 后再改。
- R18 蓝图负面盲复制含 `school, modern, day` 属模板残留，未动（涉及出图语义，待决策）。
- SD 组装镜头词顺序（取景先于场景）未动（影响出图，待 A/B）。

## 验证基线

- `node scripts/tests/test-prompt-policy.js` / `test-prompt-compiler.js` /
  `test-popular-content.js` / `test-prompt-corpus.js` / `test-prompt-builder-modules.js`：全绿
- `npm run typecheck:app`、`npm run build`（bundle budget 通过）、eslint 变更文件：全绿
- E2E：`anima-quick.spec.ts` + `studio.spec.ts`（见本会话执行结果）

## 发现的仓库既有红灯（与本次改动无关，HEAD 复现确认）

1. `validate-content-contracts.js`：`characters[20..34].speech is required`
   （`data/characters.json` 15 个方舟角色缺 speech 字段，工作树未改此文件）。
2. `test-quality-prompt-contract.js`「short prompt builder reproduces the sc300
   contract」：`data/scenes.json` 中 sc300 为 R15，测试断言 `nsfw` 恒失败
   （short-prompt-builder.js 与场景数据均未改动）。
   - 用临时 `git worktree`（HEAD 快照 + node_modules junction）复现：两处失败
     在 pristine HEAD 上一模一样，非本次改动引入。
