# AI CG Studio

> **从故事,到画面**
>
> 不是写 Prompt,而是导演一张 CG。
>
> *每一张优秀的 CG,都始于一个故事。*

English: [README.md](README.md)

---

## 这是什么?

AI CG Studio 是 **AI Galgame CG 创作工作台** — 面向 AI 创作者的 **Scene 库**,不是 Prompt 库。

| ❌ 别人给 | ✅ 我们给 |
|---|---|
| 5000 条 Prompt | 500 个 Scene |

一条 Scene 抵过一千条 Prompt。每条 Scene 包含故事、情绪、镜头、构图、光照、推荐参数、Prompt、Negative、LoRA 推荐、推荐用途 — 完整的创作单元。

**我们不管理 Prompt。我们管理 Scene。**

---

## 创作摩擦

打开 WebUI,面对空白 Prompt。十五分钟过去了,还没开始生成。

这不是"不会写 Prompt",这是 **Creative Friction** —— 脑海里有画面,却不知道如何把它翻译成 Prompt。

AI CG Studio 的工作,是把这个摩擦降到最低。

---

## 四层模型

```
第一层  Story      (灵感 → 一句话故事)
第二层  Scene      (故事 → 情绪 / 镜头 / 构图 / 光照 / ...)
第三层  Prompt     (Scene → 自动翻译为 SD 能懂的 token)
第四层  Image      (Prompt → 最终画面)
```

**Prompt 只是 Scene 的一种输出,不是产品核心。**

---

## Workflow

```
灵感
 ↓
Story
 ↓
Scene (角色 · 情绪 · 镜头 · 构图 · 光照 · 色彩)
 ↓
Prompt (自动生成)
 ↓
生成 CG
 ↓
Review → Favorite → Library
```

---

## 试用

直接在浏览器打开 `index.html`,无需服务器、无需安装、无需构建。

---

## 项目结构

```
AI-CG-Studio/
├── index.html                          # 主页 — Scene Explorer、创作入口
├── css/
│   └── design-system.css               # 全局设计令牌(深灰底 + 樱花粉点缀)
├── data/
│   └── scene-library.json              # 官方 Scene 库 (40 → 500 目标)
├── docs/                               # 规范文档(自包含、可交互)
│   ├── worldview.html                  # 为什么做这件事(项目灵魂)
│   ├── philosophy.html                 # Scene Engineering > Prompt Engineering
│   ├── art-direction.html              # 色彩 / 光影 / 人物 / 背景
│   ├── prompt-spec.html                # 9 模块 Prompt 排序
│   ├── tag-standard.html               # 标准标签(唯一化,snake_case)
│   ├── scene-spec.html                 # SC0001 模板 + 官方示例
│   ├── quality-standard.html           # ⭐⭐⭐⭐⭐ 评分维度
│   ├── scenario-spec.html              # 剧本规范 · 多幕 CG 脚本标准
│   └── roadmap.html                    # v0.5 → v7.0
└── tools/                              # 可交互创作工具
    ├── scene-explorer.html             # 🌸 Scene Explorer — 70 场景视觉浏览
    ├── prompt-builder.html             # 导演工作台 · Story-first · 实时预览 / 历史 / 导出
    ├── scenario.html                   # 剧本模式 · 多幕 CG · Scene-spec 展示
    └── color-script.html               # 情绪 → 色板 → 光照 · 美术规范对照
```

---

## 三原则(永远不违反)

1. **Story First** — 先有画面,后有 Prompt。Prompt 永远是最后一步。
2. **Character First** — 人物永远是画面中心。所有元素都服务于角色。
3. **Emotion First** — 用户记住的不是 Prompt,而是"那个放学后的黄昏"。

---

## 产品使命

> 我们希望 AI 创作者打开软件的时候,第一句话不再是:
> *"今天 Prompt 怎么写?"*
> 而是:
> *"今天,我想讲一个什么故事?"*

---

## 我们不追求 Prompt 数量

我们追求: **Scene 质量**。

别人: 5000 Prompt。
我们: 500 Scene。

每一条都有故事、情绪、镜头、构图、推荐参数、Prompt、Negative、LoRA、推荐用途。
真正做到: **拿来即可创作**。

---

## 为谁设计

- 想用 AI 生成 Galgame CG 的创作者
- 需要场景级测试 / 对比工作流的 LoRA 训练者
- 厌倦了堆标签、出空画面的人
- Illustrious / SDXL / Pony / NoobAI / Galgame 爱好者

---

## 快速开始(本地)

```bash
git clone https://github.com/starplatium1129-stack/ai-cg-studio.git
cd ai-cg-studio
# 双击 index.html, 或:
python -m http.server 8090
# 然后访问 http://localhost:8090
```

无需其他。纯 HTML + CSS + 原生 JS,零依赖(除 Google Fonts)。

---

## 文档

所有规范都是可交互的独立 HTML。推荐阅读顺序:

1. [世界观](docs/worldview.html) — 先读这份,项目灵魂
2. [创作哲学](docs/philosophy.html) — 为什么 Scene > Prompt
3. [Prompt Builder](tools/prompt-builder.html) — 导演工作台开始创作

---

## 路线(概要)

| 版本 | 重点 |
|---|---|
| v0.5 | 文档 + 工具 + 设计系统 + Scene 库 *(当前)* |
| v1.0 | 导演工作台完整版 · 500 Scene |
| v2.0 | 社区提交 + Scene 图谱 |
| v3.0 | AI 辅助导演 — 一句话补全全套场景决策 |
| v4.0 | 图片管理与 Gallery |
| v5.0 | LoRA 库管理 |
| v6.0 | ComfyUI workflow 导出 |
| v7.0 | 云同步 + 社区 |

详见 [路线](docs/roadmap.html)。

---

## 技术栈

纯 HTML + CSS + 原生 JS,无框架、无构建、无 node_modules。设计给 fork、阅读和扩展。

---

## 许可证

待定(开源)

---

## 作者

[starplatium1129-stack](https://github.com/starplatium1129-stack)

---

<p align="center"><em>Prompt 描述的是图片。<br>Scene 描述的是瞬间。<br>而真正值得被记住的,不是 Prompt,而是那个瞬间。</em></p>
