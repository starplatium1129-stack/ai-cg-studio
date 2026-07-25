# 项目协作要求

## 图片审核

- 直接使用当前模型的视觉能力或本地图片查看工具检查图片。
- 不调用 `vision.js`、千问 VL 或旧的 `Codex-vision-skill`。
- 场景样张、模型对比图和训练素材必须由当前模型逐张观察后再给出结论，不能只根据文件名、标签或自动评分判断质量。
- 图片审核至少检查：人物身份与官方特征、脸和装饰、服装、肢体结构、双人特征串位、构图、光照，以及画面是否符合场景故事。

## 待办 / Future Work

- **TypeScript 全量迁移** — 所有 `.js`/`.mjs` → `.ts`，HTML 内 JS 抽到独立文件
- **测试体系** — vitest/mocha，覆盖核心流程（scene CRUD、voice pipeline、gallery 渲染）
- **CI** — GitHub Actions，push 自动跑 lint + typecheck + test
