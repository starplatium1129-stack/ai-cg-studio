# AI-CG-Studio 高质量出图修复方案（2026-08-13）

> **优先级**：P0（高质量出图是当前最大卡点）  
> **执行者**：另一个人（我仅负责方案输出，不执行任务）  
> **状态**：已细化，可直接交给他人执行

## 1. 短期任务（1-2 周）——解决批量生成质量

### 任务 1.1：提示词工程（核心）
- 强制所有场景使用 `sc300 同构极简结构`（22-26 词）
  - 角色锚点（9词，完整 exact_token）
  - 服装细节词（blazer/yellow bowtie/plaid/zettai ryouiki 等）
  - 场景实体词（严格 2-4 个，克制数量）
  - 动作/情绪（≤2 个）
  - r18 token（全场景注入，提升质感）
  - 画师词（必须 `@muririn, @kobuichi` 格式）
  - 氛围词组（backlight/rim_light/volumetric_lighting/deep_depth_of_field）
  - 质量词（masterpiece, best_quality, score_7）
- 在 `scene-fix.js` 中添加提示词结构验证（类别配额检查 + 实体词数量检查 + 画师格式检查）
- 已有 attempt 图中质量 ≥90 分的保留为定稿

### 任务 1.2：参数对齐机制
- 服务端默认参数改为 `24/3.0/res_multistep`（历史对照）
- 手工修复强制显式传 `--steps 30 --cfg 4.5`
- V20B 必须走 `nene_b` 绑定
- 在 `routes/anima.js` 和 `scene-fix.js` 中统一参数白名单

### 任务 1.3：seed 挑选机制
- 改为 **3 seed 3 张全好** 作为合格标准（不再 20 seed 挑优）
- 场景-fix.js 增加自动 3 seed 轮询 + 挑优逻辑

### 任务 1.4：热门角色/画师展示
- 短期走短提示词 + 手工 seed 挑选模式
- 增加提示词健康报告（类别配额、实体词数量、画师格式检查）

## 2. 中期任务（2-4 周）——解决训练侧根源

### 任务 2.1：训练侧重训
- 统一训练（不隔离质量先验）
- 所有样张共享同一套高质量学习信号
- R18 内容评级交给显式内容词 + safe/nsfw rating 词控制
- 验证硬门槛：safe prompt 出图必须 0 成人泄漏

### 任务 2.2：生成侧去 hack
- 日常图不再需要注入 `nene_r18`（统一训练后天然高质量）

## 3. 长期任务（1-2 月）——架构层优化

### 任务 3.1：提示词固化
- 把提示词结构固化进 `PromptBuilderView.vue`（智能补全 + 类别配额检查）
- 增加提示词健康报告（类别配额、实体词数量、画师格式检查）

### 任务 3.2：热门角色 LoRA
- 为热门角色增加专用 LoRA（或走纯 prompt 短词 + 手工 seed 模式）

## 验证方式

1. 每次修改后运行 `npm run validate`
2. 批量生成场景必须用 5 维打分（光影/背景/角色/氛围/完成度）+ 用户亲审
3. 训练侧重训后必须通过 safe prompt 泄漏测试
4. 最终效果：批量生成出图率 ≥90 分比例 >70%

---

**方案已细化完成**，可直接复制给他人执行。需要我再补充某个任务的详细步骤或相关文件列表吗？

## 2026-08-13 执行记录

本轮完成代码侧 P0，不把需要 GPU、训练数据和人工逐张审核的工作伪报为完成。

### 已落地

1. Anima 参数契约抽到 `server/anima-generation-contract.js`：
   - 服务端默认固定 `24 / 3.0 / res_multistep / simple`；
   - 手工修复预设固定 `30 / 4.5 / res_multistep / simple`；
   - API 输入白名单、steps/CFG/seed 范围与角色-LoRA绑定由路由和维护脚本共享；
   - `L_NENE_V20B_ANIMA` 强制绑定 `character=nene_b`。
2. 新增 `scripts/maintenance/quality-prompt-contract.js`：
   - 检查角色完整锚点、质量词、评级词、LoRA 质量控制词；
   - 检查场景实体 2-4 个、动作/情绪最多 2 个；
   - 检查 Anima `@artist` 格式和 `@muririn, @kobuichi`；
   - safe prompt 出现显式成人词时直接失败；
   - 提供五维人工审核模板及“三张全部 >=90 才合格”的选片规则。
3. `scene-fix.js`：
   - 固定 3 seed，不再支持 20-seed 抽奖；
   - 宁宁默认 V20B + `nene_b`；
   - 必须显式传 `--steps 30 --cfg 4.5`；
   - prompt 不满足结构门槛时拒绝生成；
   - 生成 `review.json`，只有三张五维评分全部 >=90 才写 `selection.json`。
4. 短 prompt 工具链：
   - `short-prompt-builder.js` 输出结构健康报告；
   - `short-prompt-batch.js` 固定 3 seed，并在整批生成前完成全量预检；任一场景失败则整批停止，不产生部分结果；
   - `sc300-repro-verify.js`、`manual-short-prompt-pilot.js` 从 20/5 seed 收口到 3 seed。
5. 热门角色/画师候选：
   - `generate-showcase-candidates.js` 为每条候选记录附加 `promptHealth`；
   - 保留既有 attempt prompt 和生成历史，不用新规则篡改历史记录。

### 安全决策

`nene_r18 / natsume_r18` 当前同时承载旧 LoRA 的渲染质量先验，因此短期仍可作为质量控制词进入日常图；内容评级仍由 `safe / nsfw` 与显式内容词决定。safe 场景禁止显式成人词，避免把“全场景注入 R18 token”错误实现为“全场景注入成人内容”。

### 尚未执行

- 训练侧统一重训；
- 去掉生成侧 `nene_r18 / natsume_r18` 质量 hack；
- 真实 GPU 批量生成和五维人工审核；
- “>=90 分比例 >70%”最终验收。

以上事项需要新模型产物、GPU 时间和用户逐张亲审，必须独立执行并记录真实证据。

### 2026-08-13 补充落地

- `generate-scene-showcase-candidates.js` 的 292 个单角色场景已切换到
  `short-prompt-builder.js` 的 sc300 同构短 Prompt；静态全量预检
  `292/292` 通过，且全部严格落在 `22-26 token`，候选记录保存
  `promptHealth`。
- 宁宁单角色候选改用 `L_NENE_V20B_ANIMA`。候选继续用
  `characterId=nene` 表示展示角色，提交 Anima API 时单独使用
  `generationCharacter=nene_b`，避免角色展示标识与服务端 LoRA 绑定混用。
- 夏目保持 `L_NAT_V20_ANIMA`；6 个双人场景保持既有 WAI 双 LoRA 路径，
  不尝试绕过 Anima 单角色 LoRA 限制。
- 复杂场景仅在数据已有 `animaCaption` 时追加一行导演描述，不为普通场景
  自动扩写长 Prompt。
- 定向验证通过：质量 Prompt 契约、showcase 候选契约、Prompt corpus、
  Anima 真实 HTTP 路由，共 `43/43`。本轮未运行 E2E，也未启动真实 GPU 生成。
