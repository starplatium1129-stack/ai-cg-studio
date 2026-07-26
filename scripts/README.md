# 脚本目录

脚本按是否参与当前产品运行与维护分层，避免一次性实验和日常命令混在一起。

- `runtime/`：服务器和控制台直接依赖的运行辅助模块。
- `maintenance/`：场景构建、校验、审图、样张与性能诊断工具。
- `tests/`：`npm run validate` 及各专项测试使用的回归脚本。
- `fixtures/`：测试与校验用的固定样例数据。

日常操作优先使用 `package.json` 中的 npm 命令，避免依赖具体文件路径：

```powershell
npm run validate
npm run scenes:normalize
npm run benchmark:voice
```

一次性训练/实验脚本不入仓；需要时从 git 历史 `scripts/archive/model-training/`（commit `7a54f00` 之前）取回。
