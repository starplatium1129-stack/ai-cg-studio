# AI CG Studio

> 从故事出发，把想画的瞬间整理成可以直接生成的 Galgame 风格 CG。

[English](README.md)

## 项目定位

AI CG Studio 是我为个人创作整理的一套本地工具，平时自己使用，也会临时分享给身边的朋友。它不是公开运营的平台，也不提供账号、社区、商店或云端同步。

目前的场景与角色预设主要围绕 **绫地宁宁** 和 **四季夏目** 展开。项目会把故事、角色、情绪、镜头、构图、光照和出图参数放在同一个 Scene 中，减少从空白 Prompt 开始反复试错的时间。

这是非官方、非商业的个人爱好项目，与原作及相关权利方没有隶属或授权关系。

## 现在能做什么

- 浏览和搜索 210 个场景，并按角色、分类、季节与内容分级筛选（全年龄 / R15 / R18）
- 从场景直接进入导演工作台，调整故事、情绪、镜头、构图、光照与色彩
- 自动组合 Positive / Negative Prompt，并按场景注入对应 LoRA
- 连接 AUTOMATIC1111、Forge 或 ReForge，直接读取模型与采样配置并生成图片
- 查看生成进度、预计剩余时间，停止任务，固定 Seed，使用 hires.fix
- 中文阅读文本与配音稿彼此独立：画面保持中文，角色默认说日文，也可切换中文演绎
- 将作品、参数、评分、收藏和备注保存在当前浏览器中
- 通过带 Token 的临时链接，让朋友使用你电脑上的 SD WebUI 出图

部分场景还支持动态占位符：工作台会根据故事文字调整亲密强度、互动方式和感官反馈。它只是辅助，不会替代场景本身的故事和构图。

## 最常用的启动方式

### 1. 准备 SD WebUI

在 Stability Matrix 的 WebUI 启动参数中保留：

```text
--api --port 7860
```

`--api` 只会开放本地接口，不影响你正常打开和使用 WebUI 自带界面。实际端口不是 7860 时，以 Stability Matrix 日志显示的地址为准。

### 2. 打开控制面板

双击 `control.bat`，确认 WebUI 地址后点击 **启动并生成分享链接**。当前电脑已配置并评测宁宁、夏目的本地 GPT-SoVITS 专用权重；网关会按角色排队切换模型，避免多人使用时串音。日语配音还会按场景自动选择中性、温柔、开心、害羞、认真或低落的游戏原声参考，以保留更贴近角色的停顿和句尾语气；中文继续使用稳定的中性参考。没有语音服务时，导演台的日文或中文系统声音试听仍可使用。

- 自己使用：点击 **打开本地网站（无需 Token）**
- 分享朋友：复制控制面板中的带 Token 链接
- 使用结束：点击 **停止全部服务**。它会停止本地网关、分享隧道与 GPT-SoVITS；SD WebUI 仍由你手动关闭。

首次运行会安装 Node.js 依赖。公网分享依赖本机安装的 `cloudflared`；没有安装时，本地网站和 SD WebUI 连接仍可使用，只是不会生成公网链接。

完整说明与排错方法见 [STARTUP.md](STARTUP.md)。

## 只浏览页面

如果只想查看场景和文档，不需要直接调用 SD WebUI，可以使用普通静态服务器：

```powershell
python -m http.server 8090
```

然后打开 `http://127.0.0.1:8090/`。不要直接双击 `index.html`，否则浏览器会阻止页面读取 JSON 数据。

## 使用方式

```text
想画的瞬间
  ↓
选择 Scene
  ↓
调整故事、角色和画面决策
  ↓
生成 Prompt
  ↓
调用 SD WebUI 出图，并按需生成角色语音
  ↓
评分、收藏、重新生成或做变体
```

Scene 是创作的起点，Prompt 是它面向 Stable Diffusion 的输出。这样做的目的不是隐藏 Prompt，而是让“想画什么”先于“标签怎么写”。

## 数据与分享

- 场景、角色和默认参数来自仓库中的 JSON 文件
- 历史、收藏、项目和图片主要保存在浏览器的 IndexedDB 中
- 项目本身没有账号系统或云端数据库，也不会自动把个人历史同步到第三方账户
- 网关配置、PID、Token、日志和朋友生成图集中保存在忽略提交的 `runtime/` 目录
- 开启朋友分享时会建立临时公网通道；链接持有者可以调用你本机的 SD WebUI，请只发给信任的人
- 每次重新启动网关都会生成新的 Token，临时域名也可能变化
- “停止生成”调用 WebUI 的全局中断；多人同时使用时，可能会停止当前正在运行的任务

## 项目结构

```text
AI-CG-Studio/
├── index.html              # 首页
├── control.bat             # Windows 控制面板入口
├── server.js               # 静态站点、SD API 代理与临时分享
├── tools/                  # 导演台、场景库、角色、画廊、LoRA 等页面
├── data/                   # 场景、角色、标签、参数与示例数据
├── css/                    # 共用设计系统
├── docs/                   # 创作方法、数据规范和维护路线
├── scripts/                # 场景校验与维护脚本
└── runtime/                # 本机配置、日志、进程状态与朋友生成图（自动创建）
```

核心数据：

- `data/scenes.json`：210 个场景
- `data/characters.json`：绫地宁宁、四季夏目及其角色设定
- `data/tags.json`：126 个规范化标签
- `data/loras.json`：角色 LoRA 配置

## 文档入口

- [知识库](docs/index.html)：全部文档入口
- [创作取向](docs/philosophy.html)：为什么从 Scene 开始
- [项目定位](docs/worldview.html)：这个工具想保留什么、舍弃什么
- [Scene 规范](docs/scene-spec.html)：场景数据与推荐参数
- [Prompt 规范](docs/prompt-spec.html)：Prompt 组装顺序
- [质量检查](docs/quality-standard.html)：出图后的五项自检
- [使用与完善路线](docs/roadmap.html)：已完成、当前优先和可选方向
- [个人设计手册](Product%20Design%20Document%EF%BC%88%E4%BA%A7%E5%93%81%E8%AE%BE%E8%AE%A1%E6%89%8B%E5%86%8C%EF%BC%89.md)：维护时使用的设计依据

## 维护与校验

安装依赖后可运行：

```powershell
npm run validate
```

校验脚本会检查场景 ID、角色、分类、内容分级、标签、Prompt、未解析占位符、镜头标签和负面词是否一致。需要批量规范新增场景时运行 `npm run optimize-scenes`；新增或调整成人向场景后运行 `npm run classify-ratings`。只有 `R18` 会受“显示成人内容”开关控制。

## 技术说明

- 前端：HTML、CSS、原生 JavaScript
- 本地网关：Node.js、Express、HTTP 代理
- 数据：JSON、IndexedDB、localStorage
- SD 后端：AUTOMATIC1111、Forge、ReForge 的 WebUI API
- 临时分享：Cloudflare Quick Tunnel + Token

## 维护原则

1. 自己和朋友实际会用的功能优先。
2. 本地数据和简单启动优先。
3. 场景质量优先于场景数量。
4. 分享功能默认保持临时、可停止、需要 Token。
5. 不为了版本号扩张成公开平台。

> Prompt 描述图片，Scene 描述瞬间。这个工具要做的，是让那个瞬间更容易被画出来。
