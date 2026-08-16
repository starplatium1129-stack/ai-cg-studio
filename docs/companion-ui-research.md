# Companion 桌宠界面布局调研（2026-08-15）

> 起因：用户反馈 Companion 窗口（540×760 透明桌宠）布局拥挤不合理。实测截图经 `image-inspect`（gemini-3.7-flash-high）识别：**标准模式底部 5 层堆叠（临时气泡+主对话+语音警告条+输入栏+状态底栏）占窗口高度约 45%，Live2D 立绘下半身被完全遮挡；顶部通栏 8 个按钮+开关拥挤；信息层级混乱（多高对比色块）；「有件事想告诉你」胶囊遮挡角色脖颈；底部状态文字与输入框层叠穿透（bug）**。沉浸模式（只留对话+输入 2 层，立绘 85% 可见）实测明显更优——方向已验证。
>
> 本文件汇总 3 个并行调研子代理的结论（含来源），是后续改造的依据；不在此重复截图与代码细节。

## 一、三份调研的共同结论（高置信，方向一致）

1. **主窗只留「角色 + 轻量状态」**：优秀桌宠（Sakura、daidai-live2d-pet、Live2DViewerEX、Shimeji、Bongo Cat、xiaobei-pet、moepet、mea-pet、NotiSprite、claude-code-but-priestess）几乎都不把功能按钮常驻窗口内；设置/状态走「独立设置窗 / 托盘菜单 / 右键菜单 / 右上角小齿轮弹层 / 长按角色呼出」。
2. **底部收敛为单一毛玻璃面板**：对话+输入合成一个面板（`rgba(15~25,15~25,30,0.55~0.75)` + `backdrop-filter: blur(12~24px)` + `1px rgba(255,255,255,0.08~0.14)` 描边 + 圆角 12~20px），根治「卡片贴卡片」与层叠穿透。
3. **立绘上半身安全区**：角色头部/胸口以上（约窗口上 55%）禁止任何常驻面板；短台词走「嘴旁/头顶浮动短气泡」（1~2 行、自动消失、随角色），长对话下沉到腰部以下。
4. **状态沉入角色/输入栏，不做高对比条**：语音未就绪 → 输入栏左侧灰麦克风 + 一次 2s toast；API/FPS/音量/网络 → 极细状态点（hover 显示）或齿轮页「诊断」分区；勿扰/安静时段 → 极小月亮图标状态点（且提示本身静默）。
5. **单焦点**：同一时间只突出一个区块——聊天时只显会话条；静默/勿扰/待机时收起为右下角小状态点。
6. **输入栏**：常驻底栏是主流（不做点击展开）；语音/文字同一输入位切换；长按说话（hold-to-talk）是陪伴类语音主流——与已规划的 companion-voice-roadmap P0 长按说话一致。
7. **空闲自动还原**：hover 隐 UI / 空闲 10~20s 自动收起辅助元素（胶囊、状态条），保证立绘展示优先。

## 二、主要参考来源

- 桌宠布局/多窗口分离：[Rvosy/Sakura](https://github.com/Rvosy/sakura)、[daidai-live2d-pet](https://github.com/Rosa134/daidai-live2d-pet)、[xiaobei-pet](https://github.com/Prince-cjml/xiaobei-pet-release)、[moepet](https://github.com/zhuge-Tom/moepet)、[mea-pet](https://github.com/suan-11/mea-pet-public)、[MaiBot Deskpet](https://raw.githubusercontent.com/Maboroshinatsu/maibot-deskpet-plugin/main/README.md)、[AnySoul 桌宠文档](https://docs.anysoul.ai/guides/desktop-pet/)、[claude-code-but-priestess](https://raw.githubusercontent.com/SVAH-X/claude-code-but-priestess/master/README.md)、[NotiSprite](https://apps.apple.com/cn/app/notisprite-%E6%B2%BB%E6%84%88%E7%B3%BB%E6%99%BA%E8%83%BD%E6%A1%8C%E9%9D%A2%E4%BC%B4%E4%BE%A3/id6752292657)
- 对话/陪伴 UI：[Character.AI](https://greasyfork.org/en/scripts/588959-character-ai-widescreen-chat)、[Replika 设计分析](https://uxdesign.cc/what-replika-gets-right-wrong-and-fiercely-profitable-54ee0aabb639)、[Talkie 流程](https://pageflows.com/post/android/chatting/talkie/)、[Input Mode Toggle](https://www.aiuxplayground.com/pattern/input-mode-toggle/)、[hold-to-speak](https://github.com/aj47/SpeakMCP/issues/1019)
- 通知/反馈分级：[feedback-patterns](https://github.com/sethdford/claude-skills/blob/main/designer/interaction-design/skills/feedback-patterns/SKILL.md)、[notification-hierarchy](https://github.com/oborchers/fractional-cto/blob/main/saas-design-principles/skills/notification-hierarchy/SKILL.md)

## 三、对本项目 CompanionView 的改造方向（待用户确认后执行）

现状：`src/views/CompanionView.vue`（1104 行）+ `src/assets/css/companion.css`（1600+ 行）；conversation 区最多可同时出现 8 个块（reminders/clipboard/bubbles/setup/tool-indicator/composer/status/error）。

1. **顶栏**：8 按钮通栏 → 右上角 1 个齿轮（弹层收纳全部功能：角色切换、实时配音、勿扰、导图、窗口控制、完整房间、沉浸）或 hover 才浮现的一行图标。
2. **底部单面板**：`companion-composer`（输入/发送/语音）与 `companion-status` 合并为单一毛玻璃面板；FPS/API 名/音量滑杆移入齿轮弹层「诊断」分区（保留功能，不删除配音/队列等既有能力）。
3. **临时提示收敛**：reminders（主动问候）→ 嘴旁/头顶短气泡或对话流首条；语音未就绪警告条 → 输入栏灰麦克风 + 2s toast；tool/thinking indicator → 输入栏内状态点；error → toast。
4. **安全区**：立绘上 55% 禁常驻面板；「有件事想告诉你」胶囊移出脖颈区（或改为淡入淡出短气泡）。
5. **修复**：底部状态文字与输入框层叠穿透（结构上状态并入输入面板同一行）。
6. **约束遵守**：配音/翻译/语音生命周期、行为配置（dnd/安静时段）、沉浸模式开关保留；`companionBehavior.ts` 确定性台词与安静时段语义不变。

## 四、落地范围预估

- 主要改动：`CompanionView.vue` 模板/脚本（顶栏折叠、面板合并、提示收敛）+ `companion.css`（毛玻璃单面板、安全区、状态点）。
- 涉及现有 E2E：`studio.spec.ts`（companion 相关断言）、`interaction-polish.spec.ts` 等需回归。
- 不动：Live2D 舞台与 ChatCharacterStage、useVoice/useChatStorage 生命周期、行为引擎。

> 待办：[ ] 用户确认改造方向与范围；[ ] 分步实施（先结构后样式）；[ ] 截图回归对比（标准/沉浸/desktop 三态）。

## 五、2026-08-16 落地记录（照片反馈修复，已完成）

> 背景：用户提供两张桌宠窗口照片（540×760 桌面模式）。`image-inspect` 复核结论：
> ① 底部对话区（气泡+语音未就绪提示条+输入栏）盖住角色膝盖以下；
> ② 顶部「安静陪着你」状态胶囊、角色切换标签、Live2D 状态按钮压角色头/肩；
> ③ 夏目背后的"黄色块"= 夏目主题色 `#f2bb68` 渲染的舞台背景光晕
>    （`portrait-stage::before` / `companion-ambience::before` / `companion-page::before` / `companion-stage::after` 多层的 accent 径向渐变）。

已实施（仅改 `src/views/CompanionView.vue` + `src/assets/css/companion.css`，未动共享组件/Rust）：

1. **桌面模式改 flex 纵向三段**：顶栏 / 立绘（flex:1，自适应缩放）/ 对话面板（静态块排在立绘下方）——UI 与角色零重叠，头到脚始终完整可见；气泡多时立绘缩小而非被遮。
2. **舞台悬浮件收敛**：角色切换移入顶栏分段控件（`.companion-char-switch`，仅桌面模式渲染）；状态胶囊与立绘状态按钮桌面模式 `display:none`（状态已并入输入面板状态行）。
3. **语音未就绪提示条**收进输入面板内单行（`grid-column: 1 / -1`），不再占对话区整行。
4. **空闲自动隐藏升级**：顶栏+对话面板 `display:none` 真正收起，立绘放大到整窗（角色为主）。
5. **背景光晕去主题色**：桌面模式全部改中性暗色（`art-scrim`/黑），夏目黄色块消失。
6. 互动提示（`.live2d-interaction-hint`）贴对话面板上沿，idle 时随 UI 隐藏。

验证：`npm run typecheck:app` + `npm run build`（budget 通过）；E2E `studio.spec.ts` desktop companion + companion speech ×2 全过；540×760 桌面模式应用内截图（`.review-shots/companion-*.png`）经视觉模型复核——宁宁/夏目均头到脚完整可见、无黄色块、idle 模式角色明显放大。已通过 `deploy-desktop-quick.ps1` 部署到安装目录（应用已重启）。

遗留观察：`Copy-Item` 从不清理安装目录 `dist/_app` 的旧 hash chunk（实测累积 21 个 CompanionView 版本），只增无害，后续可让部署脚本先清 `_app` 目录。

## 六、2026-08-16 二轮修复：桌面壁纸透出"黄色块"（已完成）

> 现象：一轮部署后用户再次反馈"还有黄色块"；新截图（022000）经 `image-inspect` 复核——
> **应用内已无黄色**，黄色来源是透明窗口把桌面壁纸（右侧金色长发动漫插画）透出来；
> 顶部/底部 UI 已隐藏时（空闲态）角色 100% 完整可见（一轮遮挡修复生效）。

根因（两个叠加因素）：
1. 桌宠窗口 540×760 透明大区把壁纸/图标/终端全部透进角色身后，亮色壁纸区域被误认作"Live2D 背景黄色块"；
2. **presence「quiet」态会把 `.portrait-stage::before` 光晕 opacity 压到 0.48**（`.companion-page[data-presence="quiet"] .portrait-stage::before`，特异性 (0,3,1) 压过桌面通用规则）——光晕变半透明后壁纸金色重新透出，正是"安静陪着你"（默认空闲态）下黄色复现的直接原因。

修复（`src/assets/css/companion.css`，桌面模式）：
- `.portrait-stage::before` 改为**覆盖整个角色区的深色舞台卡**（`inset: 6px 4px 4px`、圆角 26-30px、径向 0.96→0.62→0.18 暗、`blur(6px)`），中心压成深炭黑，壁纸金色/图标/终端全部压入暗色氛围；
- **显式覆盖存在态透明度**：`html.companion-desktop .companion-page[data-presence="quiet"] ... { opacity: .92 }`（特异性 (0,3,2) 反压 quiet 的 0.48），speaking=1 / attentive·listening=.97 / thinking=.95 / available=.92，舞台在任何 presence 下都保持高不透明度；
- 验证（540×760 + 模拟金色壁纸 + 视觉模型复核）：主体金色压灭（深炭黑/深灰），角色轮廓锐利突出；边缘留柔和暗金氛围光晕（有意的 vignette）。

备注：浏览器后端（wl-live2d）模拟截图在"舞台尺寸变化（UI 收起）"后偶见画布残影/双脸——原生 overlay（打包版）rect 变化时整帧重绘无此问题；用户实际运行走原生路径不受影响。如 dev 模式（浏览器后端）也复现再独立排查。

## 七、2026-08-16 三轮迭代修正：深色舞台过黑 → 透明窗口+角色背光（已完成）

> 二轮"深色舞台卡"被用户否决：窗口变成黑色矩形贴片、角色淹没。用户要求"自己截图看真实效果"。

执行方式修正：**改为截取真实桌宠窗口的屏幕合成区域**（`GetWindowRect` + `BitBlt` 屏 DC，等价用户所见，含透出壁纸；不用 PrintWindow——它不含桌面透出）。并用像素矩阵（System.Drawing 降采样 RGB 表）逐格核对，不再只信视觉模型的文字描述。

迭代结果：
1. **三轮**：深色舞台换成"整窗透明 + 角色身后冷白径向背光（0.30→0.12→透明、blur 20px）"；真实截图复核：角色锐利清晰、无黄色，但视觉模型仍报告"下半身矩形半透明框"。
2. **根因排查**：a) 枚举窗口发现原生 overlay（`aics_live2d_overlay`，rect=舞台区）存在且清屏色 `wgpu::Color::TRANSPARENT`——overlay 本身无框；b) 关键：**presence 态给 `.live2d-host` 的 `drop-shadow` 用 accent 色（夏目 #f2bb68）**——角色下半身一圈黄色光晕，疑似用户一直说的"黄色块"真身；
3. **三点五轮（最终）**：① 桌面模式 `page::before/::after/ambience` 全部 `display:none`（整窗真正透明，无暗角/蒙版带）；② 背光改纯径向（225,231,255 冷白），Alpha 在元素边缘前归零无矩形；③ **`.live2d-host`/`.portrait-main` 的 accent drop-shadow 改中性深影 `rgba(5,3,10,0.4)`**，黄色光晕彻底移除。
4. **真实验证（02:35 部署后截图）**：像素矩阵 = 顶部壁纸蓝天（无工具栏块）、角色中部亮色清晰竖带、底部为壁纸自身内容、无黄色、无黑色贴片；视觉模型复核确认黄色块与暗板均消失。

结论：桌宠当前形态 = 透明窗口（壁纸可见）+ 角色居中清晰 + 无任何黄色/黑色伪影。chat 面板仅在交互时出现于立绘下方（flex 布局不遮角色）。遗留微调项（待用户反馈再动）：对话面板玻璃感可更轻；如用户嫌壁纸太花可再议局部压暗。
