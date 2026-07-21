# 场景库维护手册

场景库采用“分片源文件 → 自动构建 → 浏览器产物”的结构。维护者编辑小文件，网页继续读取一个兼容的聚合文件。

## 文件职责

| 文件 | 职责 | 是否手动编辑 |
| --- | --- | --- |
| `data/scenes/*.json` | 场景的唯一数据源，按角色与系列分片 | 是 |
| `data/scenes/manifest.json` | 声明分片与顺序 | 新增分片时编辑 |
| `data/scenes.json` | 供静态网页读取的构建产物 | 否 |
| `data/curation.json` | 首页精选顺序与情绪入口 | 是 |
| `scripts/scene-store.js` | 所有维护脚本共用的读写层 | 结构变化时编辑 |

## 日常新增或修改场景

1. 在对应的 `data/scenes/*.json` 分片中编辑场景。
2. 运行 `npm run scenes:normalize`，统一评级、标签和负面提示词。
3. 运行 `npm run validate`，确认构建产物、编号、角色 DNA 与字段规则全部通过。
4. 若要将新场景加入精选，编辑 `data/curation.json`。

`scenes:normalize` 会同时更新分片和 `data/scenes.json`。只改了普通文案、不需要规范化时，也可以运行 `npm run scenes:build` 重新生成聚合文件。

## 从场景管理器导入

场景管理器仍会导出完整的 `scenes.json`。用导出文件覆盖 `data/scenes.json` 后运行：

```powershell
npm run scenes:import
npm run validate
```

导入命令会按角色和系列重新分片。它是显式覆盖操作，不应作为日常构建命令使用。

## 一键质量门槛

```powershell
npm run validate
```

该命令依次检查：

- 聚合文件是否与分片完全一致；
- 标签、Prompt 和负面词是否已经规范化；
- 内容分级是否与场景描写一致；
- Scene ID、角色、时间、日文叙事与角色 DNA 是否有效。

只要该命令通过，提交中的场景源和网页读取数据就是同步的。

## 维护约束

- 不直接编辑 `data/scenes.json`；它是生成文件。
- 不在 HTML 中硬编码精选场景 ID 或情绪入口，统一写入 `data/curation.json`。
- 新增角色时，同时增加角色资料、对应分片、Manifest 条目和校验规则。
- 批量脚本必须通过 `scene-store.js` 写回，避免只改聚合文件。
