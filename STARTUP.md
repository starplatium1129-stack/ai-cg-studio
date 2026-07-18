# AI CG Studio 启动指南

> 像导演一样创作每一个瞬间

---

## 一键启动（联机网关）

双击 `control.bat` 打开控制面板：

1. 在 Stability Matrix 中给 WebUI 保留启动参数 `--api`，建议同时固定 `--port 7860`。
2. 控制面板填写 Stability Matrix 日志显示的 WebUI 地址，例如 `http://127.0.0.1:7860`。
3. 点击 **Start Gateway**；若 3000 已占用，会自动选择其他空闲端口。
4. 自己点击 **打开本地网站（无需 Token）**，朋友使用控制面板生成的带 Token 分享链接。

> 关闭时在控制面板点击 **Stop Gateway**。`--api` 可一直保留，不影响你打开 WebUI 自带界面。

---

## 快速启动

以下方法只适合浏览静态页面，不提供 `/sdapi` 代理，因此不能直接调用 SD WebUI。

### 方法一：Python

```bash
# 进入项目目录
cd E:/code/2/lora/AI-CG-Studio

# 启动本地服务器
python -m http.server 8080

# 打开浏览器访问
# http://localhost:8080
```

### 方法二：Node.js

```bash
# 进入项目目录
cd E:/code/2/lora/AI-CG-Studio

# 使用 npx 启动（无需安装）
npx serve -p 8080

# 或使用 http-server
npx http-server -p 8080

# 打开浏览器访问
# http://localhost:8080
```

### 方法三：VS Code Live Server

1. 安装 VS Code 扩展 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
2. 右键点击 `index.html` → **Open with Live Server**
3. 自动打开浏览器

---

## 为什么需要本地服务器？

本项目使用 `fetch()` 加载 JSON 数据文件。浏览器安全策略（CORS）禁止从 `file://` 协议直接加载本地文件，必须通过 `http://` 或 `https://` 访问。

**错误示例**：
```
❌ file:///E:/code/2/lora/AI-CG-Studio/index.html
```

**正确示例**：
```
✅ http://localhost:8080
✅ http://127.0.0.1:8080
```

---

## 项目结构

```
AI-CG-Studio/
├── index.html              # 首页
├── tools/                  # 工具页面
│   ├── prompt-builder.html # 导演工作台（核心）
│   ├── sd-api.js           # SD WebUI ReForge API 对接
│   ├── active-sync.js      # Active Sync Protocol 引擎
│   ├── image-store.js      # IndexedDB 图片/KV 存储 (AICKVStore)
│   ├── scene-explorer.html # 场景库
│   ├── character.html      # 角色卡
│   ├── gallery.html        # 作品画廊
│   ├── lora.html           # LoRA 管理
│   └── ...
├── data/                   # 数据文件
│   ├── scenes.json         # 200 个场景
│   ├── characters.json     # 角色信息
│   └── tags.json           # 标签库
├── scripts/                # 维护脚本
│   └── clean-scenes.js     # 场景数据批量清洗
├── docs/                   # 文档
└── css/                    # 样式
```

---

## 核心功能

### 1. 导演工作台 (`/tools/prompt-builder.html`)

- 选择场景（200 个预设场景）
- 选择角色（宁宁 / 夏目 / 三人场景 triad）
- 定义导演决策（情绪、镜头、光照、构图、色彩）
- 自动生成 Stable Diffusion Prompt
- hires.fix 开关（2x R-ESRGAN Anime6B, 14 steps, denoising 0.35）
- Seed 锁定 + SD 连接状态 Badge + 下载 PNG

### 2. Active Sync Protocol

部分场景支持动态参数替换：
- `{intimacy_intensity}` - 亲密强度
- `{interaction_target}` - 交互目标
- `{sensory_feedback}` - 感官反馈

在故事框输入关键词即可触发：
- "gentle touch with warm feeling" → 低强度 + 物理接触 + 热感

### 3. 场景库 (`/tools/scene-explorer.html`)

- 按分类浏览（校园、日常、恋爱、亲密等）
- 搜索和筛选
- 一键跳转到导演台

### 4. SD WebUI 对接 (`/tools/sd-api.js`)

导演工作台可直接调用本地 SD WebUI 出图，无需手动复制 Prompt：

- **兼容后端**：AUTOMATIC1111、Forge、ReForge；启动时需添加 `--api` 参数
- **默认地址**：`http://127.0.0.1:7860`；可直接在 `control.bat` 打开的控制面板修改，也可设置环境变量 `SD_HOST`
- **模型策略**：默认使用 WebUI 当前模型，不再硬编码 checkpoint；也可在导演台按单次生成选择模型
- **采样参数**：从 WebUI 动态读取模型、Sampler、Scheduler 和放大器，并记住上次选择
- **LoRA 注入**：自动从场景数据读取 LoRA 名称，注入 `<lora:name:0.85>`（已去重防叠 buff）
- **生成状态**：显示真实进度与预计剩余时间，支持停止生成、超时保护和后端错误详情
- **API 认证**：WebUI 使用 `--api-auth` 时，启动网关前设置 `$env:SD_API_AUTH='user:password'`

### 5. 联机网关（让朋友远程出图）

朋友不需要装 SD，浏览器打开链接即可选场景出图。

**启动步骤（2步）：**

```powershell
# 1. 启动 SD WebUI（确保加了 --api 参数）
#    在你的 A1111 / Forge / ReForge 目录运行 webui-user.bat

# 2. 启动网关
Set-Location E:\code\2\lora\AI-CG-Studio
node server.js
# 网关会自动启动 cloudflared，并打印 Token 与域名
```

**给朋友的链接：**
```
https://打印的域名/?token=打印的Token
```

**注意事项：**
- 每次重启 `node server.js`：Token 会重新生成，需要重新发链接
- 每次重启 `cloudflared`：域名会变化，需要重新发链接
- 固定 Token：先执行 `$env:TOKEN='我的密码'`，再运行 `node server.js`
- 朋友出的图自动备份到 `friend_outputs/` 目录
- 第一次出图可能较慢（SD 需要加载模型），前端会显示真实进度；失败后可按原参数手动重试
- 多人同时出图时 SD 会排队；`停止生成` 调用的是 WebUI 全局 interrupt，会中断当前正在执行的任务，请避免朋友之间互相取消

**关闭服务：**
- 方法一：两个终端窗口分别按 `Ctrl+C`
- 方法二：开新终端跑 `taskkill /F /IM node.exe && taskkill /F /IM cloudflared.exe`

### 5. 数据维护脚本

运行 `node scripts/clean-scenes.js` 可对 `data/scenes.json` 执行批量清洗：

- 标签去重 + 逗号拆分 + 角色 DNA 注入
- 美术禁用词黑名单源头净化（neon / glowing / 8k / photorealistic 等 13 个红线词）
- Active Sync 占位符自动补全
- 运行前自动创建 `.bak` 备份

---

## 常见问题

### Q: 页面空白 / 数据加载失败？

A: 确保使用本地服务器访问，不要直接打开 HTML 文件。

### Q: 标签显示乱码？

A: 检查浏览器编码设置，确保使用 UTF-8。

### Q: 如何添加新场景？

A: 编辑 `data/scenes.json`，按照现有格式添加场景对象。

### Q: 如何自定义角色？

A: 编辑 `data/characters.json`，添加角色信息和 LoRA 绑定。

### Q: SD WebUI 状态 Badge 显示红色？

A: 红色表示网关无法连接 WebUI：确认 A1111 / Forge / ReForge 已启动并带 `--api`，以及 `SD_HOST`、`SD_API_AUTH` 是否正确。橙色表示当前是普通静态服务器，请改从控制面板或 `node server.js` 启动的网站进入。

---

## 技术栈

- **前端**: 纯 HTML + CSS + Vanilla JS（零依赖）
- **数据**: JSON 文件（本地加载）
- **存储**: IndexedDB (AICKVStore，历史记录 / 项目 / 图片 Blob)
- **兼容**: 现代浏览器（Chrome/Firefox/Edge/Safari）

---

## 开发说明

### 添加新页面

1. 在 `tools/` 目录创建 HTML 文件
2. 引入共享资源：
   ```html
   <link rel="stylesheet" href="../css/design-system.css?v=4">
   <script src="nav.js?v=4"></script>
   <script src="theme.js?v=4"></script>
   ```
3. 在 `tools/nav.js` 中添加导航项

### 修改标签库

编辑 `data/tags.json`，格式：
```json
{
  "en": "tag_name",
  "cn": "中文名称",
  "cat": "Category"
}
```

### 修改场景

编辑 `data/scenes.json`，必填字段：
- `id`: 唯一标识（如 "sc129"）
- `title`: 场景标题
- `category`: 分类
- `story`: 故事描述
- `char`: 角色（nene/natsume/triad）
- `tags`: 标签数组（3-5 个）
- `prompt`: SD 提示词模板

---

## 许可证

本项目仅供学习和个人使用。

---

> AI CG Studio · 像导演一样创作每一个瞬间
