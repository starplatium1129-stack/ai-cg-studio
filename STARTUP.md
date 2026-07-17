# AI CG Studio 启动指南

> 像导演一样创作每一个瞬间

---

## 一键启动（联机网关）

双击 `start.bat` 即可，自动：
1. 检查 SD WebUI 是否在线
2. 启动 Node.js 网关（端口 3000）
3. 启动 Cloudflare Tunnel 穿透
4. 输出 token 和 tunnel 域名

> 关闭时双击 `stop.bat`，或分别在两个窗口按 `Ctrl+C`。

---

## 快速启动

### 方法一：Python（推荐）

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

### 4. SD WebUI ReForge 对接 (`/tools/sd-api.js`)

导演工作台可直接调用本地 SD WebUI 出图，无需手动复制 Prompt：

- **前置条件**：启动 ReForge 时需添加 `--api` 参数
- **默认地址**：`http://127.0.0.1:7860`（可通过 `SDWebUIConnector` 修改）
- **默认参数**：Checkpoint `waiIllustriousSDXL_v170.safetensors`，Sampler `DPM++ 2M SDE Karras`，CFG 5.5，Steps 28
- **LoRA 注入**：自动从场景数据读取 LoRA 名称，注入 `<lora:name:0.85>`（已去重防叠 buff）
- **状态 Badge**：工作台右上角绿/红圆点实时显示连接状态

### 5. 联机网关（让朋友远程出图）

朋友不需要装 SD，浏览器打开链接即可选场景出图。

**启动步骤（3步）：**

```bash
# 1. 启动 SD WebUI（确保加了 --api 参数）
#    在你的 ReForge/WebUI 目录运行 webui-user.bat

# 2. 启动网关
cd E:\code\2\lora\AI-CG-Studio
node server.js
# 终端会打印 Token，记下来

# 3. 启动穿透（另一个终端窗口）
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
# 终端会打印域名（xxx.trycloudflare.com），记下来
```

**给朋友的链接：**
```
https://打印的域名/?token=打印的Token
```

**注意事项：**
- 每次重启 `node server.js`：Token 会重新生成，需要重新发链接
- 每次重启 `cloudflared`：域名会变化，需要重新发链接
- 固定 Token：`set TOKEN=我的密码 && node server.js`
- 朋友出的图自动备份到 `friend_outputs/` 目录
- 第一次出图会慢几秒（SD 加载模型），前端会自动重试
- 多人同时出图时 SD 会排队，前端显示等待计时

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

A: 确认 ReForge 已启动且加了 `--api` 参数。默认端口 7860。

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
