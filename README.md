# AI CG Studio

> **像导演一样创作 Galgame CG**
>
> 不是写 Prompt。选一个 Scene,讲一个瞬间,让 AI 完成画面。

中文: [README_zh.md](README_zh.md)

---

## 一句话

打开 WebUI,面对空白 Prompt,十五分钟还没开始生成。
这不是"不会写 Prompt"——是脑海里有画面,却不知道如何把它翻译成 token。

**AI CG Studio 把这个摩擦降到最低。**

你不管理 Prompt。你管理 **Scene**。Prompt 只是 Scene 的一种输出。

---

## 怎么创作

```
今天画什么?
  ↓
选一个 Scene(70 个官方种子,每个都是一张 CG 的起点)
  ↓
像导演一样:定情绪、镜头、光照、色彩
  ↓
Prompt 自动生成 → 出图 → Review 收藏
```

Prompt 永远最后出现。用户看不到 Prompt / Preset / Workflow 这些词 —— 它们是 Scene 背后的事。

---

## 产品第一层是 Scene

```
AI CG Studio
│
├── Create          ← 最大入口(即 Director,Story → 情绪/镜头/光照 → Prompt 自动)
├── Scene Library   ← 起点,70 个场景种子
├── Gallery         ← 创作时间线(收藏 / 评分 / 重新生成)
├── Character       ← 角色卡 + 视觉 DNA + 绑定 LoRA
├── Style           ← 色彩 = 情绪 = 光照
├── LoRA            ← 角色资产(强度/触发词/兼容模型)
└── Learn(Docs)     ├── 理念 / 规范 / 路线(折叠,不打扰创作)
```

Create = 全站最大入口。Director 是内部实现名,对用户隐身。Prompt 不是第一层。Scene 才是。

---

## 三原则(永远不违反)

1. **Scene First** — 先有 Scene,后有 Prompt。Prompt 永远是最后一步。
2. **Character First** — 人物永远是画面中心。
3. **Emotion First** — 用户记住的不是 Prompt,而是"那个放学后的黄昏"。

---

## 为谁设计

- 想用 AI 生成 Galgame CG 的创作者
- 需要场景级测试 / 对比工作流的 LoRA 训练者
- 厌倦了堆标签、出空画面的人
- Illustrious / SDXL / Pony / NoobAI 爱好者

---

## 快速开始

```bash
git clone https://github.com/starplatium1129-stack/ai-cg-studio.git
cd ai-cg-studio/AI-CG-Studio
python -m http.server 8090
# 浏览器访问 http://localhost:8090/index.html
```

纯 HTML + CSS + 原生 JS,零依赖。通过 localhost 访问(数据经 fetch 加载,file:// 会因 CORS 失败)。

---

## 项目结构

```
AI-CG-Studio/
├── index.html                     # 首页(10 秒法则:3 主 CTA + Story→Scene→Prompt→Image 链)
├── css/
│   └── design-system.css          # 设计令牌(深灰底 + 樱花粉)
├── tools/                         # 创作工具
│   ├── nav.js                     # 统一导航(Scene-first,Create 为最大入口)
│   ├── theme.js                   # 暗/浅主题管理器
│   ├── scene-card.js              # ★ Scene Card 统一组件(grid/strip/recent 三模式)
│   ├── scene-explorer.html        # Scene Library — 70 场景浏览
│   ├── prompt-builder.html        # Create(Director) — Story-first 导演台
│   ├── character.html             # Character — 角色卡 + DNA
│   ├── style.html                 # Style — 色彩氛围
│   ├── lora.html                  # LoRA — 角色资产(强度/触发词/兼容模型)
│   ├── gallery.html               # Gallery — 创作时间线(读 localStorage History)
│   ├── scenario.html              # 剧本模式(多幕 CG)
│   └── color-script.html          # 色彩剧本
├── data/                          # 核心资产(Scene 为一等公民)
│   ├── scenes.json                # ★ Scene Library(70 条,19 字段,含 character/lora 外键)
│   ├── characters.json            # 角色库(视觉 DNA + LoRA 绑定)
│   ├── loras.json                 # ★ LoRA 资产(强度/触发词/兼容模型/版本)
│   ├── prompts.json               # Prompt 模板(Scene 的派生输出)
│   ├── presets.json               # 出图参数档(SD 端配置)
│   ├── tags.json                  # 统一标签(PDD §15 十类)
│   └── history.json               # ★ 生成历史 schema v2(seed clamp/rating 5 轴)
└── docs/                          # 规范文档(可交互)
    ├── philosophy.html            # Scene Engineering > Prompt Engineering
    ├── worldview.html             # 项目灵魂
    ├── art-direction.html         # 色彩 / 光影 / 构图
    ├── quality-standard.html      # 5 轴评分
    ├── tag-standard.html          # 标签标准
    ├── scene-spec.html            # Scene 17 字段规范
    └── roadmap.html               # 路线
```

**数据层级**:`scenes.json` 是第一公民 — 它引用 character / lora / prompt 模板。Prompt 不是独立实体,是 Scene 的派生输出。

---

## 文档

所有规范都是可交互的独立 HTML。推荐阅读顺序:

1. [哲学](docs/philosophy.html) — 为什么 Scene > Prompt
2. [世界观](docs/worldview.html) — 项目灵魂
3. [路线](docs/roadmap.html) — 我们在哪,去哪

---

## 本版本已有(相对早期 PDD)

产品理念 5 ★ / 信息架构 4 ★ / 新用户引导 4 ★ — 核心已落地:

- **首页 10 秒法则** — 标题 + Create 最大 CTA + Library + Gallery + Story→Scene→Prompt→Image 链(信息层级收敛,文档卡踢到底部)
- **导航"创作者思维"** — 一级 `Create / Scene Library / Gallery / Character / Style / LoRA / Learn`,Director 为内部名对用户隐身
- **Scene Card 统一组件** — `tools/scene-card.js`,首页胶片 / 作品展示 / 场景库 / 画廊四处复用同一卡片,减少重复代码
- **Scene 一等公民** — `scenes.json` 每条含 `character:['nene']` + `lora:'ayachi_nene_v11'` 外键(70/70 条)
- **LoRA 资产化** — `loras.json` 含 `trigger` / `character` / `strength{default,min,max}` / `compatible_models[]` / `version`,由 `tools/lora.html` 以资产卡展示
- **History schema v2** — seed clamp [0, 2^32-1] / rating 5 轴 clamp 0..5 / 旧数据自动迁移(loadHistory 时静默修复)
- **Gallery 真实内容** — 读 localStorage History,时间线分组 + 5 轴评级 + 重新生成 / 变体
- **响应式 3 段** — 手机(<480px) / 平板(768px) / 桌面(1200px),8 页全覆盖

Phase F(Workspace / AI Director / 三级模式 / Critic / API 直连 / 版本控制)显式延后。
