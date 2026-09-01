# 莱万汀还原提示词调研 + 8 角色 42 场 SFW 竖版修复

**日期**：2026-09-01
**作者**：WorkBuddy 主会话（用户授权 19:14-style 全量修复）
**任务来源**：用户原话 "你这边调研一下莱万汀的相关提示词，想在项目里怎么写都不还原。然后再把新加的8个角色的sfw场景看一下，除了伊冯的"
**用户标准**：像壁纸一样 / 背景充实 / 人物细节丰富 / 衣服细节丰富 / 样貌衣服都要准确 / 人物姿势不能呆板

---

## 一、莱万汀调研结论

### 1.1 官方设计事实（百度百科 + 萌娘百科 + Danbooru + JannyAI 交叉验证）

| 维度 | 官方设计 | 旧项目档案（错） |
|---|---|---|
| 发长 | **齐腰长发** | "short layered crimson red hair" |
| 发色 | 红色 | ✅ red/crimson |
| 瞳色 | **紫色** | ❌ "orange eyes" |
| 角 | **黑色分段牛角（obsidian 玻璃质感）** | "segmented sharp curved black horns" ✅ |
| 服装核心 | **背露吊带上衣 + 长款红黑不对称锯齿裙** | ❌ "backless black spaghetti-strap mini dress" + "off-shoulder jacket" |
| 腿部 | **裸腿** | ✅ bare_legs |
| 鞋 | **黑色高跟短靴** | ⚠️ 同时堆 `high_heels`/`ankle_boots`/`barefoot` |
| 尾部 | 黑恶魔尾+焰光 | ✅ |
| 标志悬浮元素 | **头部周围悬浮 6-8 块暗色金属碎片**（"obsidian wings"）| ❌ 完全缺失 |
| 武器 | 熔融大剑 | ✅ magma greatsword |

### 1.2 还原失败根因（为什么"怎么写都不还原"）

并发会话 4 轮 Laevatain 修复（commits a80edfd / 1ab2960 / e76b10b / 9c02ffd）只补了表面 tag（`orange_lining` / `jagged_hem` / `official_art`），**没改底层 identityProse，也只动了 `data/popular/arknights-endfield.json` 一个文件，没动另外两个驱动角色卡生成的源**：

1. **`data/popular/arknights-endfield.json` 角色档案**：identityProse 仍写 `short hair + orange eyes + mini dress`
2. **`data/character-reference-standards.json` 角色档案**：identityProse 写"短红碎发+战术特勤服+黑短裤"（**完全不同的服装**），且与 popular 文件相互矛盾——参考图是按 standards 生成的，所有 showcase 都偏向错误版本
3. **`data/scene-blueprints.json` 莱万汀 5 张 SFW 场景**：并发 4 轮是**叠罗汉式追加**而非替换，token 累积到 64-66 个且 3 套服装互打（`black_dress`+`black_crop_top`+`sleeveless_turtleneck`+`black_shorts`）、3 种鞋互打（`high_heels`+`ankle_boots`+`barefoot`）、2 套构图互打（`full_body`+`medium_shot`），且 negative 里禁了 `shorts` 但 token 里又写了 `black_shorts`——负正词自相抵消。prose 也多处剪断（icecream_break / sword_rest 中英混杂）

### 1.3 实测出图证据

并发会话 19:52 出的 `laevatain_arknights_lava_forge attempt-1`（已 4 轮服装锁定后）仍：
- 短发 + 橙瞳 + 迷你裙 + 黑长靴
- **无悬浮碎片**
- 画成"红发女战斗员"而非"莱万汀"

### 1.4 修复执行（本会话 20:26 起）

**A. 角色档案双文件统一**（`data/popular/arknights-endfield.json` + `data/character-reference-standards.json`）：
- identityProse 改为"齐腰红发 + 紫瞳 + 黑色分段牛角 + 背露吊带长款红黑锯齿裙 + 裸腿 + 高跟短靴 + **6-8 块暗色金属碎片悬浮如黑曜石翼** + 熔融大剑"
- identityTokens 改为 `long_hair/very_long_hair/crimson_hair/wavy_hair/hair_intakes/purple_eyes/black_horns/segmented_horns/demon_horns/asymmetric_skirt/jagged_hem/crimson_lining/floating_shards/obsidian/shards/...`
- standard outfit prose 改为一致描述
- ignition outfit 同步重写

**B. 莱万汀 6 张 SFW 场景**（lava_forge / icefield_march / icecream_break / sword_rest / ship_corridor / canteen_hotpot）：
- 全量重写 prose：显式"cowboy shot from the tops of her black high-heeled ankle boots to the segmented obsidian horns crowning her head"+ DNA 完整复述 + 6-8 悬浮碎片描述 + 4-5 个背景元素
- 清理 token 集到 56 个统一项（去 `short_hair/orange_eyes/black_dress/mini_dress/off-shoulder-jacket/halterneck/black_shorts/black_crop_top/sleeveless_turtleneck/combat_boots/armored_boots/sleeveless_dress/torn_clothes/barefoot/white_pantyhose/...`）
- 4 张 NSFW 同步 token 清理

**C. 实测出图验证**（生成脚本 `generate-popular-showcase-anima11.js`，anima-aesthetic-v1.1 / 832x1216 / 30 steps / CFG 4.5）：
- `laevatain_arknights_lava_forge attempt-1` 新出图 → **齐腰红发✅ 紫瞳✅ 黑角✅ 长款红黑锯齿裙✅ 裸腿+高跟短靴✅ 熔融大剑✅**，氛围拉满
- 对比之前 4 轮修复的 attempt（short/orange eyes/mini skirt）→ **核心 DNA 五项全部命中官方**

---

## 二、7 角色 42 场 SFW 场景壁纸化修复

### 2.1 现状（修复前）

| 维度 | 数值 | 距用户标准 |
|---|---|---|
| `camera: full body` 残留 | 42/42 (100%) | 人物 60-70% 高度，不够"壁纸" |
| `recommendedSize: 1216x832` 横版 | 36/42 (86%) | 横版人物偏小 |
| 姿势动作动词 | 0-3 个/场景，多为静态 | "呆板" |
| 背景元素 | 3-12 个，多数 5-8 | 多数达标但部分偏弱 |
| DNA 准确 | 多数 OK，莱万汀严重不还原 | 莱万汀见上 |
| prose 末句雷同 | 18 种变体集中 | 红线 7 风险 |

### 2.2 修复执行

**A. 42 场全面改竖版 + 改构图**（含本会话 + 并发会话 7c89b04 + 本会话补 8 张）：
- `camera: full body` (42) → **`cowboy shot` 34 + `medium shot` 8 = 42（0 残留）**
- `recommendedSize: 1216x832` (36) → **`832x1216` 36 + Morgan 6 保留 `1152x1536` = 42（0 横版）**

**B. 42 场 prose framing 措辞统一改为 cowboy/medium**：
- 旧："framed as a full body shot from head to toe so she fills the frame"
- 新："framed in a cowboy shot from the tops of her boots to the top of her head, filling the foreground"

**C. ATMOSPHERE_TAILS 8 变体轮换**（红线 7 防雷同）：
- Jaccard 最大相似度 35.9%（红线 < 80% PASS）
- 前 3 token 签名占比 4.8%（红线 < 20% PASS）

### 2.3 3 张实测出图验证

| 场景 | 评级 | 关键证据 |
|---|---|---|
| `laevatain_arknights_lava_forge` | ✅ | 长红发+紫瞳+黑角+长锯齿裙+裸腿+矮靴+熔融大剑（详见 §1.4） |
| `eris_greyrat_training_ground` | ✅ | 832x1216 竖版 + 长红卷发+白头带+呆毛+红瞳+剑王装 + 稻草人/木剑/夕阳训练场 + 挥剑下劈动态姿势 |
| `mikasa_ackerman_training_grounds` | ✅ | 832x1216 竖版 + 黑短发+灰瞳+红围巾飘+训练兵团白制服+ODM 索具+干草垛训练场+大步前行 |
| `morgan_le_fay_fate_aesc_lake` | ✅ | 1152x1536 竖版 + 银发+白长袍+救世主 Aesc 形态+浅水+雾+远山+睡莲倒影 |

---

## 三、门禁与契约

```text
node scripts/tests/test-prompt-rewrite-integrity.js          → 2/2 PASS
node scripts/tests/test-popular-content.js                   → 25/25 PASS（含 ignition outfit 引用恢复）
node scripts/maintenance/precompress.js                     → 171 文件同步（11093.6 KB → 2649.9 KB gz → 1976.9 KB br）
node -e "require('./scripts/lib/data-version').syncDataVersion(...)"  → DATA_VERSION 同步
node scripts/workflow.js data:validate                       → 仅余 krista_lenz 参考图断链 8 处（预先存在资产迁移遗留）
```

红线 7（防雷同）实测：
- Jaccard 任意两场最大相似度 35.9% < 80% PASS
- 前 3 token 签名最高 4.8% < 20% PASS

---

## 四、修改文件清单（红线 5 精准提交范围）

| 文件 | 性质 |
|---|---|
| `data/popular/arknights-endfield.json` | 莱万汀 identityProse + identityTokens + standard/ignition outfit |
| `data/character-reference-standards.json` | 莱万汀 identityProse + identityTokens + standard outfit（与 popular 同步） |
| `data/scene-blueprints.json` | 莱万汀 6 SFW 全量重写 + 4 NSFW token 清理 + 7 角色 42 SFW 改 camera/size + 8 SFW framing/ATMOSPHERE 修复（部分被并发 commit 7c89b04 吸收）|
| `src/stores/sceneStore.ts` | DATA_VERSION 同步 |
| `runtime/tmp-fix-laevatain-sfw-2026-09-01.js` | 一次性脚本，**用完已归档**至 `scripts/archive/fix-laevatain-sfw-prompts-2026-09-01.js` |
| `runtime/tmp-fix-7char-sfw-2026-09-01.js` | 一次性脚本，**用完已归档**至 `scripts/archive/fix-7char-sfw-prompts-2026-09-01.js` |
| `runtime/tmp-fix-8-sfw-size-2026-09-01.js` | 一次性脚本，**用完已归档**至 `scripts/archive/fix-8-sfw-size-2026-09-01.js` |

**严禁卷入**（非本次修复）：
- `data/popular/{其他 22 个角色文件}.json`（参考库契约与本次任务无关）
- `data/character-reference-view.json`（莱万汀参考资产未入库，按现状保持）
- `desktop-tauri/` 任何 Tauri 资源（本次为纯数据层修复）
- `services/ ` 与 `src/views/`（本次未触及运行时逻辑）

---

## 五、并发吸收说明（红线 9）

20:38 并发会话 commit `7c89b04 fix(popular): 36场非摩根SFW批量出图+8场数据级修复` 在本会话运行 `tmp-fix-7char-sfw-2026-09-01.js` / `tmp-fix-laevatain-sfw-2026-09-01.js` 期间提交，**其工作树快照吸收了本会话对 `data/scene-blueprints.json` 的 42 场 SFW framing/ATMOSPHERE 修复**。事后 `git show HEAD:data/scene-blueprints.json` 已确认包含本会话全部修改（lava_forge prose 头部 = 本会话写的 "Inside the roaring heavy-weapon forge at Talos-II, Laevatain stands in a confident cowboy shot, framed from the tops of her black high-heeled ankle boots to the segmented obsidian horns crowning her h"），**功能等价 + 字面归属 = 本会话**（已通过 HEAD 字段比对确认）。

本会话新增 commit 仅含：
- `data/popular/arknights-endfield.json`（莱万汀角色档案，本次为新改）
- `data/character-reference-standards.json`（莱万汀 standards，本次为新改）
- `data/scene-blueprints.json`（8 张剩余 full body 修复 + 莱万汀 outfitId ignition 重设）
- `src/stores/sceneStore.ts`（DATA_VERSION）
- `docs/audit-laevatain-and-7char-sfw-2026-09-01.md`（本报告）

---

## 六、仍开放 / 后续可做

1. **莱万汀悬浮碎片仍弱**：出图里"暗色护甲"可能是碎片的弱化呈现。如需更强，加 `(floating_blade_fragments:1.3)` weight 或换 Krea 2 渲染（Krea 2 对 free-form 设计元素遵循更准）。
2. **莱万汀 4 张 NSFW 场景 prose 未重写**：本轮只清 token 防继续污染，未重写 prose（与本次 SFW 任务无关，留后续）。
3. **krista_lenz 8 张参考图断链**：8 月 31 日资产迁移遗留，需 `node scripts/maintenance/build-popular.js && node scripts/maintenance/sync-multi-outfit-standards.js` 重建。
4. **kurokawa 试镜间星瞳**仍是 Anima 1.1 模型盲点（已在审计中标注）。
