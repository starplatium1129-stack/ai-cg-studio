# 视频提示词链路（出图 → 视频）设计与疑难留档

> 日期：2026-08-16 · 状态：已解决 · 涉及：PromptBuilderView / useVideoBridge / VideoStudioView / routes/video.js / videoPromptProse.ts

## 链路总览

```
出图（词条流）  →  goToVideo「按图取词」  →  tagsToVideoProse（词条→自然语言）
   ↓                                        ↓
该图实际生成的提示词                视频页提示词框（可编辑）
                                             ↓ 提交
                                    routes/video.js H3 官方三段式组装
                                             ↓
                                    MiniMax H3（T2VA / I2VA）
```

## 疑难 1：视频页提示词不跟随出图提示词

- **现象**：出图后点「出视频」，视频页提示词是旧的/不含本次出图的词条修改。
- **根因**：桥接只传 `pb.story`（场景描述框），词条/角色/场景改动不进 story；且传 `livePrompt`（实时组装值）会在「出图后改面板」时漂移。
- **修复**（`bf23ff8` / `a853c82`）：
  - 桥接上下文新增 `prompt` 字段；
  - **按图取词**：Anima 取 `result.metadata.prompt`、SD 取新增的 `resultPrompt`（`useSDGenerate` 提交时记录 `payload.prompt`），面板实时值只作兜底；
  - `saveHistory` 的 SD 分支同步按图取词（存历史不漂移）。

## 疑难 2：词条流直塞 H3（tag → 自然语言转换）

- **现象**：按图取词后，视频提示词是 `safe, 1girl, red hair, ...` 词条流；H3 是自然语言模型，效果差。
- **根因**：协作者的官方组装（`d9bcfa6`）只做「组装成官方格式」，输入源原设计是 story/场景 prose（roadmap 明确「不做 tag 翻译」）；按图取词引入词条流后缺转换层。
- **修复**（`00a51b5`，`src/utils/videoPromptProse.ts`）：
  - 过滤质量/安全/评分词（safe / score_9 / masterpiece …）；
  - 主体计数词语法化（1girl→a girl、2girls→two girls …）；
  - 首个发色 + 首个瞳色合并进主句（`a girl with red hair and red eyes, …`），发型等修饰保留在后；
  - 其余词条（服装/场景/动作/角色标识）原样保留，**不翻译**（避免 tag 转译引入错误语义）；
  - 启发式 `looksLikeTagStream`：已像自然语言（Krea/Anima prose、中文句）原样返回，不误伤。

## 疑难 3：H3 组装不符合官方 skill

- **现象**：对照 `h3-prompt-writing` 官方 base-en.txt 逐条审计，发现 3 处不符。
- **修复**（`6573b68`，routes/video.js）：

| 官方要求 | 修复前 | 修复后 |
|---|---|---|
| 4.1 `[Shot 1]` 开头声明风格 | 缺 | `[Shot 1] 2D-animated, cinematic, …`（H3_STYLE） |
| 4.6 soundscape 具体声音 1-4 句 | 模板泛化 | 具体化（布料摩擦/呼吸/环境底噪） |
| 4.7 music 写器乐/节奏/动态、**禁抽象情绪词** | `fits the mood`（违规） | 钢琴+低弦、渐强渐弱（H3_MUSIC） |

- I2VA 首行指令与 `<Picture 1>` 锚点句本就逐字符合官方（保留）。
- 测试断言升级：新增风格锚点断言 + `doesNotMatch /fits the mood/`。

## 疑难 4：R18 长词条超限（1200 vs 4000 契约不一致）

- **现象**：热门 R18 Anima 词条转换后 2001B，视频页生成按钮被禁用。
- **根因**：前端自设 `maxlength=1200`，服务端契约实为 `MAX_PROMPT_LENGTH = 4000`。
- **修复**（`4ee0c76` 截断方案 → `7b70bfa` 正确方案）：前端上限 1200 → 4000 对齐服务端，**R18 词条全量通过、不截断不丢内容**；转换函数保持纯粹（不硬编码业务上限）。

## 疑难 5：场景选择不联动（组件复用 / bfcache）

- **现象**：角色档案/角色场景页点场景卡片后，绘图页场景/故事/提示词「还是上一个」。
- **根因**：Vue Router 组件复用与 Chromium bfcache 恢复时组件不重挂载，`onMounted` 深链不执行；且 `?popular=` 深链带 `!pb.isPopular` 条件，热门模式二次进入被整体跳过。
- **修复**（`6c14d15`）：
  - 深链抽成 `applyDeepLink(q)` 并去掉 `!pb.isPopular` 条件；
  - 新增 `watch(route.query)` + `deepLinkNeeded`（URL 与当前选中不一致才重放，不覆盖用户手动编辑）；
  - `App.vue` 加 `pageshow`（bfcache 恢复）路由同步兜底。
- 关联修复：角色档案「人设核心场景」卡片补 `blueprint=`（`4257365`）；热门蓝图选择后场景故事跟随（`2a679f4`）。

## 转换覆盖度审计（真实数据，10/10 OK）

热门 Anima/Krea（SFW+R18）、工作室 SD（单/双人）、工作室 Anima（prose+tags 混合）、中文混合——全部通过。Krea/Anima 自然语言被启发式保护原样保留。

## 已知局限

1. **中文描述不翻译**：H3 官方要求描述用英文；中文场景句原样进 H3（效果打折）。预留「本地 LLM 精修」为可选增强。
2. **多主体只取第一个发型进主句**（`two girls with long hair, red hair, black hair, …`）——可读可接受。

## 验证清单

- `node --test scripts/tests/test-video-prompt-prose.js`（6 用例：转换/无主体兜底/自然语言不误伤/空输入/长流不截断）
- `node --test scripts/tests/test-video-routes.js`（H3 组装断言：风格锚点/字段顺序/禁 mood 词/官方首帧指令）
- `node --test scripts/tests/test-gateway-contract.js`
- 真实数据覆盖度审计脚本（已归档为一次性工具，见 git 历史）
- typecheck:app + build 通过；桌面端完整打包 + quick deploy 双路径验证
