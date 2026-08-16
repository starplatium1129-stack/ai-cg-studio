# 角色点阵粒子管线（操作手册）

> 2026-08-16 起。角色场景库 / 角色档案页 hero 的粒子是**整图点阵复刻**（对标
> Arknights-FlowingPoints 的行为模型 + 角色真实配色），数据由离线脚本预生成。
> 本文档是「新增角色怎么接」的唯一入口；疑难排查与迭代历史见
> `docs/dev-environment-fixes.md` §7。

## 新增一个角色（3 步，前端零改动）

1. **放图**：把角色图放到 `assets/characters/popular-<角色id>.png`
   （推荐 832×1216 竖图；角色 id 与 `data/popular-characters.json` 一致）。
2. **生成点阵**：
   ```
   npm run particles:build                # 全量（35 个秒级跑完）
   npm run particles:build -- rem_rezero  # 只跑指定角色
   ```
   产物：`assets/particles/p_<角色id>.json`（~100KB/角色，随 assets 一起部署）。
3. **完事**。前端按角色 id 懒加载 `p_<id>.json`，存在即整图点阵成像，
   不存在自动回落 `characterParticleTheme` 的抽象形状——新角色忘跑脚本也不会白屏。

工作室角色（宁宁/夏目）的图名映射在脚本的 `STUDIO_PORTRAITS` 里维护。

## 首次在本机启用（依赖一次性安装）

```
pip install numpy pillow
# 本机 PyPI 官方源慢且损坏时走镜像：
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple numpy pillow
```

不需要 rembg / GPU / 大模型（v5 起整图复刻不再抠像，纯 numpy+Pillow 秒级）。

## 可调参数（脚本顶部常量）

| 常量 | 默认 | 说明 |
|---|---|---|
| `SOURCE_WIDTH` | 200 | 源网格宽（px）。前端点阵 ≤ ~110×160，200 已无混叠 |
| `PALETTE_SIZE` | 36 | k-means 主色数（base36 索引上限就是 36） |
| `FEATHER_RATIO` | 0.05 | 边缘羽化比例。过大（曾用 0.14）会"像没拼完的拼图" |

前端侧（`SemanticParticleField`）可调：点数下限（hero 8000/ambient 6000）、
点径比 0.55×点距、深色主题 screen 混合 / 浅色主题 0.76 透明度、
105px 斥力 + 0.01 慢回流物理（对标参考实现，勿随意改动）。

## 常见问题

- **新角色 hero 还是抽象形状**：多半是没跑脚本或图名不对，F12 看
  `/assets/particles/p_<id>.json` 是否 404。
- **桌面端看不到**：`deploy-desktop-quick.ps1` 会复制 `assets/`，改完记得部署。
- **效果微调**（羽化/色数/点径）→ 改常量 → `npm run particles:build -- <id>` →
  刷新页面即见，不需要动前端。
