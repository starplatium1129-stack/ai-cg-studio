# 桌面个性化审计与优化（2026-09-08）

基线：`codex/atelier-director-refinement` / `4de0e200`。本轮代码、测试和候选安装包独立于此前 main 分支的暂存补丁。

## 已修复与新增

| Before | After | Why |
| --- | --- | --- |
| 偏好写盘为 camelCase，Rust 读取默认 snake_case | 统一 camelCase，兼容旧 snake_case | 置顶、穿透、Live2D 偏好可保存后恢复 |
| 鼠标穿透状态初始化为 false，建窗未恢复 | 从已保存偏好初始化，并对原生窗口设置；失败记录日志且状态返回 false | 内存状态与真实窗口保持一致 |
| 标题栏固定深紫色与较暗文字 | 使用全局背景、文字、强调色与危险色令牌 | 深浅主题风格一致，标题与窗口按钮可读 |
| 初始窗口查询结束后才订阅事件 | 先订阅，拒绝迟到查询覆盖新事件；卸载释放订阅 | 修复最大化状态竞争和卸载时的事件泄漏 |
| 启动工作台固定回首页 | 控制面板可选首页、绘图、作品册、视频或上次工作页 | 默认保持首页，按个人工作习惯减少导航 |
| ControlView 已超过单体预算 | 将控制室介绍提取为 ControlIntro | 新能力不继续增加存量 View 的体积债 |

## 使用与边界

桌面版进入控制面板，在“我的桌面工作台”中选择“打开工作台时”的页面。设置仅作用于桌面工作台，普通浏览器不自动跳转。

“上次工作页”仅记录上述工作页面的路径，不保存 URL 查询参数、临时授权信息或生成参数。带查询参数/锚点的首页、明确的作品/场景深链仍优先处理。桌宠和独立聊天窗口不参与启动页恢复。两个新存储键已纳入备份恢复白名单。

本轮没有改写场景、提示词、角色服装或生成参数。没有把 mock 桥接测试作为真实安装版验收。

## 本轮验证

- Rust 桌面程序 24 项单元测试通过，包括偏好写盘→读取、覆盖旧值和旧格式兼容。
- 当前源构建的 release 原生 Live2D 自检通过：`OK snapshots=3/3 exit=0`（`runtime/desktop-personalization-live2d.log`）；这不替代安装版重启与托盘交互验收。
- 新增前端 6 项测试通过：启动恢复、深链优先、只记路径、拒绝任意目标、卸载清理和窗口事件竞争。
- 桌面桥接模拟浏览器回归 3 项通过：深浅主题、启动偏好持久化、上次工作页、普通浏览器不跳转。截图已人工查看；未发现新卡片或标题栏文字遮挡。
- 类型检查、ESLint、单体预算、颜色/样式字面量、对比度和动效门禁通过；生产构建通过。
- 全量门禁的 Node 单元 398 项及接口契约 25 文件通过。全量结果仍为 FAIL：历史场景 optimize/ratings/validate 与 Windows repo-hygiene-contract 临时目录 ENOTEMPTY 仍阻断；未降低门禁或扩大豁免。

本机证据在 runtime：`desktop-personalization-gates.log`、`desktop-personalization-native-unit.log`、`desktop-personalization-e2e.log`、`desktop-personalization-package.log`。浏览器截图在 test-results 对应目录；这些产物不入 Git。

## 安装与交付限制

原生程序有修改，必须完整安装，不能只复制前端 dist。候选 NSIS 安装包由现成 `npm run package:tauri` 构建，沿用当前 1.5.5 版本；它不是新的自动更新发布，未刷新 latest.json，也未替换已安装软件。

候选包：`desktop-tauri/src-tauri/target/release/bundle/nsis/AI-CG-Studio_1.5.5_x64-setup.exe`，2026-09-08 10:26:15 构建完成，297468663 字节；SHA-256 为 `B5C01986ECDDAAA52412F92830C86BD0130640656CCBF1DA5AE7C9D88E51C20E`。这是未做 updater 签名的手动安装候选，不使用旧版本目录中的同名安装包或签名。

系统安装入口仍为 deploy-desktop.bat；安装前须确认 runtime/desktop-updates 中选择的是本次候选包，不能误用旧 1.5.5 包。当前会话没有管理员权限，UAC 与安装向导需要用户操作。完整质量门禁尚未通过，未 commit/push。

后续优先修复独立的验收基础设施和逐条内容校验问题，再进行安装版重启、托盘置顶/穿透、Live2D 开关及窗口位置的真实桌面验收。
