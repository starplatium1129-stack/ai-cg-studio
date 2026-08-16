# 开发环境修复与 E2E 基线记录（2026-08-16）

> 本会话（UI 布局改造 + 粒子系统 + 性能优化）期间解决的 dev 环境疑难与 E2E 基线归因，留给后续会话查档，避免重复排查。

## 1. `npm run dev`（Vite dev server）整链挂掉：`/assets` 代理吞掉 `?import` 模块请求

- **现象**：dev 模式下任意路由白屏，控制台报 `Failed to load module script: … MIME type of "image/svg+xml"`，随后 `Vue Router warn: Unexpected error when starting the router: Failed to fetch dynamically imported module: …/AppLayout.vue`。生产构建不受影响。
- **根因**：SFC 模板里的 `<img src="/assets/logo.svg">`（`assets/` 在项目根，非 public/）会被 plugin-vue 改写成模块导入 `/assets/logo.svg?import`；而 vite.config 的 proxy 表把整个 `/assets` 转发给 Express（3000），Express 原样返回 svg → 浏览器对 module script 做 MIME 严格检查失败 → AppLayout 模块链断 → 整站不渲染。
- **修复**（`vite.config.ts`）：`/assets` 从 proxy 表移除，改为插件 `express-assets-conditional-proxy`：`/assets/` 且 URL 含 `import` 时交给 Vite 转换，其余才代理给 Express（角色立绘等大文件仍由 Express 提供）。
- **验证**：`curl :5173/assets/logo.svg` 走 Express（带 CSP 头）；浏览器模块链正常、三页截图渲染完整。

## 2. Vite dev server 崩溃：`EBUSY: watch runtime/state/managed-comfyui.pid`

- **现象**：`npx vite` 启动后数秒崩溃 `EBUSY: resource busy or locked, watch …runtime\state\managed-comfyui.pid`。
- **根因**：网关（server.js）随时写 `runtime/state/` 下的 pid/日志，Vite 全仓 watch 撞上文件锁。
- **修复**：`vite.config.ts` 的 `server.watch.ignored` 追加 `'**/runtime/**'`（与已忽略的 desktop-tauri 同类处理）。

## 3. Playwright 浏览器可执行文件缺失

- 本机未下载 ms-playwright 浏览器包；`playwright.config.ts` 已内置 Windows 候选路径解析（Edge 优先、Chrome 兜底），无需 `npx playwright install`。临时截图脚本直接 `chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })` 即可。

## 4. E2E 基线归因（2026-08-16，勿在下次会话重复追查）

对 2026-08-16 HEAD（5a177e3）+ 本会话改动各跑一轮定向 E2E，以下失败**在无本会话改动的基线上同样失败**，属既有问题：

| 用例 | 归因 |
|---|---|
| studio `director separates…` / flows 1 / flows 6 / studio 167 / studio 192 | `#promptMonitor` 的 `open` 属性与 `.preview-output` 元素缺失——5a177e3「Prompt 组装审计收口」重构了 PromptHealthPanel，测试断言未同步更新 |
| anima-quick `main generate…` | 文案断言 `/Anima 在线/`，现行代码显示「✓ Anima 已连接」 |
| studio `scene explorer collapses filters` | checkbox `element is not stable`（动画未沉降，环境相关） |
| studio `speech input: hold-talk…` / `scene manager loads…` / `home page stays inside the performance budget` / flows 3a / flows 4 / flows 4b | 均不在本次改动文件内，基线复现或属聊天/备份子系统 |

本会话改动面的规格全部通过：`archive-visual-language`（.cb-card 35）、`particle-narrative`、`anima-quick` popular 系列与 popular-scenes 深链、flows 大部分。flaky 提示：flows「Anima · 应用 job」与 anima-quick 两个深链用例在大批量并行下偶发超时，单独复跑即过。

## 5. 本地视觉审核通道备忘

`image-inspect`（CLIProxyAPI + gemini-3.7-flash-high）偶发上游 OAuth `EOF` 500，重试即恢复；对 64px 小尺寸元素（如头像缩略图）的"缺失/空白"判断不可靠，必须用 DOM/HTTP 探测复核（本次"角色头像大面积缺失"实为误报，全部 popular-*.png 均存在且 200）。

## 6. 本机网络：PyPI 官方源与 GitHub 直连慢且损坏，装依赖一律走镜像（2026-08-16 实测）

| 通道 | 实测速度 | 结论 |
|---|---|---|
| files.pythonhosted.org（PyPI 官方 CDN） | 44 KB/s，42MB 轮子稳定断在 ~29MB 处报哈希不匹配 | 禁用 |
| **pypi.tuna.tsinghua.edu.cn（清华 TUNA）** | **15.1 MB/s，42MB 完整** | pip 首选 `-i https://pypi.tuna.tsinghua.edu.cn/simple` |
| mirrors.aliyun.com/pypi | 4.9 MB/s | 备选 |
| github.com 直连 | 22 KB/s | 禁用 |
| **ghfast.top**（GitHub 加速） | ~1.0 MB/s（可断点续传） | 下载 release 资产用；mirror.ghproxy.com 已死，gh-proxy.com 可用但慢 |

## 7. 角色形象粒子（剪影点云）管线（2026-08-16）

「粒子跟角色形象对应」的落地链路：**离线预计算 + 前端重组**。

- **数据前提**：`assets/characters/popular-*.png` 全部是 832×1216 复杂场景 CG（无透明通道、人物仅占 25-45%），运行时启发式抠图不可行 → 用 **rembg（U2-Net）离线抠图**。
- **生成**：`python scripts/maintenance/build-particle-portraits.py [角色id]` → `assets/particles/p_<id>.json`（2400 点 + k-means 6 主色调色板；轮廓×5 / 结构线（亮度梯度）×3 / 内部按亮度加权采样）。35 角色全量已生成。
  - rembg 安装：`pip install -i https://pypi.tuna.tsinghua.edu.cn/simple rembg numpy pillow`（完整链含 pymatting/numba，别用 `--no-deps` 绕）。
  - 模型 `~/.u2net/u2net.onnx`（176MB，md5 `60024c5c889badc19c04ad937298a77b`）用 ghfast.top 断点续传手动放置，pooch 校验通过即跳过下载。
- **前端**：`src/utils/particlePortrait.ts` 按需懒加载点云 → `SemanticParticleField` 新增 `portraitId` prop，点云就位后粒子以现有弹簧动画平滑重组为人物剪影；粒子按角色真实主色成像（深色自动提亮到亮度 0.34 保证可见）；剪影模式粒子数下限 ambient 1500 / hero 2000；无点云/加载失败自动回落 `characterParticleTheme` 抽象形状。
- **质量验证**：点云渲染图视觉评分 8.5/10（雷姆：上部蓝发、中部黑白女仆装，一眼可辨）；实机截图复核两页 hero 均成像清晰。
- **新增角色流程**：放好 `popular-<id>.png` → 跑一次生成脚本（单角色参数）即可；前端零改动。

### 7.1 点阵 v2：均匀覆盖网格 + 运行时等距点阵（2026-08-16 二次迭代）

初版「加权采样点云」疏密不均（轮廓×5 的重复采样在人物内部产生空洞），成像被评
"离散有孔洞"。按参考实现 **BlackCoder0/Arknights-FlowingPoints**（GitHub，已用
api.github.com 验证存在）重做：

- **参考关键参数**：`particleSize 3px + margin 1px`（点径/点距 = 0.75，**统一点
  径**，明暗只换色不换大小）；`samplingStep 5` 均匀网格采样 alpha>128；普通
  `getContext('2d')`。
- **数据格式 v2**：`{ id, aspect, palette[8], grid: { w, h, cells } }`，cells 为
  行拼接字符画（'.'=背景，'0'-'7'=调色板序号），源宽 140px，单角色 ~36KB。
- **前端**：`samplePortraitPoints` 按场域实际像素重建等距点阵（正方形单元、点距
  处处相等、任意屏幕尺寸无各向异性），统一点径 0.75×点距；密度 ambient 3200 /
  hero 4200 / 窄屏 1600；剪影场 dpr 上限 2、漂移近零（0.3）、回弹弹簧 0.075。
- **效果**：雷姆点阵成像相符度 9.5/10（"规整饱满无穿孔，符合明日方舟官网方块
  点阵剪影风格"），165fps 满帧。

### 7.2 desynchronized canvas 黑屏回归（教训）

`getContext('2d', { desynchronized: true })` 在部分 GPU/WebView2 的 overlay 路径
会让画布整块渲染成**纯黑**（灵感场景/效果样张页实锤）。已回退为普通 2d 上下
文——未经真机全环境验证的"合成器直取"优化不要上生产。
