# 夏目 Live2D 互动叠层残留调研与修复方向（2026-08-15）

> 起因：夏目（natsume）模型互动（tap）动作后出现「立绘叠层」残留（该隐藏的叠层部件显示出来），多代开发者未根治。本次按项目「遇难先搜」铁律派 2 个子代理并行调研（①模型/motion 架构与运行时机制 ②加载链路与后端对比），全部结论经官方文档/源码/API 验证。纯调研，实施待确认。

## 一、根因（两份调研共同确认，非单点 bug）

**「互动 motion 把叠层部件/参数推高，但动作结束后没有任何机制把它写回，而接力的 idle 又没给叠层打关键帧 → 叠层永久残留」。**

1. **motion 结束语义（双后端一致）**：Cubism Native `CubismMotionManager::UpdateMotion` 结束时只 `_currentPriority = 0`；pixi-live2d-display `MotionManager.update` 结束时只 `state.complete()` + 自动 `startRandomMotion(Idle)`——**都不复位参数/部件**（源码：CubismMotionManager.cpp、pixi-live2d-display MotionManager.ts）。
2. **idle 不带叠层回 0**：官方 [Notes on Pose Switching](https://docs.live2d.com/en/cubism-sdk-tutorials/attention-changepose/) 直接描述本项目症状（「衣服双重显示/四只手」= 不想变化的部件没打关键帧）。
3. **叠层显隐是「参数驱动」**：`CubismPose.updateParameters` 每帧读配对参数（>0.001 则显示该 part）；互动 motion 把参数拉高 → 叠层显示。复位叠层 = **把驱动参数驱动回 0**。
4. **moc3 不存部件默认透明度**（运行时初始 1.0）；`SaveParameters/LoadParameters` 只存/取**参数值**，**不包含部件透明度**——全量 reset 救不了叠层（CubismModel.hpp 证据）。`ResetDrawableDynamicFlags` 只清「变化标志」，不是复位。
5. **外部全权重覆写放大问题**：blinkScheduler 以 weight=1 写 EyeBlink、情绪运行时写表情零件——若越权覆盖 tap motion 正驱动的参数（如 Param36-75/换装参数），会把作者关键帧压死（项目已禁止，历史上多次回退是复发源）。
6. **仓库事实纠错**：`wingcloud/wl-live2d` 不存在（404）；真实仓库 `wonder-light/wl-live2d`（v1.0.8），是 pixi-live2d-display 0.4.0 + pixi.js 6.5.10 的薄封装，其 tracker 无 motion/叠层类 bug——浏览器端行为完全继承 pixi-live2d-display。

## 二、可执行修复方向（按优先级）

1. **互动 motion 结束 → 播放「复位」动作**（首选，双后端各一份）：
   - 为每个互动动作组配一段「静止/复位」motion3（只把叠层相关参数清零、或按作者原始静止姿态），`motionFinish` 后播放（Native：`FinishedMotionCallback`；浏览器：wl-live2d/pixi `motionFinish` 事件）。
   - 社区公认做法参考：live2d-py issue #39（motion 结束后播 reset exp3/motion3）。
   - 备选：显式把「已知叠层驱动参数」写回 0（参数清单从作者 model3.json/cdi3 静态维护，不猜编号）。
2. **互动播放期间外部调度让位**：blinkScheduler/emotionRuntime 在 tap motion 播放期间不写该 motion 拥有的参数（读 motion3.json `Curves` 的 Target==Parameter ID 集做交集判断，浏览器端有效；Native 端本就只传意图）。
3. **防 fade-out 抢切**：同组互动动作播放中再次点击拒绝（已有「动作进行中」提示），并对连续 FORCE 抢占加 fade-out 间隔守卫，避免叠层 fade 中断在中间值。
4. **不做全量 reset**：约束复位必须「显式白名单」（部件 opacity/参数），避免把作者 motion 正在保留的正常状态一并复位。
5. **（长期/源头）**：取得夏目可编辑 Cubism 工程后，按 [Notes on Pose Switching](https://docs.live2d.com/en/cubism-sdk-tutorials/attention-changepose/) 为所有含叠层的 motion（含 idle）打部件关键帧并按 `Export target → Parts = Parts with keys` 导出——从数据层根治。

## 三、加载链路建议（子代理 B 补充）

1. 模型加载保持「零配置读 model3.json → Cubism 框架重建」，初始部件透明度即作者导出态；加载后不要手动改 Part/Drawable opacity。
2. 互动结束的「回到正常」由后端各自负责：Native 端官方样例末尾 `LoadParameters + UpdateScheduler(pose) + StartRandomMotion(Idle)`；Web 端依赖 pixi 的 idle-on-finish，但必须保证 Idle 也驱动叠层参数回 0。
3. 不要指望 `LoadParameters` 复位叠层（只复位参数值）；叠层复位靠「驱动参数回 0」或整模型重载（wl-live2d `resetModel()`）。
4. 给每段互动 motion 配 reset motion（见修复方向 1）。
5. 注意 Web 与 Native 的 `loadParameters/saveParameters` 屏障顺序不同（Web 帧尾 load，官方 Native 帧首）——实现时对齐。

## 四、主要来源

- [Notes on Pose Switching（官方，直接描述本症状）](https://docs.live2d.com/en/cubism-sdk-tutorials/attention-changepose/)
- [CubismMotionManager.cpp（Native 结束只清优先级）](https://github.com/Live2D/CubismNativeFramework/blob/develop/src/Motion/CubismMotionManager.cpp)
- [CubismModel.hpp（Save/LoadParameters 语义、_partOpacities）](https://github.com/Live2D/CubismNativeFramework/blob/develop/src/Model/CubismModel.hpp)
- [pixi-live2d-display MotionManager.ts（Web 结束只 complete + idle）](https://github.com/guansss/pixi-live2d-display/blob/master/src/cubism-common/MotionManager.ts)
- [Cubism4MotionManager.ts（stopAllMotions 再启动新 motion）](https://github.com/guansss/pixi-live2d-display/blob/master/src/cubism4/Cubism4MotionManager.ts)
- [Callback for End of Motion Playback (Native)（FinishedMotionCallback）](https://docs.live2d.com/4.2/en/cubism-sdk-manual/callback-motion-end-native/)
- [CubismParameterStore（官方保存/恢复语义）](https://docs.live2d.com/4.2/en/cubism-sdk-manual/parameterstore/)
- [wonder-light/wl-live2d（真实仓库）](https://github.com/wonder-light/wl-live2d)
- [社区：衣服换装 Cubism 3 讨论](https://community.live2d.com/discussion/comment/1471)、[Part.Opacity 语义](https://community.live2d.com/discussion/comment/2978/)

## 五、待办

- [ ] 用户确认实施范围：①互动结束复位 motion（双后端）②播放期间外部调度让位 ③fade-out 防抢切守卫
- [ ] 从夏目 model3.json/cdi3 提取「叠层驱动参数」白名单（静态常量，不猜编号）
- [ ] 实施后按 AGENTS.md 图片审核 + E2E（studio.spec.ts 互动断言）回归
