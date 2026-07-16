# AI CG Studio 启动指南

> 像导演一样创作每一个瞬间

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
│   ├── scene-explorer.html # 场景库
│   ├── character.html      # 角色卡
│   ├── gallery.html        # 作品画廊
│   ├── lora.html           # LoRA 管理
│   └── ...
├── data/                   # 数据文件
│   ├── scenes.json         # 128 个场景
│   ├── characters.json     # 角色信息
│   └── tags.json           # 标签库
├── docs/                   # 文档
└── css/                    # 样式
```

---

## 核心功能

### 1. 导演工作台 (`/tools/prompt-builder.html`)

- 选择场景（128 个预设场景）
- 选择角色（宁宁 / 夏目）
- 定义导演决策（情绪、镜头、光照、构图、色彩）
- 自动生成 Stable Diffusion Prompt

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

---

## 技术栈

- **前端**: 纯 HTML + CSS + Vanilla JS（零依赖）
- **数据**: JSON 文件（本地加载）
- **存储**: localStorage（历史记录、项目）
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
