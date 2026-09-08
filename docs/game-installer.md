# 绫季绘境 · 游戏式安装界面

安装器使用生成的角色主视觉、原生中文文字、粉色主按钮和独立路径页。欢迎、安装位置、升级维护、进度、完成页面组成同一段安装旅程。

## 构建与预览

- `npm run workflow -- installer:build`：从固定的 Tauri 2.11.4 模板生成安装脚本与 BMP。
- `npm run workflow -- installer:preview --capture --page=welcome`：编译不提权、不安装的原生预览并截图。
- page 可取 welcome、directory、install、finish；截图位于 runtime/installer-对应页面-preview.png。
- `npm run package:tauri` 自动调用构建步骤；正式签名与版本递增使用 `node scripts/maintenance/release-desktop-update.js --bump patch`。
- 已构建同版本程序、仅调整安装界面时可用 `npm run workflow -- installer:bundle`，刷新安装器并重新签名；原生代码或前端有变动时仍须完整构建。

`installer/generated/` 为可再生输出，不入 Git。唯一需维护的自有 UI 文件是 game-ui.nsh，模板原件及许可证在 vendor；背景是 imagegen 生成的全年龄专用主视觉。按钮是带键盘/可访问名称的真实 Win32 按钮，位图仅负责外观。

## 安装逻辑边界

基于 [Tauri 官方自定义 NSIS 模板接口](https://v2.tauri.app/distribute/windows-installer/#installer-template)。原始安装文件清单、卸载、旧版本维护选择、WebView2 检测、管理员权限和静默参数保留。测试比较这些代码段，模板哈希或锚点漂移时构建直接失败。

自定义目录页拒绝空路径、盘符根、Windows 系统目录与通用用户/程序根目录；选择独立应用文件夹。安装包不包含生成模型。预览脚本不调用真实安装、启动或快捷方式函数。

## 私密发布

发行目标是 `starplatium1129-stack/ai-cg-studio-releases`，必须用 GitHub API 确认 isPrivate=true 后上传。源代码通过独立分支与版本标签保存，安装包、updater 签名及 SHA-256 校验文件作为 Release 附件；大型 exe 不入 Git。

源码 origin 仓库为公开仓库，本次发行不向该远端推送。完整门禁中仍存在的历史场景/Windows 清理失败在发布说明中列明，不伪称全绿。安装后的系统目录替换与 UAC 仍按 desktop-deployment.md 处理。

## 1.5.6 发行验证

- 原生欢迎、目录、安装进度、完成页预览已编译并截图检查（本机 175% DPI）。预览不会执行真实安装。
- 7 项桌面打包测试通过，其中新增安装/卸载/WebView2/维护代码段与上游一致性检查。
- 前后端类型检查、ESLint、主题/动效、内容结构和生产打包通过。
- 全量 check 仍有既有的三个场景策略步骤及 Windows 临时目录清理失败，发行说明明确保留这些限制。
- 完整应用构建与最终 NSIS 重打包、updater 签名成功；未在本机执行覆盖安装。

首个桌面个性化提交为 2309331a；完整源码和 v1.5.6 标签仅推送到私密发行仓库的 codex/desktop-game-installer 分支。
