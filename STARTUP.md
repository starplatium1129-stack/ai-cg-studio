# AI CG Studio 启动与排错

这份说明分为两种使用方式：连接 SD WebUI 的完整模式，以及只浏览页面的静态模式。

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
7. 使用结束后点击 **停止分享**。

首次运行时，`control.bat` 会自动执行 `npm install`。控制面板默认打开在 `http://127.0.0.1:3001/`，创作网站通常打开在 `http://127.0.0.1:3000/`；如果 3000 已占用，控制面板会显示实际使用的端口。

### 本地使用和朋友分享的区别

- **本地网站**：只允许当前电脑访问，不需要 Token。
- **朋友链接**：通过临时公网通道访问，必须带 Token。
- **没有 cloudflared**：本地网站和 SD 连接照常使用，但不会出现公网域名。
- **重新启动网关**：Token 会重新生成，临时域名也可能变化，需要重新发链接。

朋友不需要安装 SD WebUI，所有生成任务仍由你的电脑执行。请只把链接发给信任的人，并在不用时停止分享。

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

VS Code Live Server、`npx serve` 或 `npx http-server` 也可以浏览页面。它们没有 `/sdapi` 代理，因此导演工作台会提示当前页面未启用 SD 网关。

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

- `data/scenes.json`：206 个场景
- `data/characters.json`：角色设定
- `data/tags.json`：统一标签
- `data/loras.json`：LoRA 配置
- `scripts/validate-scenes.js`：场景一致性校验
- `scripts/clean-scenes.js`：批量清洗脚本，运行前会创建备份

日常修改场景后建议执行：

```powershell
npm run validate
```

批量清洗会直接改写场景数据，不应作为普通启动步骤；只有明确需要整理数据时再使用。
