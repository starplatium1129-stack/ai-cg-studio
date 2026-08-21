# 桌面端更新机制调研（2026-08-14）

> 起因：用户询问「卸载旧版 / 以后能否增量更新」。本文只记录调研结论与建议路线，不改变现有发布门槛（见 `tauri-desktop-migration-plan.md` 的 D-10 矩阵）。自动更新此前在计划文档中标注「不在范围内」，本文给出分阶段建议，是否执行由用户拍板。
>
> 更新（2026-08-15）：Electron 版已按用户决策退役并删除（存档 tag `desktop-electron-legacy`）。下文 Electron 相关条目（二、三 B）仅作历史知识参考，不再作为可执行路线。

## 一、卸载旧版的事实核查

- 全盘核查（注册表 Uninstall 键、`C:\Program Files`、`Program Files (x86)`、`%LOCALAPPDATA%\Programs`、开始菜单快捷方式、全盘 `Uninstall*.exe`、运行进程）：**本机从未成功安装过 AI-CG-Studio**。与 `tauri-desktop-migration-plan.md` D-10 记录一致（「当前进程没有管理员权限，NSIS 为 per-machine，未执行安装」）。
- 存在 4 个 **dev 模式运行数据**残留目录（非安装版，无卸载器）：
  - `%APPDATA%\ai-cg-studio`（Electron dev 数据，含会话/草稿/token 迁移源）
  - `%APPDATA%\com.aics.studio`（Tauri dev 数据）
  - `%LOCALAPPDATA%\com.aics.studio`、`%LOCALAPPDATA%\com.aics.poc`
- 清理建议：**默认保留**。里面含 `gateway_token` 迁移源、聊天会话（IndexedDB）、窗口状态；删了会丢这些本地数据（token 会重新生成，聊天历史不可恢复）。只有用户确认要「全新干净状态」时才删。

## 二、现状：两侧都没有更新基础设施

- Tauri 2：`desktop-tauri/src-tauri/Cargo.toml` 无 `tauri-plugin-updater`；`tauri.conf.json` 无 `plugins.updater` 配置。
- Electron（已退役，2026-08-15 删除）：历史 electron-builder `build` 无 `publish` 配置，无 electron-updater。
- 当前唯一更新方式：重新打包 + 重装（`npm run package:tauri`），且受 D-10 门槛约束（打包输入变化后旧 SHA 证据作废，需新的真机安装验收）。

## 三、三个可选路线

### A. Tauri 官方整包自动更新（近期可做，非增量）

- 机制：`tauri-plugin-updater` + minisign 签名 + 静态 JSON manifest（`latest.json`）；JS 侧 `check()` → `downloadAndInstall()`；Windows 下静默拉起 NSIS 安装器（per-machine 会弹 UAC）。
- 流程（官方标准）：`tauri signer generate` 生成密钥 → 构建 `--bundles nsis` → `tauri signer sign` 产出 `.sig` → 发布 `latest.json`（含 version/notes/pub_date/platforms.windows-x86_64.signature+url）。
- 代价：**每次全量下载安装包**。本项目打包资源约 116.5 MB（live2d 贴图 + node_modules 是主体），整包估计 150-200 MB 级。
- 参考：[Tauri Updater 官方文档](https://tauri.app/plugin/updater/)、[tauri-plugin-updater GitHub](https://github.com/tauri-apps/tauri-plugin-updater)、真实接入实例 [onyx PR #9002（updater + 签名）](https://github.com/onyx-dot-app/onyx/pull/9002)。

### B. Electron 回退路径真差分（已随 Electron 退役，仅知识参考）

- electron-updater 对 NSIS target 支持 blockmap 差分下载，是**真正的增量更新**（只拉变更块）。
- 参考：[electron-builder Differential Downloads](https://deepwiki.com/electron-userland/electron-builder/6.4-differential-downloads)、[blockmap 机制讨论](https://stackoverflow.com/questions/59106765/how-is-an-electron-builder-nsis-block-map-generated-can-it-be-controlled)。
- 缺点：Electron 在本项目是回退/稳定路径，双轨维护成本高；且 NSIS 差分有性能争议（[electron-builder #6265](https://github.com/electron-userland/electron-builder/issues/6265)）。不推荐作为主路线，仅在「Electron 重新成为主路径」时启用。

### C. 内容级增量更新（最贴合本项目，需小架构改动，P1 候选）

- 思路：把「稳定部分」与「易变部分」拆开——
  - 稳定：Rust 壳、live2d 模型/贴图、node_modules、tools（很少变，一次性随安装包）。
  - 易变：`dist/`（gzip 后约 1.8 MB）、`routes/`、`server/`、`services/*.js`、`data/`、`scripts/runtime/`（合计约 10-40 MB）。
- 机制：独立「内容更新通道」——manifest（版本 + SHA-256）+ 内容包 zip，下载后校验 + 原子替换（可复用 `desktop-stage-resources.js` 的原子发布思路）。更新检查入口可放在桌面壳或网关新增只读路由。
- 前提与风险（实现前必须评估）：
  1. 写入目标：per-machine 安装目录在 Program Files，替换需提权（每次更新 UAC）；或改为 per-user 安装 / 把易变内容目录放到用户可写区——后者改变「安装目录代码只读」的安全模型，`server/security.js` 的 containment 校验与 desktop-tools 路径判断需同步复核。
  2. 打包模式下维护脚本链返回 501（`DESKTOP_MAINTENANCE_UNAVAILABLE`），内容替换不能依赖维护脚本，需壳或网关自实现。
  3. 失败回滚：原子替换 + 备份回退（沿用暂存发布的备份-发布模式）。
- 真二进制 diff：Tauri 官方不支持，[tauri#11863 binary diff updater](https://github.com/tauri-apps/tauri/issues/11863) 仍是 open feature request；自研 diff 工具对个人项目成本过高，不推荐。

## 四、托管与鉴权（本地个人使用场景）

- 更新源需要静态 HTTP(S) 托管 `latest.json` + 安装包/内容包。可选：
  - 本机/LAN 静态服务（最贴合本地使用；需保证更新源可达性，App 无法自更新自己）。
  - GitHub Releases / 对象存储私有链接（注意：公开托管会把安装包暴露到公网，本项目含 R18 内容面，公开托管需谨慎；私有链接需确认 updater 的自定义 header/带 token URL 支持，实现时验证）。
- manifest 签名用 minisign 私钥；私钥必须安全保存（丢失后无法再发更新）。

## 五、建议路线

1. **P0（近期）**：接入 Tauri 官方 updater（路线 A），更新源先放本机/LAN 静态目录；实现「启动检查 + 手动检查按钮 + 一键下载安装」。全量下载体量可接受则到此为止。**必须等 D-10 安装产品验收通过后真机验证**；打包输入变化时按门槛重新冻结 SHA 证据。
2. **P1（若全量体量不可接受）**：做路线 C 内容级增量（zip + SHA-256 + 原子替换），先解决写入权限与安全模型复核，再实现。
3. **不做**：自研二进制 diff（成本/收益不成比例，等 upstream #11863）；Electron 已退役，路线 B 仅作知识参考。

## 六、待办

- [ ] 用户拍板 P0 是否启动（含「自动更新」从计划文档的「不在范围内」移除/改期）。
- [ ] P0 实现：`tauri-plugin-updater` + 签名密钥生成 + 本机 manifest 目录 + 壳内检查入口。
- [ ] D-10 环境满足后真机验收（含 UAC 提权、更新中断恢复、签名校验失败路径）。
