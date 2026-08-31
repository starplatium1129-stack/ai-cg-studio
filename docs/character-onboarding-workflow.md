# 热门角色一站式接入与全量资产流水线规范 (Character Onboarding Pipeline)

> **基线日期**：2026-08-18
> **核心目标**：实现新热门角色（Popular Character）从“设定调研”到“全量资产生成、样张上架、参考图构建、点阵粒子场与契约质检”的一站式全自动闭环。

---

## 一、 为什么需要统一接入流水线？

在过去，添加一个新角色需要手动跨越 8 个独立步骤与 7 个配置文件：
1. `data/popular-characters.json`：录入角色基本信息与 3-5 套服装。
2. `data/characters.json`：同步角色音色与特征 DNA。
3. `data/scene-blueprints.json`：编写 6 个 SFW 场景 + 4-5 个 NSFW 场景（含足控、解剖学私处等）。
4. `assets/characters/popular-<id>.png`：渲染全年龄正统校园立绘。
5. `assets/particles/p_<id>.json`：运行 Python 脚本生成 200x292 粒子点阵。
6. `data/character-reference-standards.json` & `src/utils/characterReferenceData.ts`：注册 4 视角参考规范（含 `nsfw_nude` 纯粹私密全裸形态）。
7. `assets/character-references/<id>/`：渲染 5 服装形态 $\times$ 4 视角 = 20 张电影级参考图（Character Reference Bible）。
8. `AI/SceneShowcase/2026-08-15_v23/`：渲染 11 个场景的官方 Showcase 样张（`images/` 与 `thumbs/`）并同步 `manifest.json`。
9. `src/stores/sceneStore.ts`：计算数据哈希并升级 `DATA_VERSION`。

若人工逐项操作极易遗漏（如漏算版本哈希、漏建粒子点阵、提示词画风未统一），因此项目建立了统一的自动化接入引擎：
**`scripts/maintenance/workflow-onboard-popular-character.js`**。

---

## 二、 角色资产标准契约

### 1. 场景蓝图配比（6 SFW + 4-5 NSFW）
- **6 个 SFW 原型场景**：
  - 教室窗边/回眸（校园日常）
  - 核心身份场景（如学生会室、工坊、舞台、战场）
  - 天气与氛围场景（雨后车站、晴空林荫道、雪夜）
  - 室内知性/阅读场景（图书馆、书架）
  - 休闲约会场景（街角露天咖啡厅）
  - 传统/节日场景（夏日祭典浴衣、烟火大会）
- **4-5 个高阶 NSFW 场景**（须包含显式解剖学与特色视角）：
  1. **床榻私密·足底大透视与娇喘**：双腿屈膝/分腿朝向镜头，大透视 85mm 微距足弓与严格 5 趾特写，私处清晰显露（`exposed_pussy, detailed_vulva, pink_nipples, uncensored, 5_toes`）。
  2. **放学后空教室·课桌私语**：制服全敞露乳、下身一丝不挂、黑丝褪至脚踝（`topless, bottomless, exposed_pussy, unbuttoned_shirt`）。
  3. **浴室水汽·湿发与薄透水痕**：淋浴间花洒、湿漉发丝贴背、水珠滑落与私处显露（`wet_skin, water_drops, exposed_pussy, detailed_vulva`）。
  4. **晨光沙发·半解衬衫与绝对领域**：单穿宽大男士衬衫解扣敞开、光裸双腿与私密（`nude_under_shirt, open_shirt, spread_thighs, exposed_pussy`）。
  5. **私密镜前·正面遮羞与双重倒影**：落地镜前正面展露、镜中倒映裸背、腰窝与翘臀（`mirror_reflection, bare_back, bare_buttocks, exposed_pussy`）。

### 2. 4 视角参考资产库（Character Reference Bible）
每位角色必须包含 researched 常规服装 + `🔞 私密全裸 / 纯粹形态`（`nsfw_nude`），输出 4 视角：
- `ref_01_face_closeup`：85mm f/1.4 浅景深面部微表情特写。
- `ref_02_half_medium`：50mm 3/4 半身定妆中景。
- `ref_03_full_dynamic`：50mm 正面全身立姿无裁切（全裸形态包含私密解剖结构）。
- `ref_04_back_rear`：85mm 45° 侧后背影/回眸轮廓光。

---

## 三、 一键运行流水线

> **入口**（红线 10 优先复用现成工作流）：统一走 `scripts/workflow.js` 的 `character:onboard`，勿直调裸脚本。

```bash
# 为指定角色全自动运行流水线（同步契约、建点阵、渲染参考图、渲染样张、升版本并验证）：
node scripts/workflow.js character:onboard --character <character_id>

# 仅执行数据、点阵与质量门禁对齐（跳过已渲染资产）：
node scripts/workflow.js character:onboard --character <character_id> --skip-render

# 执行并自动增量部署至桌面端：
node scripts/workflow.js character:onboard --character <character_id> --deploy

# 旧入口仍兼容（不推荐，未经 workflow 校验层）：
# node scripts/maintenance/workflow-onboard-popular-character.js --character <character_id>
```

---

## 四、 自动化校验门禁

流水线末尾自动触发 5 重防护测试，确保系统 0 坏死点：
1. `npm run typecheck:app`：前端 TS 类型 100% 严谨。
2. `npm run build`：生产环境打包与体积预算通过。
3. `validate-content-contracts.js`：角色、LoRA、场景与 `DATA_VERSION` 严格哈希校验。
4. `test-popular-content.js`：断言热门角色数量、服装默认态、蓝图归属与成人 fail-closed。
5. `test-repo-hygiene.js`：全库换行与文本卫生扫描。


