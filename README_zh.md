# 绫季绘境

> 从故事出发，把想画的瞬间整理成可以直接生成的 Galgame 风格 CG。

[English](README.md)

## 项目定位

绫季绘境 是我为个人创作整理的一套本地工具，平时自己使用，也会临时分享给身边的朋友。它不是公开运营的平台，也不提供账号、社区、商店或云端同步。

目前的场景与角色预设主要围绕 **绫地宁宁** 和 **四季夏目** 展开。项目会把故事、角色、情绪、镜头、构图、光照和出图参数放在同一个 Scene 中，减少从空白 Prompt 开始反复试错的时间。

这是非官方、非商业的个人爱好项目，与原作及相关权利方没有隶属或授权关系。

## 现在能做什么

- 浏览和搜索 297 个场景，并按角色、分类、季节与内容分级筛选（全年龄 / R15 / R18）
- 在"效果样张"中查看逐场景审核的实际成图，按精选、角色和分级筛选，并直接带着场景进入导演台
- 从场景直接进入导演工作台，调整故事、情绪、镜头、构图、光照与色彩
- 自动组合 Positive / Negative Prompt，并按场景注入对应 LoRA
- 连接 AUTOMATIC1111、Forge 或 ReForge，直接读取模型与采样配置并生成图片
- SD/WAI 是当前生产出图路径；ComfyUI 通过应用 API 提供 Anima、Krea 2 Turbo 实验自然语言出图和 WebUI 离线时的 basic WAI fallback。Krea 无角色 LoRA/negative，身份不保证；不等价提供 hires.fix、detailer 或 ControlNet 能力
- 在当前 reForge 环境中自动增强双人构图：Regional Prompter 分离提示词区域，逐场景 OpenPose 图稳定站位，ADetailer 只在远景双人脸上保守启用
- 在"角色房间"中连接本机 Ollama，与宁宁或夏目进行流式文字聊天；句子级语音流水线边生成、边翻译、边合成、顺序播放，Live2D 立绘随真实语音振幅对口型、随情感切换表情
- 控制面板提供显存资源调度：绘图优先 / 聊天优先一键切换，语音、WebUI、Ollama 可单独启停
- 查看生成进度、停止任务、固定 Seed、使用 hires.fix、顺序排队
- 中文阅读文本与配音稿彼此独立：画面保持中文，角色默认说日文，也可切换中文演绎
- 将作品、参数、收藏和备注保存在当前浏览器的 IndexedDB 中，并用 JSON 文件完整备份或恢复
- 在作品册中按原始横竖比例欣赏成图，点击进入近全屏观画
- 通过带 Token 的临时链接，让朋友使用你电脑上的 SD WebUI 出图
- 桌面 Companion：Tauri 2 是桌面壳（Companion + Atelier 双窗口、托盘、深链、Native Live2D overlay）。开发执行 `npm run dev:tauri`，构建 NSIS 执行 `npm run package:tauri`；Electron 回退版已退役（存档见 `desktop-electron-legacy` tag）

## 最常用的启动方式

### 1. 准备 SD WebUI

在 Stability Matrix 的 WebUI 启动参数中保留：

```text
--api --port 7860
```

`--api` 只会开放本地接口，不影响正常使用 WebUI。实际端口不是 7860 时，以 Stability Matrix 日志显示的地址为准。

### 2. 打开控制面板

双击 `control.bat`，确认 WebUI 地址后点击 **启动并生成分享链接**。

- 自己使用：点击 **打开本地网站（无需 Token）**
- 分享朋友：复制控制面板中的带 Token 链接
- 使用结束：点击 **停止全部服务**

首次运行会安装 Node.js 依赖。公网分享依赖本机安装的 `cloudflared`；没有安装时本地网站和 SD 连接仍可使用。

完整说明与排错方法见 [STARTUP.md](STARTUP.md)。

当前实现、验证基线、阻断项和维护文档索引见 [docs/project-status.md](docs/project-status.md)。

## 使用流程

```
想画的瞬间
  ↓
选择 Scene（场景库或首页精选）
  ↓
调整故事、角色、情绪、镜头、构图、光照
  ↓
生成 Prompt → 调用 SD WebUI 出图
  ↓
收藏、重新生成或做变体
```

Scene 是创作的起点，Prompt 是它面向 Stable Diffusion 的输出。

## 技术架构

**前端**：Vue 3 SPA，Vite 构建，TypeScript，Pinia 状态管理

- `src/stores/` — Pinia：场景数据、导演台状态（替代原来分散的全局变量）
- `src/composables/` — useVoice、useLive2D、useChatStorage、useSDGenerate、useKVStore、useImageStore
- `src/views/` — 每条路由对应一个 `.vue`，全部懒加载
- `src/config/` + `src/utils/` — 角色常量、场景搜索纯函数、流式解析工具

**后端**：Node.js + Express（`server.js`）

- 生产模式：Express 直接 serve Vite 构建产物 `dist/`
- 开发模式：Vite dev server（`:5173`）通过代理把 API 请求转发到 Express（`:3000`）
- 提供聊天、语音、Live2D 状态、维护等 API 接口
- 通过应用 API 提供 Anima 和 basic WAI ComfyUI fallback；hires/detailer/ControlNet 仍依赖 WebUI
- 静态 serve `data/`、`assets/`、`tools/`、`docs/` 目录

**数据**（运行时 fetch，不被 Vite 打包）：

- `data/scenes.json` — 由分片自动生成，供前端读取
- `data/curation.json` — 精选/招牌场景排序
- `data/characters.json` — 角色定义与 LoRA 配置
- `data/tags.json`、`data/loras.json`、`data/presets.json` 等

**静态资源**（Express 提供）：

- `assets/characters/` — 角色立绘图
- `assets/live2d/` — Live2D 模型文件
- `assets/vendor/` — wl-live2d、Pixi.js、Cubism SDK

## 项目结构

```text
绫季绘境/
├── DESIGN.md               # 网站与控制面板的唯一总设计规范
├── index.html              # Vite SPA 入口（无全局脚本注入）
├── vite.config.ts          # Vite 构建配置 + dev 代理
├── control.bat             # Windows 控制面板入口
├── server.js               # Express：静态服务、SD 代理、临时分享
├── src/                    # Vue 3 SPA 源码（Vite 构建目标）
│   ├── config/             #   角色常量、导演台静态定义
│   ├── utils/              #   流式解析、场景 UX 纯函数
│   ├── stores/             #   Pinia：场景数据、导演台状态
│   ├── composables/        #   Voice / Live2D / Chat / SD / IndexedDB
│   ├── components/         #   布局、导航、主题切换、场景卡片
│   ├── views/              #   每路由一个 Vue 视图组件
│   └── assets/css/         #   设计系统 Token、组件样式
├── routes/                 # Express API 路由（chat / voice / live2d / maintenance）
├── services/               # TypeScript 运行时服务（Ollama、TTS、HTTP…）
├── desktop/                # Electron Companion 稳定回退壳
├── desktop-tauri/          # Tauri 2 壳、Native Live2D overlay、sidecar 与打包
├── types/                  # 共享 TypeScript 类型定义
├── data/                   # 运行时 JSON 数据（scenes / characters / tags…）
├── assets/                 # 静态资源（角色立绘、Live2D、vendor SDK）
├── css/                    # docs/ 文档页专用 CSS
├── tools/                  # 剩余工具 JS（prompt-policy、sd-api、nav、theme…）
├── docs/                   # 创作规范、质量标准和维护手册
├── scripts/                # 维护、测试与运行辅助脚本
└── runtime/                # 本机配置、日志、进程状态与朋友生成图
```

## 数据与分享

- 场景、角色和默认参数来自仓库中的 JSON 文件
- 历史、收藏、项目和图片主要保存在浏览器的 IndexedDB 中
- 右上角可以导出包含历史、项目、设置和图片的版本化备份；恢复时可选合并或覆盖
- 项目没有账号系统或云端数据库
- 网关配置、Token、日志和朋友生成图保存在忽略提交的 `runtime/` 目录
- 开启分享时会建立临时公网通道；链接持有者可调用你本机的 SD WebUI，请只发给信任的人

## 维护与校验

```powershell
npm run validate        # 完整校验：design lint + 构建 + 类型检查 + 场景/内容契约 + 所有脚本测试
npm run test:e2e        # Playwright 浏览器冒烟测试
npm run typecheck       # TypeScript 检查（app + runtime）
npm run classify-ratings # 对齐场景内容分级
```

日常增删场景、修改故事、维护标签或替换样张，直接使用网站中的 **更多 → 场景管理**。

只有批量处理或调整数据结构时才需要编辑 `data/scenes/*.json`；不要直接修改自动生成的 `data/scenes.json`。

## 维护原则

1. 自己和朋友实际会用的功能优先。
2. 本地数据和简单启动优先。
3. 场景质量优先于场景数量。
4. 分享功能默认保持临时、可停止、需要 Token。
5. 不为了版本号扩张成公开平台。
6. 桌面端是主要使用环境；移动端保持基本可用，但不以牺牲桌面创作空间为代价。

> Prompt 描述图片，Scene 描述瞬间。这个工具要做的，是让那个瞬间更容易被画出来。

## License

MIT 协议，见 [LICENSE](LICENSE)。角色内容（绫地宁宁、四季夏目及其原作）版权归原权利方所有，本项目为同人性质的非官方作品，不主张对其的所有权。
