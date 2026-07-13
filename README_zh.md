# AI CG Studio

> **从故事，到画面**
>
> 不是写 Prompt，而是导演一张 CG。

English: [README.md](README.md)

---

## 这是什么？

AI CG Studio 是 **AI Galgame CG 创作工作台** — 面向 AI 创作者的 **Scene 库**，不是 Prompt 库。

| ❌ 别人给 | ✅ 我们给 |
|---|---|
| 5000 条 Prompt | 500 个 Scene |

一条 Scene 抵过一千条 Prompt。每条 Scene 包含故事、情绪、镜头、构图、光照、推荐参数、自动生成的 Prompt — 完整的创作单元。

---

## 试用

直接在浏览器打开 `index.html`，无需服务器、无需安装、无需构建。

---

## 项目结构

```
AI-CG-Studio/
├── index.html                          # 主页 — 导航、理念、路线
├── css/
│   └── design-system.css               # 全局设计令牌（深灰底 + 樱花粉点缀）
├── docs/                               # 规范文档（自包含、可交互）
│   ├── worldview.html                  # 为什么做这件事（项目灵魂）
│   ├── philosophy.html                 # Scene Engineering > Prompt Engineering
│   ├── art-direction.html              # 色彩 / 光影 / 人物 / 背景
│   ├── prompt-spec.html                # 9 模块 Prompt 排序（用户看不见这页）
│   ├── tag-standard.html               # 40+ 标准标签（唯一化，中英对照）
│   ├── scene-spec.html                 # SC0001 模板 + 官方示例
│   ├── quality-standard.html           # ⭐⭐⭐⭐⭐ 评分维度
│   └── roadmap.html                    # v0.5 → v7.0
└── tools/                              # 可交互创作工具
    ├── director-flow.html              # 7 步 Story→人物→情绪→…→CG
    ├── color-script.html               # 情绪 → 色板 → 光照 → Prompt
    └── scenario.html                   # 多幕 CG 脚本（Galgame 剧本式）
```

---

## 三原则（永远不违反）

1. **Scene First** — 先有 Scene，后有 Prompt。Prompt 永远是最后一步。
2. **Character First** — 人物永远是画面中心。任何元素都服务于角色。
3. **Emotion First** — 用户记住的不是 Prompt，而是画面带来的回忆。

---

## 核心理念

> **Prompt 描述图片。Scene 描述瞬间。**
>
> 一张优秀的 CG，不是因为 Prompt 很长而优秀，而是因为它捕捉到了一个值得记住的瞬间。

进化链: **Prompt Engineering → Scene Engineering → Visual Story Engineering**

---

## 快速开始（本地）

```bash
git clone https://github.com/starplatium1129-stack/ai-cg-studio.git
cd ai-cg-studio
# 双击 index.html, 或:
python -m http.server 8090
# 然后访问 http://localhost:8090
```

无需其他。纯 HTML + CSS + 原生 JS，零依赖（除 Google Fonts）。

---

## 文档

所有规范都是可交互的独立 HTML。推荐阅读顺序:

1. [世界观](docs/worldview.html) — 先读这份，项目灵魂
2. [创作哲学](docs/philosophy.html) — 为什么 Scene > Prompt
3. [导演模式工具](tools/director-flow.html) — 开始创作

---

## 路线（概要）

| 版本 | 重点 |
|---|---|
| v0.5 | 文档 + 工具 + 设计系统 *(当前)* |
| v1.0 | Prompt Builder 3.0 — 整合工具 |
| v2.0 | Scene 库 500+，社区提交 |
| v3.0 | AI 辅助导演 — 一句话补全全套场景决策 |
| v4.0 | 图片管理与 Gallery |
| v5.0 | LoRA 库管理 |
| v6.0 | ComfyUI workflow 导出 |
| v7.0 | 云同步 + 社区 |

详见 [路线](docs/roadmap.html)。

---

## 为谁设计

- 想用 AI 生成 Galgame CG 的创作者
- 需要场景级测试/对比工作流的 LoRA 训练者
- 厌倦了堆标签、出空画面的人

---

## 技术栈

纯 HTML + CSS + 原生 JS，无框架、无构建、无 node_modules。设计给 fork、阅读和扩展。

---

## 许可证

待定（开源）

---

## 作者

[starplatium1129-stack](https://github.com/starplatium1129-stack)
