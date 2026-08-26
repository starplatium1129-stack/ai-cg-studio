# 绫季绘境

> 从故事出发，把想画的瞬间整理成可以直接生成的 Galgame 风格 CG、4 视角角色参考档案与 AI 叙事短片。

[English](README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 项目定位

绫季绘境 (Lingji Atelier) 是我为个人创作整理的一套本地工具，平时自己使用，也会临时分享给身边的朋友。它不是公开运营的平台，也不提供账号、社区、商店或云端同步。

系统不仅完整支持专属主角 **绫地宁宁** 与 **四季夏目**，还内置了覆盖明日方舟、原神、崩铁、芙莉莲、Fate、Re:Zero、俄语妹、青猪、刀剑神域、魔禁/超炮、约战等作品的 **43 位热门角色**（236 套服装形态，参考档案库 45 角色×236 形态/944 视角）。项目会把故事、角色、情绪、镜头、构图、光照和出图参数放在同一个 Scene 中，减少从空白 Prompt 开始反复试错的时间。

这是非官方、非商业的个人爱好项目，与原作及相关权利方没有隶属或授权关系。

## 现在能做什么

- **丰富的场景库与热门角色体系**：
  - 浏览和搜索 303 个场景（+441 蓝图）与 335+ 逐场景审核样张，按角色、分类、季节与内容分级筛选（全年龄 / R15 / R18）。
  - 43 位热门动漫/游戏角色，支持专属服装形态与私密全裸纯粹形态切换。
  - 在“效果样张”中查看逐场景审核的实际成图，支持带着场景直接进入导演台。
- **角色 4 视角参考档案库（Character Reference Bible）**：
  - 45 角色 $\times$ 236 服装形态（共 944 个电影级标准参考视角）：面部特写（85mm f/1.4）、3/4 半身定妆、正面动态全身立姿与 45° 侧后背影/回眸。
  - 全自动闭环自愈流水线：3 并发批量出图池 + 4 并发 Gemini 3.7 Flash 纯视觉审核池 + 定向微调自愈引擎。
  - 标准化参考资产契约为下游 MiniMax H3 Ref2VA 视频生成提供稳定的角色锁脸保障。
- **多生成引擎协同与 38 位精选动漫画风**：
  - 跨引擎提示词自动编译：支持 Stable Diffusion / WAI (Danbooru tags)、Anima 1.1 (`@artist` + 原生标签流) 与 Krea 2 Turbo (3~5 句纯英文自然语言)。
  - 内置 38 位精选动漫画风与作监级风格（如猫富ちゃお/动画工房、浅野恭司/WIT Studio、Rella 星夜月光、深崎暮人、So-bin 等）。
  - 在 reForge 环境中自动增强双人构图：Regional Prompter 分离提示词区域，逐场景 OpenPose 稳定站位。
- **AI 叙事视频工作台（Video Studio）**：
  - 本地 AI 视频生成支持 Wan 2.2 TI2V 与 MiniMax H3（Ref2VA 多模态参考图绑定）。
  - 剧本智能分镜拆解、画风锚注入、中日英对白语言显式控制（`dialogueLang: auto/zh/ja/en`）与 Range 流式播放。
- **角色房间与语音交互**：
  - 本地角色房间连接 Ollama 或兼容 API 进行流式文字聊天；句子级语音流水线边生成、边翻译、边合成（GPT-SoVITS）。
  - Live2D 立绘随真实语音振幅对口型、随情感切换表情零件。
  - 控制面板提供显存资源调度：绘图优先 / 聊天优先一键切换，模型按需卸载。
- **桌面端伴侣（Tauri 2）**：
  - 轻量 Tauri 2 桌面端（Companion + Atelier 双窗口、托盘、Native Live2D overlay），支持增量极速部署流水线（`deploy-desktop-quick.ps1`）。

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
- 使用结束：在「本机服务」区逐个点击停止；手动启动的 ComfyUI / reForge 也能从面板关闭

首次运行会安装 Node.js 依赖。公网分享依赖本机安装的 `cloudflared`；没有安装时本地网站和 SD 连接仍可使用。

完整说明与排错方法见 [STARTUP.md](STARTUP.md)。

当前实现、验证基线、阻断项和完整文档索引见 [docs/project-status.md](docs/project-status.md) 与 [docs/INDEX.md](docs/INDEX.md)。

## 项目结构

```text
AI-CG-Studio/
├── DESIGN.md               # 网站与控制面板的唯一总设计规范
├── AGENTS.md               # 项目约束、质量门槛与协作者开发指南
├── index.html              # Vite SPA 入口（无全局脚本注入）
├── vite.config.ts          # Vite 构建配置 + dev 代理
├── control.bat             # Windows 控制面板入口
├── server.js               # Express：静态服务、SD 代理、临时分享
├── src/                    # Vue 3 SPA 源码（Vite 构建目标）
│   ├── config/             #   角色常量、画师库、导演台静态定义
│   ├── utils/              #   流式解析、角色参考库数据、Prompt 编译器
│   ├── stores/             #   Pinia：场景数据、导演台状态
│   ├── composables/        #   Voice / Live2D / Chat / SD / IndexedDB
│   ├── components/         #   布局、导航、主题切换、视频工作台组件
│   ├── views/              #   每路由一个 Vue 视图组件（全部懒加载）
│   └── assets/css/         #   设计系统 Token、组件样式
├── routes/                 # Express API 路由（chat / voice / live2d / video / maintenance）
├── services/               # TypeScript 运行时服务（Ollama、TTS、HTTP…）
├── desktop-tauri/          # Tauri 2 壳、Native Live2D overlay、sidecar 与打包
├── types/                  # 共享 TypeScript 类型定义
├── data/                   # 运行时 JSON 数据（scenes / characters / blueprints / standards）
├── assets/                 # 静态资源（角色立绘、Live2D、vendor SDK）
├── docs/                   # 创作规范、质量标准、全景索引（docs/INDEX.md）
├── scripts/                # 维护、测试、参考图生成与运行辅助脚本
└── runtime/                # 本机配置、日志、进程状态与朋友生成图
```

## 维护与校验

```powershell
npm run typecheck:app     # Vue SFC 与前端 TypeScript 类型检查
npm run build             # 构建生产前端产物
npm run validate          # 完整校验：代码规范 + 构建 + 类型检查 + 契约测试
```

日常增删场景、修改故事、维护标签或替换样张，直接使用网站中的 **更多 → 场景管理**。

## 维护原则

1. 自己和朋友实际会用的功能优先。
2. 本地数据和简单启动优先。
3. 场景质量与参考图保真度优先于单纯数量。
4. 分享功能默认保持临时、可停止、需要 Token。
5. 不为了版本号扩张成公开平台。
6. 桌面端是主要使用环境；移动端保持基本可用。

> Prompt 描述图片，Scene 描述瞬间。这个工具要做的，是让那个瞬间更容易被画出来。

## License

MIT 协议，见 [LICENSE](LICENSE)。角色内容及其原作版权归原权利方所有，本项目为同人性质的非官方作品，不主张对其的所有权。
