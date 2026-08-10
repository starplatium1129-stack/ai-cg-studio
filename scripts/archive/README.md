# scripts/archive — 历史脚本归档

这些脚本属于 v13/v14/v16/v17 时代的一次性模型评估与数据构建工具，已被 v18 链路取代，不再参与日常维护。

## 归档原因

- 模型已迭代到 v18：Nene 使用统一 v18 WD14 数据集 + 单一 LoRA；Natsume 使用 v18 balanced-R18。
- v15/v17 时代的分体数据集、split core/add-on 工作流、多版本盲测 gate 均已退休。
- v14 时代的双人姿态（dual-pose）与官方 CG（official-cg）候选管线为一次性历史产物。

## 当前有效链路（v18，不要回退）

- `scripts/maintenance/generate-v18-core-showcase.js` — v18 核心样张候选生成
- `scripts/maintenance/build-scene-manual-audit-sheets.py` — 人工审核拼图表
- `scripts/maintenance/update-v18-core-showcase.py` — 定稿样张落盘到线上展示集
- `scripts/maintenance/audit-nene-v18-wd14.py` / `audit-natsume-v18-wd14.py` — v18 盲测 gate
- `scripts/maintenance/audit-nene-v16.py` — 上述 v18 gate 共享的基础审计模块（被 with_name 引用，必须留在原目录）
- `scripts/training/*v18*` — v18 数据集/配置/后训练脚本

## 文档归档（docs/）

旧设计研究和 Companion 可行性稿已删除：其结论分别由 `DESIGN.md`、`AGENTS.md`、`docs/project-status.md` 和当前桌面文档承载。这里仍可能保留一次性脚本或演示资产，但不再把过期资料当作项目契约。

## 注意事项

- 归档脚本若使用 `Path(__file__).with_name("audit-nene-v16.py")` 加载基础模块，移动后该引用会失效——这是预期行为，归档脚本不再运行，仅供历史查阅。
- 如需重新启用某个历史脚本，请连同其依赖（如 `audit-nene-v16.py`）一起移回原目录。
