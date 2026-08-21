# AI-CG-Studio 项目协作指南

> 当前版本阶段：v1.5.0 全模块稳态阶段。本文档仅保留核心宪法、不可破坏的架构红线与活跃待办；历史排障与调研细节已下沉至 `docs/` 归档。

---

## 一、 最高原则与协作红线

1. **遇难先搜，禁止盲试**：连续 2 次方案无效时，必须停下进行 websearch / 源码调研，参考成熟实现再行动；疑难解决后将「现象-根因-修复」沉淀进 `docs/`。
2. **手绘线条图标规范（2026-08-20 指示）**：项目中新增或修改的图标，**一律采用纯手绘线条 SVG（`ArchiveIcon.vue` 的 Hand-drawn Linear 机制）**，严禁使用 Emoji 字符或实心填充图标。
3. **内容分级 Fail-Closed 契约**：成人（R18）内容默认开启并带模糊遮罩；`adultEligibility` 与 `adultEnabled` 双重把关，未知或未授权状态必须严格拒绝，不得回退安全断言。
4. **媒体资产入库边界**：`assets/character-references/`（高精生成图）已 `.gitignore`，严禁提交入 Git 仓库；运行时通过 `/data/character-reference-view.json` 懒加载。
5. **保护工作区干净度**：禁止 `git reset --hard` 等破坏性命令；一次性测试脚本随用随清。

---

## 二、 核心架构与模块所有权

- **前端架构**：Vue 3 + Vite + TypeScript + Pinia（`src/stores/` + `src/views/` 全部路由懒加载）。
- **网关服务**：Express 4（桌面打包端）与 Express 5（主工作区）**双向兼容**；SPA fallback 统一使用正则 `/^(?!\/api).*/`。
- **生图双引擎**：
  - **Anima (ComfyUI / Pencil)**：主打高质量动漫与局部换装（Inpaint），支持 TeaCache 加速、手绘/CLIPSeg 遮罩与 `ImageCompositeMasked` 像素级原图回贴。
  - **Krea 2 (SD3.5)**：主打自然语言探索，遵循纯英文 Prose 组装，严禁 Tag 堆砌与负面词。
- **Live2D 双后端**：浏览器默认走 `wl-live2d`（按需加载贴图，`blinkScheduler` 驱动双眼同步）；桌面 Tauri 壳支持原生 Overlay 桥。
- **配音与陪伴**：GPT-SoVITS + 本机翻译管道，自动剥离台词舞台提示，长句分段与 in-flight 缓存去重。

---

## 三、 质量门槛与部署

### 1. 验证分级
- **前端视图/样式**：`npm run typecheck:app` ➔ `npm run build`。
- **接口与契约**：`node scripts/tests/test-anima-routes.js` + `node scripts/tests/test-popular-content.js`。
- **浏览器 E2E 回归**：定向运行 `npx playwright test tests/e2e/anima-quick.spec.ts` 或 `tests/e2e/studio.spec.ts`（全量跑时使用 `--workers=3`）。

### 2. 桌面快速部署
```powershell
powershell -ExecutionPolicy Bypass -File scripts/maintenance/deploy-desktop-quick.ps1 -SkipBuild
```
自动将 `dist/`、`data/`、`assets/`、`routes/`、`server.js` 增量同步进安装目录并重启桌面客户端。

---

## 四、 下一阶段规划与探索方向

1. **图生视频与动态演出联动**：将已生成的 4 视角角色与场景预设无缝送入下游 MiniMax H3 / T8 视频生成链路，生成 5~10 秒电影级动态 CG。
2. **桌宠 Live2D 演出数据驱动（P3/P4）**：根据日程、好感度与时间段触发专属小剧场表演，支持自定义角色扩展包导入。
3. **角色深度记忆与设定对话（RAG / 知识库）**：利用角色调研免额度检索工具，为 40+ 热门角色注入官方设定集与世界观知识库，提升对话沉浸感。
