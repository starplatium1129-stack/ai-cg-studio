# AI CG Studio 启动与排错

这份说明分为两种使用方式：连接 SD WebUI 的完整模式，以及只浏览页面的静态模式。角色语音是可选能力，不安装也不影响场景浏览、Prompt 或出图。

## 完整模式：连接 SD WebUI

### 准备条件

- Windows 与 Node.js
- 由 Stability Matrix 启动的 AUTOMATIC1111、Forge 或 ReForge
- WebUI 启动参数中包含 `--api`
- 如需生成公网分享链接，本机还要安装 `cloudflared`

建议在 Stability Matrix 中使用：

```text
--api --port 7860
```

`--api` 不会关闭 WebUI 自带页面，也不会妨碍本地正常使用。它只是让 AI CG Studio 可以通过接口读取配置和提交出图任务。

### 启动步骤

1. 先在 Stability Matrix 中启动 WebUI。
2. 查看日志中的地址，通常是 `http://127.0.0.1:7860`。
3. 双击项目根目录的 `control.bat`。
4. 在控制面板填写 WebUI 地址，等待状态显示已连接。
5. 点击 **启动并生成分享链接**。
6. 自己点击 **打开本地网站（无需 Token）**；需要分享时，再复制带 Token 的链接给朋友。
7. 使用结束后点击 **停止全部服务**。它会停止本地网关、分享隧道、GPT-SoVITS，以及由控制面板启动的 reForge；手动启动的 WebUI 不会被误关。

首次运行时，`control.bat` 会自动执行 `npm install`。控制面板默认打开在 `http://127.0.0.1:3001/`，创作网站通常打开在 `http://127.0.0.1:3000/`；如果 3000 已占用，控制面板会显示实际使用的端口。

### 本地使用和朋友分享的区别

- **本地网站**：只允许当前电脑访问，不需要 Token。
- **朋友链接**：通过临时公网通道访问，必须带 Token。
- **没有 cloudflared**：本地网站和 SD 连接照常使用，但不会出现公网域名。
- **重新启动网关**：Token 会重新生成，临时域名也可能变化，需要重新发链接。

朋友不需要安装 SD WebUI，所有生成任务仍由你的电脑执行。请只把链接发给信任的人，并在不用时停止分享。

## 可选：GPT-SoVITS 角色语音

导演工作台提供两层语音能力：

- **本机试听**：按当前选择调用浏览器的日文或中文系统声音，用来检查文本和语速，不需要额外安装。
- **AI 声线生成**：中文阅读文本与配音稿互不影响；画面保持中文，由本机 GPT-SoVITS 专用角色权重默认生成日文 WAV，也可切换中文。朋友通过分享链接使用时，计算仍在你的电脑上完成。

当前电脑已在相邻的 `AI/Voice/` 目录保存数据集、检查点、评测报告、最终权重与参考音频。双击 `control.bat` 时会自动检查并启动语音服务；网关会串行处理请求并按角色切换权重，也可单独运行：

```powershell
../AI/Voice/Start-Voice.ps1
```

语音 API 地址为 `http://127.0.0.1:9880`。若迁移到另一台电脑，可在启动控制面板中重新填写地址，并为宁宁、夏目分别配置：

1. GPT-SoVITS 能读取的参考音频本机绝对路径。
2. 参考音频中实际说出的原文，必须与音频一致。

参考音频及其原文使用日语 `ja`。导演台默认读取场景的日文 `storyJa` 并提取 `「角色台词」`，也可切换中文或朗读完整故事；目标语言会随每次生成请求传给 GPT-SoVITS，不再固定为中文。请只使用你有权使用的声音模型和参考音频。

## 双人构图增强

当前电脑的 reForge 已配置 Regional Prompter、内置 ControlNet 与 ADetailer。导演台选择“宁宁 × 夏目”的双人场景时会自动按当前能力启用：

- **角色分区**：把共同环境、左侧宁宁和右侧夏目的提示词分开，减少脸、发色、瞳色与服装互相污染。
- **姿势约束**：读取 `assets/dual-poses/场景ID.png`，使用 Xinsir SDXL OpenPose 模型稳定两人的位置、朝向与互动关系。
- **双脸精修**：只对 `wide_shot` 或 `full_body` 双人场景启用低重绘幅度 ADetailer，避免近景中已经稳定的官方脸被二次改坏。

这些能力只对双人角色生效。宁宁或夏目的单人生成仍使用已逐场景审核的原模型、Prompt、LoRA 权重和采样参数，不会附带 Regional Prompter、ControlNet 或 ADetailer。

控制面板启动 reForge 时会自动添加共享模型目录：

```text
--controlnet-dir E:\code\2\lora\AI\Data\Models\ControlNet
```

当前姿势模型为 `xinsir_openpose_sdxl_1.0.safetensors`。逐场景姿势图如需重建，请先启动 WebUI，再执行：

```powershell
python scripts/generate-dual-pose-assets.py
```

若扩展或模型暂时不可用，网站会按实际检测到的能力自动降级，普通出图仍可继续。

## WebUI 地址不是 7860

Stability Matrix 可能自动分配其他端口。不要猜端口，直接复制日志中显示的本机地址，例如：

```text
http://127.0.0.1:7861
```

在控制面板停止分享后修改地址，再重新启动。地址只接受当前电脑的 `http://127.0.0.1:端口` 或 `http://localhost:端口`。

## WebUI 使用 API 认证

如果 WebUI 的启动参数包含：

```text
--api-auth user:password
```

请在启动 `control.bat` 前打开 PowerShell，并在当前窗口设置：

```powershell
$env:SD_API_AUTH = 'user:password'
./control.bat
```

关闭该 PowerShell 窗口后，环境变量不会继续保留。

## 只浏览页面

普通静态服务器适合浏览场景、角色和文档，但不能直接调用 SD WebUI。

### Python

```powershell
Set-Location E:\code\2\lora\AI-CG-Studio
python -m http.server 8090
```

然后打开 `http://127.0.0.1:8090/`。

### 其他静态服务器

VS Code Live Server、`npx serve` 或 `npx http-server` 也可以浏览页面。它们没有 `/sdapi` 与 `/api/tts` 网关，因此不能直接出图或生成 AI 声线，但系统声音试听仍可使用。

不要直接双击 `index.html`。项目通过 `fetch()` 加载 JSON，`file://` 页面会被浏览器安全策略阻止。

## 常见问题

### 控制面板显示 WebUI 未连接

依次检查：

1. WebUI 是否已经完成启动，而不是仍在加载模型。
2. Stability Matrix 的启动参数是否包含 `--api`。
3. 控制面板中的地址和日志地址是否完全一致。
4. WebUI 是否使用了 `--api-auth`，以及 `SD_API_AUTH` 是否正确。
5. 端口是否被防火墙或其他程序拦截。

### 本地网站能打开，但不能出图

确认你是从控制面板的 **打开本地网站（无需 Token）** 进入，而不是从 Python、Live Server 或其他静态服务器进入。只有项目网关会代理 `/sdapi`。

### 没有生成分享链接

先确认本地网站可以正常出图，再检查 `cloudflared` 是否安装在：

```text
C:\Program Files (x86)\cloudflared\cloudflared.exe
```

公网通道建立需要网络，通常会比本地网关晚几秒出现。

### 朋友打开链接提示缺少 Token

请从控制面板复制完整链接，不要手动删除 `?token=...`。首次验证后，网站会把 Token 写入安全 Cookie，并跳转到不含 Token 的干净地址。

### 多人同时生成或停止任务

SD WebUI 会按自身能力排队。“停止生成”调用的是 WebUI 全局中断，可能会停止其他人当前正在运行的任务。分享时最好约定不要同时点击停止。

### GPT-SoVITS 已启动但仍显示未连接

确认启动的是 `api_v2.py`，地址和端口与控制面板一致。角色状态显示“待配参考音频”时，说明 API 已连接，但当前角色还缺参考音频路径或对应原文。

### 历史或图片不见了

历史、收藏和图片主要保存在当前浏览器的 IndexedDB 中。更换浏览器、使用隐私模式或清理网站数据，都可能让这些内容不可见。重要图片请及时下载或另行备份。

## 手动启动（排错用）

通常不需要手动运行。需要查看完整日志时，可以在项目目录执行：

```powershell
npm install
$env:SD_HOST = 'http://127.0.0.1:7860'
node server.js
```

默认情况下会尝试建立临时公网通道。如果只想测试本地网关：

```powershell
$env:DISABLE_TUNNEL = '1'
node server.js
```

在当前终端按 `Ctrl+C` 即可停止手动启动的进程。

## 数据与维护

运行时文件会自动集中到 `runtime/`，避免挤在项目根目录：

- `runtime/config.json`：SD、TTS 与角色声线配置
- `runtime/state/`：网关与隧道的 PID、端口和临时 Token
- `runtime/logs/`：控制面板、网关和隧道日志
- `runtime/outputs/`：朋友通过网关生成并备份的图片

旧版根目录中的 `.gateway_*`、`tunnel.log` 和 `friend_outputs/` 会在首次启动时自动迁移。`runtime/` 已被 Git 忽略，不应提交。

- `data/scenes.json`：284 个场景
- `data/characters.json`：角色设定
- `data/tags.json`：统一标签
- `data/loras.json`：LoRA 配置
- `scripts/validate-scenes.js`：场景一致性校验
- `scripts/optimize-scenes.js`：规范标签、镜头、负面词与未解析占位符
- `scripts/clean-scenes.js`：批量清洗脚本，运行前会创建备份

日常修改场景后建议执行：

```powershell
npm run validate
```

批量导入或修改场景后，可先运行 `npm run optimize-scenes`，再运行校验。

批量清洗会直接改写场景数据，不应作为普通启动步骤；只有明确需要整理数据时再使用。
