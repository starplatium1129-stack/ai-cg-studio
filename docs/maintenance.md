# 场景库维护手册

场景库采用“分片源文件 → 自动构建 → 浏览器产物”的结构。维护者编辑小文件，网页继续读取一个兼容的聚合文件。

## 文件职责

| 文件 | 职责 | 是否手动编辑 |
| --- | --- | --- |
| `data/scenes/*.json` | 场景的唯一数据源，按角色与系列分片 | 是 |
| `data/scenes/manifest.json` | 声明分片与顺序 | 新增分片时编辑 |
| `data/scenes.json` | 供静态网页读取的构建产物 | 否 |
| `data/curation.json` | 精品层级、推荐理由、语义搜索和情绪入口 | 是 |
| `scripts/scene-store.js` | 所有维护脚本共用的读写层 | 结构变化时编辑 |
| `tools/scene-ux.js` | 搜索意图、相关度和本机偏好排序的共享逻辑 | 搜索规则变化时编辑 |

## 日常新增或修改场景

1. 在对应的 `data/scenes/*.json` 分片中编辑场景。
2. 运行 `npm run scenes:normalize`，统一评级、标签和负面提示词。
3. 运行 `npm run validate`，确认构建产物、编号、角色 DNA 与字段规则全部通过。
4. 若要将新场景加入精选、招牌入口或语义搜索，编辑 `data/curation.json`。

`scenes:normalize` 会同时更新分片和 `data/scenes.json`。只改了普通文案、不需要规范化时，也可以运行 `npm run scenes:build` 重新生成聚合文件。

## 搜索与个人推荐

- `searchAliases` 同时承担同义词扩展和中文整句意图拆解。优先添加完整的二字以上词语；单字仅在用户独立输入时识别，避免“夏目”误命中“夏日”。
- 搜索结果先按标题、角色、情绪、地点、故事等字段的命中强度排序，再结合个人偏好和主理人精选顺序。
- 个人偏好只读取浏览器本机的作品历史，根据使用次数、五维评分、收藏和最近使用时间计算；不上传、不新增远程追踪。
- 没有历史记录时，智能推荐会自动退回主理人精选顺序，因此新用户体验不依赖个人数据。

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
- 招牌场景必须同时存在于 `curatedSceneIds`，并在 `recommendationReasons` 中说明推荐理由。
- 新增自然语言搜索词时，在 `searchAliases` 中提供至少一组能够命中现有场景的同义词。
- 修改搜索或推荐权重时，同步扩展 `scripts/test-scene-ux.js`，覆盖整句拆解、相关度和偏好排序。
- 新增角色时，同时增加角色资料、对应分片、Manifest 条目和校验规则。
- 批量脚本必须通过 `scene-store.js` 写回，避免只改聚合文件。
