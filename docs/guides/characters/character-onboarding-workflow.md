# 热门角色接入工作流

> 2026-09-08。完整规则见 [工程契约](../../engineering-contracts.md#角色接入)。自动化辅助不能代替六层真实验收。

## 交付清单

1. 在 data/popular 分片和 characters.json 维护档案、视觉 DNA、服装与蓝图，运行 popular:build；保持归属与 outfitId 一致。
2. 注册 director/tokens.css 的角色强调色与全局氛围，两种主题均需视觉验收。
3. 按既有内容契约逐条编写场景；检查编译 Token 与真实成图；保护 pinned 场景。
4. 原图生成后同步 WebP 头像，并按需要重建对应点云，核对图片指纹。
5. standards 与 view 中登记全部服装：4 种参考机位 + 3 种设计机位。先 reference:register，再 render/design、同步 URL 和审核；pending 不能计为完成。
6. 类型、内容、接口、前端与 build 门禁通过，按需桌面部署，精准 commit + push。

样张发布目录从配置解析，不能沿用历史固定版本目录；参考资产不入 Git。

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


## 验收

执行 [完整门禁](../../workflow.md#门禁与构建)，另逐层核对主题、头像、参考图片与实际样张。--skip-render 只表示跳过生成，不是完成资产验收。
