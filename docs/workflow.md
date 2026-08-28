# 统一工作流手册（Workflow）

> 入口：`node scripts/workflow.js --help` 或 `npm run workflow -- --help`
> 目标：把 140 个分散的 `scripts/maintenance/*.js` 收敛到一套可发现、可复现、带帮助的入口，降低新同学上手成本。旧脚本仍可直接 `node` 调用，本手册仅做薄封装转发。

---

## 1. 快速导航

| 我想做 | 统一入口 | 直达脚本（兼容） |
|---|---|---|
| 校验/构建/发布 | `workflow check:full` / `build:web` | `npm run validate` / `npm run build` |
| 数据：聚合/校验/评级 | `workflow data:build` / `data:validate` | `npm run scenes:build` / `validate-content-contracts.js` |
| 参考库：出图/审核/修复 | `workflow reference:render` / `reference:audit --force --keys k` / `reference:repair` | `render-all-outfits-references.js` / `pure-vision-audit.js` / `fine-tuned-repair.js` |
| 样张：批量出图/审核/发布 | `workflow showcase:batch --source popular` | `generate-*-anima11.js` / `audit-showcase-rella.js` / `publish-*.js` |
| 一站式新角色 | `workflow character:onboard` | `npm run character:onboard` |
| 桌面部署 | `workflow deploy:desktop` | `deploy-desktop-quick.ps1 -SkipBuild` |

---

## 2. 统一入口用法

```powershell
# 查看全部
node scripts/workflow.js --help
npm run workflow -- --help

# 查看分组
node scripts/workflow.js data --help
node scripts/workflow.js reference --help
node scripts/workflow.js showcase --help

# 执行
node scripts/workflow.js data:validate
node scripts/workflow.js reference:audit --force --keys alisa_mikhailovna_kujou/school_uniform/ref_01_face_closeup
node scripts/workflow.js showcase:batch --source popular --batch-size 10 --dry-run
npm run workflow -- check:full
```

实现：`scripts/workflow.js:1` 仅做参数校验与 `spawnSync` 转发，不接管业务逻辑，完全兼容旧入口。

---

## 3. 分组详解

### 3.1 数据（data）— 场景是分片，聚合是产物

- `data:build` → `scripts/maintenance/build-scenes.js:1` 聚合 `data/scenes/*.json` → `data/scenes.json`（`scripts/lib/scene-store.js` 读写层）
- `data:import` → `split-scenes.js --write` 逆向分片（覆盖写入，显式操作）
- `data:normalize` → `npm run scenes:normalize`（`classify-scene-ratings.js --write && optimize-scenes.js --write && validate-scenes.js`）
- `data:validate` → `validate-content-contracts.js:1` 校验 `DATA_VERSION`（`src/stores/sceneStore.ts:66`）与分片一致性，`data/*.json` 13 文件 SHA1 派生

> 日常改场景优先走网页 `场景管理 → 保存到项目`，仅批量改分片时走命令行。

### 3.2 参考库（reference）— 45 角色 × 236 形态 × 4 视角 = 944

链路：`character-reference-standards.json:1` → `render-all-outfits-references.js:114`（Anima 832x1216，并发3，>20KB 跳过）→ `pure-vision-audit.js:52`（Gemini 4并发，`image-inspect.js`）→ `fine-tuned-repair.js:185`（每项3次重渲染+重审）

```powershell
# 全链路
node scripts/workflow.js reference:full

# 单步
node scripts/workflow.js reference:render
node scripts/workflow.js reference:audit --help
node scripts/workflow.js reference:audit --force --keys frieren/nsfw_nude/ref_01_face_closeup
node scripts/workflow.js reference:repair
```

`pure-vision-audit.js` 新增 `--force` / `--keys`（`scripts/maintenance/pure-vision-audit.js:135`），无需手动清理 `runtime/multi-outfit-audit-report.json`。

### 3.3 样张（showcase）— 热门/场景 双轨

- 生成：`generate-popular-showcase-anima11.js:1` / `generate-scene-showcase-anima11.js:1`（`/api/anima/jobs`，`anima-aesthetic-v1.1`，`--gateway 3123 --concurrency 3`）
- 审核：`audit-showcase-rella.js:1` / `audit-scene-showcase-run.js:1`（`image-inspect.js` 8维）
- 发布：`publish-popular-showcase.js` / `publish-scene-showcase-anima11.js`（原子重命名 + `DATA_VERSION` + `precompress`）
- **统一批量**：`scripts/maintenance/run-batch.js:1` 合并 8 个 `run-batch-*.js`
  ```powershell
  node scripts/workflow.js showcase:batch --source popular --batch-size 10 --concurrency 3 --dry-run
  node scripts/workflow.js showcase:batch --source scenes --ids sc001,sc002 --attempt 2
  ```

### 3.4 生图/视频/训练

- 生图：`routes/generation.js:19`（SD WebUI, `waiIllustriousSDXL_v170`）、`routes/anima.js:1`（Anima/Krea2, `anima-aesthetic-v1.1`）、`routes/video/*.js`（Wan/H3）
- 训练：`routes/training.js`（`JOB_IDS lora-nene-v18`），`services/training-service.ts`
- 统一校验：`npm run workflow -- check:content` 检查 LoRA/角色/场景引用

### 3.5 质量门与构建

```powershell
node scripts/workflow.js gate:quick     # 按改动类型分层门禁（缺省自动检测 git 改动）
node scripts/workflow.js gate:quick ui  # 显式指定面积：ui / server / data / all
node scripts/workflow.js gate:full      # 全量：typecheck + check + 前端 + unit + contract + 打包预算
node scripts/workflow.js check:quick    # npm run check (并行 13 项)
node scripts/workflow.js check:full     # npm run validate
node scripts/workflow.js build:web      # vite build + 140KB预算 + 预压
node scripts/workflow.js build:runtime  # tsc -p tsconfig.runtime.json
```

`gate:quick` 面积映射：`ui` = typecheck + vitest（纯前端改动，约 1-2 分钟）；
`server` = Anima/生成/视频/聊天/安全/桌面工具/控制 7 个契约套件；
`data` = 聚合一致性 + 内容契约 + 分片/参考库/定稿/语料契约（约 15 秒）；
`all` = 三块连跑；`full` 另加 check 套件与打包预算。横切重构（目录改名、
模块搬迁、依赖变更）直接 `gate:full`——爆炸半径无法事先界定。
套件执行器 `run-quality-suite.js` 默认摘要模式（逐文件一行 ✔/✘ + 用时，
失败才展开摘录，末尾 `sum [label]: PASS/FAIL` 汇总行，失败退出码非零）；
`--all` 失败后连跑全部求全貌，`--verbose` 恢复日志直通。

门禁见 `AGENTS.md:39`，预算见 `scripts/maintenance/check-bundle-budget.js:18`。

### 3.6 部署

```powershell
node scripts/workflow.js deploy:desktop
# 等价 powershell -ExecutionPolicy Bypass -File scripts/maintenance/deploy-desktop-quick.ps1 -SkipBuild
```

---

## 4. 已优化项

| 优化 | 变更 | 收益 |
|---|---|---|
| 统一入口 | 新增 `scripts/workflow.js:1` + `package.json:workflow` | 新同学 `workflow --help` 即可发现全部链路，无需全局 grep |
| 审核强制重审 | `pure-vision-audit.js:135` 增加 `--force` / `--keys` | 重渲染后无需手动编辑 JSON，`--force --keys <prefix>` 精准复审 |
| 批量合并 | 新增 `scripts/maintenance/run-batch.js:1` 统一 8 个 `run-batch-*.js` | 参数化 `--source/--batch-size/--concurrency`，`--dry-run` 预览，旧脚本保留作薄封装 |
| 文档收敛 | 新增 `docs/workflow.md`，`docs/INDEX.md` 登记 | 单一入口文档，避免在 `maintenance.md`/`project-status.md` 间跳转 |

---

## 5. 约定与注意事项

- **DATA_VERSION**：`data/*.json` 13 文件 SHA1 派生，`validate-content-contracts.js` 强制校验，改数据后 `npm run workflow -- data:validate` 会提示期望值，同步至 `src/stores/sceneStore.ts:66`。
- **原子写入**：`runtime/*.json` 与 `assets/character-references/` 已用 `writeFileSync tmp + rename`，多进程并发仍需避免双开审核。
- **网关重启**：`publish-*` 后需重启网关（`TOKEN` 持久化）方可使新 `SceneShowcase` 生效，见 `docs/showcase-generation-craft.md:120`。
- **Comfy 依赖**：`reference`/`showcase` 链路需 `ComfyUI` 在线（`http://127.0.0.1:8188`）与 `gateway`（`http://127.0.0.1:3123`），`--dry-run` 可先验证参数。
- **保留旧入口**：所有 `node scripts/maintenance/*.js` 仍可用，`workflow` 仅转发，便于渐进迁移。

---

## 6. 常见序列

```powershell
# 日常提交前
npm run workflow -- check:full

# 新增一个场景后
npm run workflow -- data:validate

# 重刷参考库某角色的失败项
node scripts/workflow.js reference:audit --force --keys alisa_mikhailovna_kujou
node scripts/workflow.js reference:repair

# 热门样张批量二轮
node scripts/workflow.js showcase:batch --source popular --attempt 2 --concurrency 3

# 构建并本地验证
npm run workflow -- build:web
```
