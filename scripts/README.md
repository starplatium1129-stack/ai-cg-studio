# 脚本目录

脚本按是否参与当前产品运行与维护分层，避免一次性训练实验和日常命令混在一起。

- `runtime/`：服务器和控制台直接依赖的运行辅助模块。
- `maintenance/`：场景构建、校验、审图、样张与性能诊断工具。
- `tests/`：`npm run validate` 及各专项测试使用的回归脚本。
- `archive/model-training/`：已经结束的 v11/v13/v14 训练、评估与升级实验。
- `archive/scene-curation/`：已经应用到当前场景库的逐轮修复脚本。

日常操作优先使用 `package.json` 中的 npm 命令，避免依赖具体文件路径：

```powershell
npm run validate
npm run scenes:normalize
npm run benchmark:voice
```

归档脚本仍保留用于追溯和复现，但不属于当前运行链路，也不会被完整校验调用。
