# 四季夏目 Anima v19 E08 实验预览接入

日期：2026-08-10

## 定位

这是用户授权的现有 Anima 单角色引擎实验预览，不是生产晋级。E08 的科学训练结论和 `manual-audit.json.decision=rejected` 保持不变；普通全身 hard gate 失败仍是已知限制。

## 资产身份

- ID：`L_NAT_V19_ANIMA_PREVIEW`
- name：`shiki_natsume_v19_anima_preview`
- file：`shiki_natsume_v19_anima_preview.safetensors`
- checkpoint：E08 / step 312
- SHA-256：`389d3153ac05fbe0ea9bd74a9823e5cb8ee6fdc5ed0ecfd9e0b08ff9215036d2`
- strength：默认 `0.85`，范围 `0.65-1`
- compatible models：Anima Base v1.0、Anima Aesthetic v1.1

## 接入边界

- Anima 单角色：宁宁固定 `L_NENE_V20_ANIMA`，夏目固定本 preview；角色与 LoRA 不匹配时服务端返回 400。
- SD/WAI 生产链路不变，继续使用 `L_NAT_V18_WD14` / `L_NENE_V18_WD14`。
- triad/shared 继续使用 SD，不允许 Anima 或双 LoRA。
- 服务端只接受白名单中的 `modelId`、`loraId`、`character` 等参数，不开放 raw workflow 或路径。
- preview 文件缺失时不展示为可用并拒绝提交，不回退到宁宁或 SD。

## 验证证据

- staging 脚本：`scripts/maintenance/stage-anima-natsume-v19-preview.js`，源文件与目标文件固定 SHA 校验，重复运行幂等。
- HTTP contract：状态暴露 preview/validation；夏目 preview 可提交；宁宁/夏目错配、triad、未知路径均拒绝；结果、owner、cancel 边界继续复用既有测试。
- 浏览器：夏目选择 Anima 时提交 `character=natsume` 与 preview ID；切回宁宁使用 v20；triad 不提交 Anima。
- 真实 smoke：`AI/Reviews/AnimaNatsumeV19PreviewSmoke/2026-08-10`，固定 seed，包含夏目身份/咖啡服与普通全身各一张，逐图视觉检查结论见该目录 manifest/report。

## 为什么不等于生产晋级

E08 总矩阵为 13W/2T/3L，身份、咖啡服、低光与 R18 表现良好，但 ordinary fullbody hard gate 失败；修正 prompt 后 fullbody+identity 仍只有 2/3。实验接入扩大可审阅性，不改变生产门槛、结论或正式模型身份。
