# 夏目 Live2D 接入交接说明

> 更新日期：2026-08-02。只记录已经验证的事实，不把候选图层当成已完成衣装。

## 当前状态

- 夏目模型已接入角色房间，支持按需加载、原生动作、互动、口型、鼠标视线和 SoulLink 情绪微动。
- 已稳定验证的衣装只有 `natsume-cafe`（咖啡店制服）。衣橱暂时只公开这一项。
- 原始工坊 LPK 的元数据只登记了 1 个正式 `costume`，但 moc3 内含多组默认隐藏 Drawable。它们可能是动作零件、表情层或衣装候选，不能仅凭 Part 编号命名。
- 源 LPK：`E:\code\live2d\3295121105\3295121105.lpk`，配置：同目录 `config.json`。
- 已用公开 `spawner1145/lpk-unpacker` 和原始 `fileId`/`metaData` 完整复核；解密结果与 `assets/live2d/natsume/` 的 moc3、物理和 41 个动作一致。

## 已验证机制

- 口型参数为 `ParamMouthForm3`（`-0.5..0`），不是 manifest 中误写的 `ParamMouthOpenY`。
- 鼠标在舞台内时由精确 pointer gaze 独占眼球参数；离开后才恢复 SoulLink 自主视线。
- 语音的真实 RMS/peak 已传入 SoulLink `AudioLevelAnalyzer`，逐句情绪继续由 `useVoice.onExpression` 驱动。
- 夏目 SoulLink profile 只驱动安全的头、身、视线、眉毛与 `ParamCheek`，不碰眨眼、口型和衣装选择参数。
- 原始 41 个 motion 中共有 750 条 PartOpacity 曲线，所有值都恒为 `1`；曲线存在性不能用来推断衣装开关。
- `Param52-61`、`Param65`、`Param67-75` 能控制隐藏 Drawable，但单独打开或按连续 Part 分组会出现重复制服、白色遮罩、鞋腿串层等问题。

## 已否决方案

- 不再把 `Part2-6`、`Part7-11`、`Part12-16`、`Part17-21`、`Part22-28` 直接命名成多套服装。
- 不再每帧把未选 Part 或整组 Drawable 强制归零；这会覆盖模型原生 motion 并制造无脸、白块和错误叠层。
- `Part28` 是命中区域几何，不是衣装。
- `natsume-cafe-variant` 与咖啡店制服完全重复；“日常私服”“层叠礼服”候选视觉验收仍显示咖啡店制服；“红旗袍”候选严重破损，均未公开。

## SoulLink 融合边界

- 当前项目已有成熟的聊天流、TTS 队列、超时/重试和音频生命周期，不应为了形式上的“完整 SDK”替换这些宿主能力。
- 按 SoulLink 官方文档，已有消息循环和 TTS 的项目使用 `@soullink-emotion/engine` 是正确方案。
- 后续应补齐的是模型 Profile 校准、原生 animation adapter 和可重复的截图审核，而不是盲目引入 `runtime-core` 或第二套 PIXI renderer。
- `@soullink-emotion/live2d-pixi` 基于 PIXI v7；当前 `wl-live2d` 自带渲染依赖，直接并存会重复 PIXI/Cubism 运行时，除非决定整体替换渲染层。

## 后续衣装工作

1. 建立隔离校准页，暂停 idle、物理、情绪和语音，仅加载 moc3。
2. 对隐藏 Drawable 做精确白名单组合，而不是按父 Part 全开。
3. 每个候选至少验证：稳定 1 秒、两轮 idle、互动动作、页面重载、脸/肢体/鞋子/遮罩无串层。
4. 逐张视觉审核通过后，才加入 `NATSUME_OUTFITS`、存储白名单和 E2E。

## 相关文件

- `src/composables/useLive2D.ts`：渲染适配、视线、口型、互动和当前单衣装状态。
- `src/utils/emotionRuntime.ts`：宁宁/夏目 SoulLink profile、VAD/FACS 和真实音量输入。
- `src/components/ChatCharacterStage.vue`：角色舞台和衣橱。
- `src/config/characters.ts`：已验证衣装登记。
- `src/composables/useVoice.ts`：逐句情绪、RMS/peak 和音频生命周期。
- `scripts/tests/test-emotion-runtime.js`：SoulLink 安全参数测试。

## 验证

- `npm run typecheck:app`
- `npm run build`
- `node scripts/tests/test-emotion-runtime.js`
- `node scripts/tests/test-chat-storage.js`
- 定向 Playwright：`tests/e2e/studio.spec.ts` 的夏目角色房间用例
