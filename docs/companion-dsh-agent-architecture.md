# AI-CG-Studio 桌宠（Companion）DSH 架构对齐与配置指南

> **基线日期**：2026-08-20
> **核心目标**：参考 DeepSeek Harness（DSH）的本地自主 Agent 工具体系，将桌宠从“纯文本/语音聊天”升级为具备**多模态视觉感知、系统级工具调用、绘图引擎直连与角色灵魂互动**的全功能智能伴侣。

---

## 🏛️ 一、架构对齐全景（DSH vs AI-CG-Studio 桌宠）

```
                     ┌────────────────────────────────────────────────────────┐
                     │                 AI-CG-Studio 桌宠伴侣                  │
                     │          （结合二次元灵魂人格与 DSH 工具执行力）          │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────────────┐
            ▼                                    ▼                                    ▼
   【1. 多模态视觉感知】                 【2. 权威本地工具箱】                【3. 灵魂与演出引擎】
   • capture_screen                      • companionTools 协议                • Live2D 动作调度与原作者门控
   • 剪贴板图片感知                       • generate_character_image           • 好感度体系（0~100，Lv1~Lv5）
   • 1080p 紧凑 JPEG DataURL             • read_image / read_file             • [mood=xxx] 情绪协议驱动
   • 原生直传视觉模型                     • write_file / run_command           • TTS 语音流式合成与唇形同步
```

### 1. 工具调用体系（Tools Mapping）

| DSH 原生工具 | 桌宠对齐工具 | 对应端点/实现 | 说明 |
| :--- | :--- | :--- | :--- |
| `read_image` | `capture_screen` / `read_image` | `/api/desktop-tools` (`name: capture_screen`) | 毫秒级抓取 Windows 桌面画面或读取工作区图片，转为 Base64 DataURL |
| `pwsh` | `run_command` | `/api/desktop-tools` (`name: run_command`) | 工作区受限命令执行 |
| `read` / `write` | `read_file` / `write_file` | `/api/desktop-tools` | 安全读写 AI 工作区内的文本、脚本、配置 |
| 维护出图脚本 | `generate_character_image` | `/api/desktop-tools` (`name: generate_character_image`) | 自动绑定 Anima 角色 LoRA（0.85 权重）与形态 prompt 一键生成 |

---

## ⚙️ 二、推荐配置说明（与 DSH 保持一致）

### 1. 聊天与视觉大模型配置
在桌宠的 **设置（Chat Settings）** 面板中推荐配置：
* **供应商模式**：`API 模式`
* **API 地址（Base URL）**：
  - 本地代理端点：`http://127.0.0.1:8317/v1`（CLIProxyAPI / CPA-Manager）
  - 或官方 Gemini / OpenAI 兼容端点：`https://generativelanguage.googleapis.com/v1beta/openai/`
* **模型名（Model Name）**：
  - 推荐 **`gemini-2.5-flash`** 或 **`gemini-3.7-flash-high`**（具备超大上下文、毫秒级响应、原生视觉识别与高可靠 Function Calling）
  - 也可使用 **`deepseek-v4-flash`**（文字与工具调用）
* **API Key**：填写您对应的 API 密钥。

---

## 🎯 三、核心场景操作指南

### 1. 屏幕感知与锐评（Vision Inspection）
* **操作**：在桌宠输入框右侧点击 **`👁️ 看屏幕`**。
* **流程**：
  1. 后端调用 Windows 原生 GDI 截取主屏幕并压缩为轻量 JPEG；
  2. 自动组装多模态图文消息发送给视觉模型；
  3. 夏目/宁宁根据角色性格（毒舌傲娇 / 温柔学姐）以第一人称对您的屏幕画面进行点评。

### 2. 自然语言一键生图（Tool Dispatch）
* **操作**：直接对桌宠发送指令：
  - *“夏目，帮我画一张你在海边喝汽水的插画”*
  - *“画一张夏目的泳装插画”*
* **流程**：
  1. 模型识别出图意图，发起 `generate_character_image` 工具调用；
  2. 网关自动绑定 `shiki_natsume_v21_anima` / `ayachi_nene_v21_anima` LoRA（0.85 强度）；
  3. 插画与元数据自动落盘至 `AI_WORKSPACE_ROOT/generated-images/`；
  4. 角色好感度自动增加 **+2 💖** 并给出完成反馈。

### 3. 好感度与亲密度成长（Affection Loop）
* 摸头 / 摸手互动每次累加 **+5 💖**；
* 满分（100 分）解锁原作者专属告白动作（萌萌Q、喝茶邀请、我爱你）；
* 好感度徽章在顶部药丸实时显示当前等级与点数。

