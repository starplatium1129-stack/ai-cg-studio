# 桌面端角色档案过时（缓存污染）排查留档

> 日期：2026-08-15 · 状态：已解决 · 涉及：deploy-desktop-quick.ps1、WebView2 缓存、DATA_VERSION 机制

## 现象

- 桌面端（Tauri 壳 + 内置网关 :3123）「角色档案」页没有明日方舟等新加角色，只显示 20 个（18 热门 + 宁宁 + 夏目）。
- 网页端（:3000 dev 网关）同页正常显示 35 个角色（含 15 个明日方舟）。
- 已跑 `deploy-desktop-quick.ps1` 重建（复制 dist/data/assets + 重启应用）后**仍然过时**。

## 排查过程（排除项）

以下环节全部验证为正常，**不是**根因：

1. 安装目录 `C:\Program Files\AI-CG-Studio\gateway\data\` 与工作区 12 个数据文件 sha1 全同（35 角色含 15 舟游；scene-blueprints 含 150 舟游蓝图）。
2. 安装目录 `dist/` 为最新构建（index.html 引用 `index-DBZQZjqP.js`，内含当前 `DATA_VERSION=2921653165`）。
3. 桌面网关 :3123（无论哪个 sidecar 实例）对明文 / `.gz` / `.br`（`Accept-Encoding: br` 模拟 WebView）均返回 35 角色；`?v=` 任意值都返回当前文件内容（服务器不校验版本号）。
4. 预压缩产物 `characters.json.br/.gz` 内容均为 35 角色（brotli/gzip 解压验证）。
5. 15 张舟游立绘 `assets/characters/popular-*_arknights.png` 全部在安装目录。
6. 进程状态：应用重启后是全新 WebView2 进程树（内存缓存为空）；壳、sidecar、WebView 关系正常。
7. 磁盘空间、`%LOCALAPPDATA%\com.aics.studio\EBWebView` ACL、写入权限均正常。
8. `parseCharacterProfiles` 过滤逻辑：35 角色数据 id/name 无缺失、无重复，不会过滤任何角色。
9. WebView2 History 确认桌面端只用 :3123（:3000 的最后访问是 16:25，即网页端浏览器）。

## 根因

**WebView2 磁盘 HTTP 缓存中有一条 `http://127.0.0.1:3123/data/characters.json?v=2921653165 → 20 角色旧版` 的条目，带 `public, max-age=31536000, immutable`（一年强缓存）。**

机制链条：

1. 客户端（`sceneStore.ts`）用 `DATA_VERSION` 拼 URL：`/data/characters.json?v=2921653165`；服务器对该 URL 返回 `immutable` 一年缓存。
2. 在某个「部署窗口期」（安装目录 dist 已带新版本号 `2921653165`、但 data 仍是 20 角色旧版）WebView 请求过一次 → **旧数据按新版本号被 immutable 缓存一年**。
3. 此后数据更新为 35 角色、甚至多次重建/重启应用，请求 URL（`?v=2921653165`）不变 → **磁盘缓存（跨进程持久化）永远命中旧条目** → 桌面端永远显示 20 角色。
4. 网页端浏览器没有这条缓存 → 一直正常。「重建了还是不行」= 重建只更新服务器文件，**缓存条目只有清掉才会失效**。

关键证据：

- 缓存索引 `EBWebView\Default\Cache\Cache_Data\data_1` 中列出 `?v=2921653165` 条目（URL 只存在索引，f_ 文件只有 body，初次扫描 f_ 文件会漏判）。
- **决定性实验：杀进程 → 改名 `Default\Cache`（及 Code Cache/GPUCache）→ 重开桌面端 → 角色档案恢复 35 个、明日方舟出现。**

## 修复

1. **`scripts/maintenance/deploy-desktop-quick.ps1` 复制顺序改为 `data → dist → assets`**（原为 dist 在前）：保证「新版本号只会对应新数据」，杜绝「新版本号 + 旧数据」窗口期；即使复制中途被中断/人工只复制了部分，也不会产生错误缓存条目。
2. **部署脚本增加防御层**：复制后、启动前，清除 WebView2 HTTP 缓存 `%LOCALAPPDATA%\com.aics.studio\EBWebView\Default\{Cache,Code Cache,GPUCache}`（纯性能缓存，无用户数据；IndexedDB 图片历史与 Local Storage 不动）。
3. 脚本保持纯 ASCII（PowerShell 5.1 约束）。

## 验证

- 清缓存后桌面端角色档案页：**35 SUBJECTS，明日方舟分组 15 个角色，立绘正常**。
- 部署脚本新流程（data 先行 + 清缓存）为预防性修复；下次 quick deploy 自动执行。

## 经验 / 后续注意

- **排查缓存类问题要扫 `Cache_Data` 的 `data_*` 索引文件**，URL 只存在索引里，f_ 文件只有 body（初版扫描 f_ 漏掉了全部条目）。磁盘缓存格式有公开文档：<https://forensics.wiki/chrome_disk_cache_format/>（`data_0..3` 索引 + `f_*` 条目文件）。
- WebView2 磁盘缓存**跨进程持久化**，「全新进程」不等于「全新缓存」；immutable + 一年 max-age 的条目只有主动清除才失效。「WebView2 缓存不更新/如何清除」是常见问题，官方有大量现成答案（Microsoft Q&A / WebView2Feedback repo），应直接搜索而非本地反复试错。
- 若再遇「桌面端与网页端数据不一致」，先执行：杀 `ai-cg-studio-desktop`/aics 的 `msedgewebview2`/3123 的 node → 改名 `EBWebView\Default\Cache` → 重开。
- 顺带观察：sidecar 以控制台模式启动会弹 node.exe 黑窗（用户已注意到）；已由 `CREATE_NO_WINDOW`（commit b289c8d）修复并重新打包。

## 排查过程教训（违反「遇难先搜」，2026-08-15 补记）

本次排查违反了 AGENTS.md 最高优先级「遇难先搜，禁止盲目试错」：连续 2 次假设无效后没有停下搜索，而是继续本地试错了 6+ 轮（磁盘缓存→残留 WebView 进程→.br 产物→页面指纹→版本号→索引解析），期间还多次打扰用户配合验证。事后搜索确认，**两个关键机制都是公开已知的，本可在第 2 轮后就查到**：

1. **WebView2/Chromium immutable 缓存跨进程持久化、只有清除才失效**——「WebView2 cache not updating / clear cache」是高频问题，Microsoft Q&A 与 WebView2Feedback 有大量现成答案（如 <https://learn.microsoft.com/en-gb/answers/questions/2288697/how-to-clear-web-view-cache>、<https://github.com/MicrosoftEdge/WebView2Feedback/discussions/3923>）。
2. **Chromium 磁盘缓存格式：URL 在 `data_*` 索引、响应体在 `f_*` 条目**——公开文档 <https://forensics.wiki/chrome_disk_cache_format/> 与源码 `net/disk_cache/disk_format.h`（<https://chromium.googlesource.com/chromium/src/+/refs/tags/122.0.6261.4/net/disk_cache/blockfile/disk_format.h>）。初版扫描只搜 f_ 文件导致「缓存里什么都没有」的误判，绕了一大圈。

**正确的快速路径（先搜再动）**：现象是「同网关、浏览器正常、桌面端旧、重启无效」→ 第 1 轮验证服务器数据（curl 各编码）→ 第 2 轮验证进程/页面状态（PrintWindow）→ **第 3 轮起就该搜索「WebView2 缓存不更新」并直接检查/清除磁盘缓存**，而不是继续猜「残留进程/版本号/指纹」。

