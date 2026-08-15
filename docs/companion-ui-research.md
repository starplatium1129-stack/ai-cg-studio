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
