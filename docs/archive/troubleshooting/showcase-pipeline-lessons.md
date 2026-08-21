# 样张流水线疑难解决记录（2026-08-15）

> 目的：本次热门角色样张流水线（生成 → 审核 → 发布）踩过的坑与最终解决方案。
> 后续会话/协作者遇到相似现象，先查本文件，禁止重复试错。
> 每条格式：现象 → 根因 → 修复 → 验证。

## 1. 服装提示词被中文污染（45 个衍生服装）

- **现象**：00022（陈·夜市）画成战术背心+太刀；多个衍生服装图服装乱画。
- **根因**：调研产出的衍生便服 prose 是「中文设计说明 + 括号英文短语」混合入库，Anima 英文模型把中文当噪声；tokens 大量残渣（`sweater), green, wide-leg`）。
- **修复**：`scripts/maintenance/fix-outfit-prose-en.js` 重写 45 个 outfit 为纯英文 prose + 干净 tokens。
- **验证**：CJK/残渣正则复查清零；`test-popular-content.js` 18/18。
- **规则沉淀**：AGENTS.md「prompt 语言约束」。

## 2. 审核脚本把「不通过」判成通过（parseVerdict）

- **现象**：dorm_night 结论行「结论：不通过」仍判 pass。
- **根因**：`concl.includes('通过')` 匹配了「**不**通过」子串。
- **修复**：先判 `/不通过/` 再判 `/通过/`（audit-showcase-rella.js parseVerdict）。
- **验证**：重跑 attempt-5 审核，dorm_night 正确 fail。
- **规则沉淀**：AGENTS.md「审核判定必须防漏判」。

## 3. 分身/双人图被漏判（vision 结论通过但详情描述分身）

- **现象**：4 张图 vision 详情明确「严重的分身/双人错误」但仍 pass 并发布进 v23。
- **根因**：parseVerdict 只看结论行与身份行，不扫详情。
- **修复**：正则扫详情（分身/双人/复制/分镜/拼贴，上下文无「无/非/仅」否定 → 强制 fail）。
- **验证**：重审 attempt-3/4/5 相关图全部正确 fail。
- **规则沉淀**：AGENTS.md「审核判定必须防漏判」+「单人场景人物数量专项核查」。

## 4. 场景级负面词从未生效（negativeTokens 静默丢失）★最深

- **现象**：quillpen 场景定制 negative（inset image 等）在 prompt 里不存在；`bp negativeTokens: []`。
- **根因**：`scene-blueprints.json` 的 negativeTokens 是**逗号分隔字符串**，而 `parseSceneBlueprints` 用 `stringList`（只接受数组，字符串返回 `[]`）——**336 个场景的场景级负面全部静默丢失**。
- **修复**：`popularContent.ts` 新增 `negativeStringList`（兼容字符串/数组）；生成脚本对 anima 另把 blueprint negativeTokens 原样追加（profile `negative_mode=replace` 会过滤样板词）。
- **验证**：attempt-12 起 negative 含 inset image/2girls/clone；测试通过。
- **规则沉淀**：AGENTS.md「数据格式一致性」。

## 5. 单人压制提示词权重不足（R18 双人/分身高发）

- **现象**：R18 场景频繁出分身/双人/上下分镜。
- **根因**：旧 soloGuard `(single girl only:1.4)` 对 R18 场景压制不足；负面缺 duplicate/1boy/2boys 等。
- **修复**：R18 场景 soloGuard 升级 `(solo:1.5), (1girl:1.4), (single girl only:1.6), (no second person:1.3), no bystanders`；panelSuppress 补 `duplicate/extra person/1boy/2boys/crowd`（不加 mirror/reflection，保护浴室镜场景）。
- **验证**：bath_halo/moon_roof 等连败场景 attempt-6 起通过。
- **规则沉淀**：生成脚本注释。

## 6. 顽固场景（同一场景连续 5+ 次分身）

- **现象**：`kaltsit_arknights_r18_cabin_robe` 6 连败（换 seed/强化负面/简化场景均无效）。
- **根因**：该「角色+构图+服装」组合对 Anima 模型固有倾向（睡袍+床边+裸体触发双人构图）。
- **修复**：不无限重试——按用户指示**重设计场景**（换礼服 evening_gown + 侧身露胸 + 意境构图）一次通过；后续又按用户反馈加背部视角（attempt-15 通过）。
- **验证**：attempt-14/15 pass 并发布。
- **规则沉淀**：AGENTS.md「顽固场景止损」——但注意：**场景重设计（换服装/换构图）是止损后的首选出路**，比无限换 seed 有效。

## 7. 发布时旧角色样张被静默删除

- **现象**：publish dry-run 发现 v22 的 18 个旧角色 popular 样张会丢失。
- **根因**：`publish-popular-showcase.js` 会删除源目录全部旧 pc_* 重建，只认 `--from` manifest。
- **修复**：`runtime/merge-publish-data.js` 合并 v18 旧角色 + 新角色 manifest（按 key 取最新 attempt）→ merged manifest 发布。
- **验证**：dry-run 角色数 33、popular 335。
- **规则沉淀**：AGENTS.md「发布前检查角色覆盖」。

## 8. 发布时旧批次图片缺失

- **现象**：publish 报 `missing source image`（v18 角色的图）。
- **根因**：合并 manifest 里旧角色记录指向新目录相对路径，但图文件在 v18 目录。
- **修复**：`runtime/copy-v18-images.js` 把 v18 pass 记录的图复制到新目录。
- **验证**：335 张 pass 图全部就位后 publish 成功。
- **规则沉淀**：合并发布时先检查图文件就位。

## 9. 批量审核串行太慢

- **现象**：335 张人物数核查串行约 2 小时。
- **根因**：spawnSync 逐张等结果。
- **修复**：并发池（6 路异步 spawn + 断点续跑 + 每 10 张落盘）`runtime/person-count-audit.js`，约 15 分钟完成。
- **验证**：完成 335 张，断点续跑无重复。
- **规则沉淀**：AGENTS.md「批量审核与批量出图必须并行执行」。

## 10. 室内化只改 promptProse 漏改 nsfwProse

- **现象**：天台夜风等 4 个 R18 场景室内化后，prompt 仍含 rooftop/railing。
- **根因**：成人场景的 `nsfwProse`（裸体叙述前置）与 promptProse 是两处独立描述，只改后者。
- **修复**：4 个场景 nsfwProse 同步改室内。
- **验证**：预检脚本（`runtime/precheck-regen-keys.js`）室外词残留清零。
- **规则沉淀**：AGENTS.md「场景-服装一致性」四处同步。

## 11. 史尔特尔/莱万汀战斗服被误改（凭记忆改数据）

- **现象**：把史尔特尔改成「红披风」、莱万汀改成「黑红火焰」——都与官方设定不符。
- **根因**：没对照调研权威源（`AI/Research/character-arknights/*.json`），凭印象改。
- **修复**：对照调研 JSON 恢复官方配色（史尔特尔黑白拼色夹克红内衬、莱万汀深灰白黄警示条），并全量核对 12 个角色 standard。
- **验证**：48 张 standard 场景重出。
- **规则沉淀**：AGENTS.md「改数据先对照权威源」。

## 附：可复用工具清单（runtime/）

| 工具 | 用途 |
|---|---|
| `precheck-regen-keys.js` | 重出前预检 prompt（CJK/残渣/矛盾/室外词） |
| `person-count-audit.js` | 单人场景画面人物数专项核查（并行 6 路） |
| `merge-publish-data.js` | 多批次 manifest+audit 合并（发布用） |
| `copy-v18-images.js` | 旧批次 pass 图复制到新候选目录 |
| `fix-*.js` | 各类数据修复（保留历史） |
