# 桌面端部署：增量 还是 完整安装

统一入口只有一个：**`deploy-desktop.bat`**（项目根）。实现脚本也只有一个：
`scripts/maintenance/deploy-desktop-quick.ps1`。不要再新建部署脚本。

```bat
deploy-desktop.bat                  :: 增量部署（默认）
deploy-desktop.bat -UseInstaller    :: 完整安装（跑安装包）
deploy-desktop.bat -SkipBuild       :: 已手动 build 过，跳过前端构建
deploy-desktop.bat -NoRestart       :: 部署后不自动启动
```

两者都会：停应用 → 清 WebView2 缓存 → 验证反推依赖 → 重启桌面端。
`-Cleanup` 默认已带（清理源端已删除的历史残留）。

---

## 一、决策表：改了什么，就用什么

| 改动内容 | 用哪个 | 原因 |
|---|---|---|
| `src/**` 前端代码（Vue / TS / CSS） | **增量** | 只需换 `dist/` |
| `data/` 场景、热门角色数据 | **增量** | 只需换 `data/` 产物 |
| `routes/` `server/` `services/` `scripts/lib/` | **增量** | 网关 JS 直接复制即可 |
| `assets/` 新增/修改静态资源 | **增量** | 直接复制 |
| `assets/` **删除**了资源 | **增量** | 必须带 `-Cleanup`，否则安装目录里那份会永久残留 |
| `package.json` 新增运行时依赖 | **完整安装** | 依赖在 `node_modules`，增量不碰它 |
| `desktop-stage-resources.js` 的 `RUNTIME_DEPENDENCIES` | **完整安装** | 改了白名单要重新打包才生效 |
| Rust 代码（`desktop-tauri/src-tauri/src/`） | **完整安装** | 增量不替换 exe |
| `tauri.conf.json`（版本号、CSP、资源清单等） | **完整安装** | 同上 |
| 首次安装 / 换机器 / 桌面端起不来 | **完整安装** | 需要 exe 和完整目录结构 |

判断口诀：**只动了「会被复制进去的文件」→ 增量；动了 `node_modules` 或 exe 本身 → 完整安装。**

---

## 二、两种模式做了什么

### 增量部署（默认，秒级）
1. `npm run build`（除非 `-SkipBuild`）
2. 停应用 + 停 3123 网关端口
3. 清理 `-Cleanup` 登记的残留目录
4. 刷新 `build-scenes` / `build-popular` 数据产物
5. 依次复制 `data` → `dist` → `assets` → `routes` → `server` → `services` → `scripts/lib` → `server.js`
6. 剪枝 `dist/_app` 里失效的内容哈希 chunk
7. 清 WebView2 缓存，验证反推依赖，重启

> 复制顺序有讲究：**data 必须先于 dist**。客户端用 `?v=DATA_VERSION` 请求 data，
> 若新 dist（新版本号）曾对着旧 data 提供过一次，WebView2 会把旧内容以 immutable
> 一年缓存写进新 URL，之后再也不刷新。

### 完整安装（`-UseInstaller`，约 1 分钟 + 向导）
跑 `runtime/desktop-updates/` 下最新的 `*-setup.exe`（NSIS）。
它会覆盖整个 `gateway/`（**包括 `node_modules`**）并替换 exe。

---

## 三、三个必须知道的坑

### 1. 新增运行时依赖，光 `npm install` 没用
`desktop-stage-resources.js:35` 的 `RUNTIME_DEPENDENCIES` 白名单决定了 gateway 的
`package.json` 里有什么、npm 会装什么。新依赖**必须登记进白名单再重新打包**，
否则网页版正常、桌面端静默降级——不报错，只是功能退化。

> 2026-08-29 实例：`onnxruntime-node` + `sharp` 漏登记，真实反推在桌面端一直走启发式兜底。

### 2. 依赖变了，顺序必须是「先打包，再安装」
NSIS 安装会**覆盖整个 `gateway/node_modules`**。所以：
- ✅ 先 `npm run package:tauri` 产出新包 → 再 `-UseInstaller` 安装
- ❌ 先手动给已安装网关补依赖 → 再装新包 = 白装，会被覆盖掉

### 3. 源端删除的资源不会自动消失
`Copy-Item -Recurse -Force` **只合并不删除**。源里删掉的目录，安装目录里那份会永久堆积。
遇到「源端删除型」迁移，把路径加进脚本的 `$STALE_ASSETS` 数组。

> 2026-08-29 实例：`assets/character-references`（1.2 GB）迁出项目后，
> 安装目录那份靠增量部署永远清不掉，最后靠 `-Cleanup` 才删掉。

---

## 三·五、应用内自动更新（tauri-plugin-updater）

桌面端已接入 **Tauri updater**：客户端启动时后台检查一次 `http://127.0.0.1:3123/desktop-updates/latest.json`，
发现新版本 → 系统通知 + 控制面板顶部「一键升级」横幅（下载安装后自动重启）。
Rust 侧（`updater_cmd.rs`）、前端横幅（`useDesktopUpdater.ts` + `ControlView.vue`）均已落地；
**日常发版只需保证版本号递增 + 产物同步到安装版伺服目录**。

### 发版工作流（一次命令）

```powershell
node scripts/maintenance/release-desktop-update.js --bump patch [--skip-build]
deploy-desktop.bat -SkipBuild          # 增量部署会把 desktop-updates 产物同步进安装版
```

1. `--bump patch|minor|major`：发布前**自动递增版本号**（`package.json` 与 `tauri.conf.json` 同步）。
   客户端 updater 只在「远端版本 > 当前安装版本」时提示——**不 bump 就永远检不到更新**
   （2026-08-31 破案：发布与安装同为 1.5.0，功能从未触发）。
2. `deploy-desktop-quick.ps1` 增量部署会把 `runtime/desktop-updates/` 的最新
   `latest.json + setup.exe + .sig` 同步到安装版 `gateway/runtime/desktop-updates/`
   （`server.js` 的 `/desktop-updates` 静态伺服点，安装版 ROOT_DIR = gateway 目录；
   只同步最新包，`.prev-*` 旧包跳过防膨胀）。
3. 已装客户端下次启动自动检测 → 一键升级。**首个新版本走一次自动更新闭环**
   （当前安装 1.5.0 → 发 1.5.1 后客户端自动提示，无需再手动覆盖安装）。

> 坑：安装版伺服目录是 `C:\Program Files\AI-CG-Studio\gateway\runtime\desktop-updates`，
> **不是**工作区的 `runtime/desktop-updates`——两者靠部署脚本同步，缺了同步步骤客户端会 404 静默失败
> （updater 失败不打扰用户，控制面板横幅也不出现）。

---

## 四、常见问题

**Q：同版本号重装（1.5.0 → 1.5.0）会清掉旧文件吗？**
不会。NSIS 走「已安装同版本」分支，默认「添加或重装」= 纯覆盖。想清残留用部署脚本的 `-Cleanup`；
只有选「卸载应用」才会删旧文件（但那样不会装新的）。

**Q：装完怎么确认真实反推能用？**
脚本最后一步会 `require('onnxruntime-node')` + `require('sharp')`。
要更彻底可以模拟网关环境跑一次推理（需设置 `AI_WORKSPACE_ROOT` 指向 AI 工作区）。

**Q：为什么必须我点 UAC？**
写入 `C:\Program Files` 需要管理员。agent 侧发起提权（`Start-Process -Verb RunAs`、
Bash 调 powershell）被安全策略拦截——这是命令校验规则，不是权限问题，只能由用户确认。

**Q：安装包多大算正常？**
迁移前 1074.5 MB → 当前 **178.0 MB**（含反推依赖）。打包内容 ≈ `desktop-tauri/src-tauri/resources`，
健康值约 150–250 MB；突然变大先查是不是又把大媒体卷进来了。
