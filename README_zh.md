# AI CG Studio

> **从故事，到画面**
>
> 不是写 Prompt，而是导演一张 CG。
>
> *每一张优秀的 CG，都始于一个故事。*

English: [README.md](README.md)

---

## 这是什么？

AI CG Studio 是 **AI Galgame CG 创作工作台** — 面向 AI 创作者的 **Scene 库**，不是 Prompt 库。

| ❌ 别人给 | ✅ 我们给 |
|---|---|
| 5000 条 Prompt | 206 个 Scene |

一条 Scene 抵过一千条 Prompt。每条 Scene 包含故事、情绪、镜头、构图、光照、推荐参数、Prompt、Negative、LoRA 推荐、推荐用途 — 完整的创作单元。

**我们不管理 Prompt。我们管理 Scene。**

---

## 创作摩擦

打开 WebUI，面对空白 Prompt。十五分钟过去了，还没开始生成。

这不是"不会写 Prompt"，这是 **Creative Friction** —— 脑海里有画面，却不知道如何把它翻译成 Prompt。

AI CG Studio 的工作，是把这个摩擦降到最低。

---

## 四层模型

```
第一层  Story      （灵感 → 一句话故事）
第二层  Scene      （故事 → 情绪 / 镜头 / 构图 / 光照 / ...）
第三层  Prompt     （Scene → 自动翻译为 SD 能懂的 token）
第四层  Image      （Prompt → 最终画面）
```

**Prompt 只是 Scene 的一种输出，不是产品核心。**

---

## Workflow

```
灵感
 ↓
Story
 ↓
Scene（角色 · 情绪 · 镜头 · 构图 · 光照 · 色彩）
 ↓
Prompt（自动生成）
 ↓
生成 CG
 ↓
Review → Favorite → Library
```

---

## Active Sync Protocol

**动态情感占位符系统**——让同一个 Scene 根据故事上下文自动调整 Prompt 强度。

三个维度：

| 维度 | 占位符 | 级别 |
|---|---|---|
| 情感强度 | `{intimacy_intensity}` | low → moderate → high → overload → infinite |
| 互动目标 | `{interaction_target}` | direct_eye_contact / physical_touch / psychic_link / triad_merge |
| 感官反馈 | `{sensory_feedback}` | thermal_fluctuation / haptic_feedback / visual_hysteresis / auditory_resonance |

Director 工作台输入故事文本时，Active Sync 自动解析关键词并替换 Scene Prompt 中的占位符。10 个专用场景（sc028–sc031, sc123–sc128）已内置支持。

---

## 产品架构

```
AI CG Studio
│
├── Create          ← 最大入口（Director，Story → 情绪/镜头/光照 → Prompt 自动）
├── Scene Library   ← 起点，206 个场景种子（多维分类）
├── Gallery         ← 创作时间线（收藏 / 评分 / 重新生成）
├── Character       ← 角色卡 + 视觉 DNA + 绑定 LoRA
├── Style           ← 色彩 = 情绪 = 光照
├── LoRA            ← 角色资产（强度/触发词/兼容模型）
└── Learn（Docs）    ├── 理念 / 规范 / 路线（折叠，不打扰创作）
```

---

## 三原则（永远不违反）

1. **Scene First** — 先有画面，后有 Prompt。Prompt 永远是最后一步。
2. **Character First** — 人物永远是画面中心。所有元素都服务于角色。
3. **Emotion First** — 用户记住的不是 Prompt，而是"那个放学后的黄昏"。

---

## 项目结构

```
AI-CG-Studio/
├── index.html                     # 首页（10 秒法则：3 主 CTA + Story→Scene→Prompt→Image 链）
├── STARTUP.md                     # 启动说明
├── css/
│   └── design-system.css          # 设计令牌（深灰底 + 樱花粉）
├── tools/                         # 创作工具
│   ├── nav.js                     # 统一导航（Scene-first，Create 为最大入口）
│   ├── theme.js                   # 暗/浅主题管理器
│   ├── scene-card.js              # Scene Card 组件（grid/strip/recent 三模式）
│   ├── active-sync.js             # ★ Active Sync Protocol（动态情感占位符）
│   ├── image-store.js             # IndexedDB 图片存储
│   ├── prompt-builder.html        # Create（Director）— Story-first 导演台
│   ├── scene-explorer.html        # Scene Library — 206 场景浏览
│   ├── character.html             # Character — 角色卡 + DNA
│   ├── style.html                 # Style — 色彩氛围
│   ├── lora.html                  # LoRA — 角色资产（强度/触发词/兼容模型）
│   ├── gallery.html               # Gallery — 创作时间线
│   ├── scenario.html              # 剧本模式（多幕 CG）
│   └── color-script.html          # 色彩剧本
├── data/                          # 核心资产（Scene 为一等公民）
│   ├── scenes.json                # ★ Scene Library（206 条，多维分类，含 Active Sync 场景）
│   ├── characters.json            # 角色库（视觉 DNA + LoRA 绑定）
│   ├── loras.json                 # LoRA 资产（强度/触发词/兼容模型/版本）
│   ├── tags.json                  # ★ 统一标签（126 条，10 类，snake_case）
│   ├── prompts.json               # Prompt 模板（Scene 的派生输出）
│   ├── presets.json               # 出图参数档
│   ├── projects.json              # 项目工作区
│   └── history.json               # 生成历史（seed clamp / rating 5 轴）
└── docs/                          # 规范文档（可交互）
    ├── philosophy.html            # Scene Engineering > Prompt Engineering
    ├── worldview.html             # 项目灵魂
    ├── art-direction.html         # 色彩 / 光影 / 构图
    ├── quality-standard.html      # 5 轴评分
    ├── tag-standard.html          # 标签标准
    ├── scene-spec.html            # Scene 字段规范
    ├── prompt-spec.html           # Prompt 排序规范
    └── roadmap.html               # 路线
```

**数据层级**：`scenes.json` 是第一公民——它引用 character / lora / prompt 模板。Prompt 不是独立实体，是 Scene 的派生输出。

---

## 试用

```bash
git clone https://github.com/starplatium1129-stack/ai-cg-studio.git
cd ai-cg-studio
python -m http.server 8090
# 浏览器访问 http://localhost:8090/index.html
```

纯 HTML + CSS + 原生 JS，零依赖。通过 localhost 访问（数据经 fetch 加载，file:// 会因 CORS 失败）。

详见 [STARTUP.md](STARTUP.md)（含 Node.js / VS Code Live Server 启动方式）。

---

## 文档

所有规范都是可交互的独立 HTML。推荐阅读顺序：

1. [世界观](docs/worldview.html) — 先读这份，项目灵魂
2. [创作哲学](docs/philosophy.html) — 为什么 Scene > Prompt
3. [Prompt Builder](tools/prompt-builder.html) — 导演工作台开始创作

---

## SD WebUI 连接

1. 启动 AUTOMATIC1111、Forge 或 ReForge，并在启动参数中加入 `--api`。
2. 推荐双击 `control.bat`：填写 Stability Matrix 日志中的 WebUI 地址，点击 **Start Gateway**。
3. 自己使用控制面板的“打开本地网站（无需 Token）”，朋友使用带 Token 的分享链接；普通 Live Server 不提供 `/sdapi` 代理。
4. 默认 WebUI 地址为 `http://127.0.0.1:7860`，也可在控制面板修改；网关端口冲突时会自动换到空闲端口。
5. 如果 WebUI 使用了 `--api-auth user:password`，同时设置 `SD_API_AUTH=user:password`。
6. 打开导演工作台后，顶部状态会自动读取模型、Sampler、Scheduler 和放大器；留空模型选择时始终使用 WebUI 当前模型。

生成过程支持真实进度、预计剩余时间、停止生成、20 分钟超时保护、hires.fix、固定 seed，以及参数随历史记录保存。

## 已完成 (v1.5)

- **206 Scene，多维分类** — 校园 / 日常 / 恋爱 / 亲密 / 旅行 / 节日 / After Story / Active Sync 等
- **Active Sync Protocol** — 动态情感占位符，Director 实时解析故事文本并替换
- **角色系统** — Nene（宁宁）+ Natsume（夏目）+ Triad（三人），视觉 DNA + LoRA 绑定
- **统一标签** — `tags.json` 126 条官方标签，10 类
- **导演工作台** — Prompt Builder v4（引导 / 速填双模式 + 手动标签 + 场景导入）
- **历史 + 收藏** — IndexedDB (AICKVStore)，5 轴评级 + 一键导出 Prompt + 参数 PNG 导出
- **LoRA 资产化** — `loras.json` + `lora.html` 浏览
- **Illustrious SDXL 对标** — 标签结构对标底模特性（5tag 训练 vs 3-5tag 场景生成）
- **响应式 3 段** — 手机 / 平板 / 桌面全覆盖

- **SD WebUI 对接** — A1111 / Forge / ReForge 能力自动发现、真实进度、停止、超时、模型与采样配置记忆
- **美术禁用词源头净化** — `scripts/clean-scenes.js`（22 个红线词黑名单）

---

## 产品使命

> 我们希望 AI 创作者打开软件的时候，第一句话不再是：
> *"今天 Prompt 怎么写？"*
> 而是：
> *"今天，我想讲一个什么故事？"*

---

## 为谁设计

- 想用 AI 生成 Galgame CG 的创作者
- 需要场景级测试 / 对比工作流的 LoRA 训练者
- 厌倦了堆标签、出空画面的人
- Illustrious SDXL / Pony / NoobAI / Galgame 爱好者

---

## 技术栈

纯 HTML + CSS + 原生 JS，无框架、无构建、无 node_modules。设计给 fork、阅读和扩展。

底模对标：Illustrious SDXL（waiIllustriousSDXL_v170），标签结构遵循 5tag 训练规范。

---

<p align="center"><em>Prompt 描述的是图片。<br>Scene 描述的是瞬间。<br>而真正值得被记住的，不是 Prompt，而是那个瞬间。</em></p>
