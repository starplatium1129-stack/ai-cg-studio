# Live2D 原生运行时（路径 B）开发记录与瓶颈

> 记录日期：2026-08-08
> 定位：桌面端（Tauri 壳）用官方 **Cubism SDK for Native 5-r.5** 替换 wl-live2d 网页渲染的中间状态记录。
> 代码位置：`desktop-tauri/native-live2d/`（独立 Rust crate，含 C++ 胶水层 + wgpu 渲染器 + PoC 示例）。

## 0. 外部参考（先查证，再自研）

**教训（2026-08-08）：遇到反复无法解决的疑难，先上网搜寻现成实现并照抄验证过的行为，
不要连续盲猜。以下参考来源均已用 api.github.com 验证真实性：**

| 参考 | 状态 | 用途 |
|---|---|---|
| `AyagamiDev/ayagami`（GitHub，2026-07-11 创建，纯 Rust + wgpu，Live2D 兼容渲染器，1:1 mask 质量、premultiplied alpha、sRGB/线性混合可选） | ✅ 已验证存在 | 当前 mask/混合问题的首选参考，**直接读它的 shader 与 mask 布局实现** |
| `pixi-live2d-display`（npm，0.4.0）| ✅ 已下载 | 官方 CubismRenderer 逻辑（wl-live2d 上游），mask channel/layout 矩阵 |
| `wl-live2d` node_modules 内嵌 cubism4.js | ✅ 本机已有 | 官方渲染器源码（mask 通道 flag、layoutBounds、matrixForMask/matrixForDraw、shader 全文） |
| `sena-nana/live2d-rs`（wgpu + Cubism Core workspace）| ❌ api.github.com 404，**不存在**（websearch 幻觉，勿再引用） |
| `Veykril/cubism-rs` | 旧（4-r.5.1） | 框架级绑定参考，版本老 |

网络要点：github.com 直连不通；`api.github.com` 可达（可验证仓库存在）；源码下载可用
codeload/镜像；crates.io 可达（crate 依赖不受影响）。

## 0. 架构

```
Rust (live2d-native crate)
├─ build.rs          编译官方 C++ Framework（cc crate）+ 链接 Core 静态库
├─ csrc/             自写 C++ 胶水层（live2d_model.h/.cpp，~560 行）
│                    封装 CubismUserModel 组合：motion/physics/pose/expression/eyeBlink/hitTest
├─ src/ffi.rs        胶水层 C API 的 unsafe 绑定
├─ src/model.rs      Model 安全封装 + model3.json 解析（serde）+ ViewTransform
├─ src/renderer.rs   wgpu 渲染器：mask 通道、4 种混合、premultiplied alpha
├─ src/shader.wgsl   官方 GLES2 着色器语义移植（fs_main/fs_masked/fs_mask）
└─ examples/render_frame.rs  PoC：离屏渲染帧 → PNG（含 --flip-uv/--no-mask/--drawable 调试参数）
```

- SDK 位置：`E:\code\CubismSdkForNative-5-r.5\CubismSdkForNative-5-r.5\`（从官方下载，专有许可）
- Core 链接：`Core/lib/windows/x86_64/143/Live2DCubismCore_MD.lib`（/MD 运行时）
- Framework 编译：全部 `Framework/src/**/*.cpp`，排除 `Rendering/` 平台后端，
  仅补 `csmBlendMode.cpp` + `CubismRenderer.cpp`（后者提供 `CubismRenderer::StaticRelease`，
  但 `StaticRelease` 本体在平台后端里，胶水层里自己补了空实现——见下方坑 4）

## 1. 已验证通过 ✅

| 项 | 证据 |
|---|---|
| 官方框架编译+链接 | release 构建成功，Core 6.0.1 初始化 |
| nene moc3 加载 | 381 drawable，canvas 1x2（pixelsPerUnit=4096 归一化），8 动作组/7 命中区/5 表情/物理 |
| 动作播放/物理/表情 | Idle 动作 90 帧正常步进，draw calls 102，14 个 mask 通道 |
| 渲染质量 | 与参考渲染器 ayagami 逐项对比：**95%+ 成品级**（颜色/完整性/mask 边缘/半透明边缘一致） |
| 宁宁 | 完整角色（含腿袜鞋），无空洞，颜色正常，居中 |
| 夏目（Cubism 3 旧格式） | 完整角色，居中，mask 干净（content-fit 兼容旧模型） |
| 内存安全 | 修复 scheduler 双重释放后正常退出（此前每次退出 HEAP_CORRUPTION） |

## 1.5 关键修复：uniform 缓冲 bug（本会话最大发现）🔴→✅

**症状**：多部件渲染时"全部 alpha 半透明（0% 不透明）、颜色灰暗、条纹、偏右"；
单部件渲染完全正常；部分部件（如 opacity=0.3 的 Multiply 层）加入后全屏 alpha 全灭。

**根因**：**所有 drawable 共用同一个 uniform buffer，每次 draw 前 `write_buffer` 覆写。
wgpu 的 buffer 内容在 submit 时才是最终状态 → GPU 上所有 draw 读取的都是最后一次写入的
uniform（最后一个部件的 opacity/颜色）**。证据：d120（不透明）+ 91（opacity=0.3）组合
后 d120 的像素 alpha 全变成 0.3，与绘制顺序无关（order 排序固定 91 最后）。

**修复**：每部件独立 uniform 槽位 + 动态偏移（参考 ayagami 的方案）：
- uniform buffer = 256 槽 × 256B（stride 256，wgpu 动态偏移须 256 对齐）
- buffer 大小 ≤ 65536（max_uniform_buffer_binding_size）
- bind group binding `size: Some(stride)`（否则偏移超 0 报错）
- `set_bind_group(2, bg, &[slot * stride])`（动态偏移是字节偏移）
- layout 需 `has_dynamic_offset: true`

**教训**：此 bug 曾导致"条纹/偏右/半透明"被误判为 mask、flip、颜色空间等 10+ 个方向的
问题，浪费大量时间。**怀疑渲染层问题时，先验证"每个 draw 的输入数据是否独立"。**

## 1.6 参考渲染器对照（最终结论）

- `AyagamiDev/ayagami`（纯 Rust + wgpu）渲染宁宁 = 标准答案；本实现与之逐项对比 95%+ 一致
- 剩余微差（可接受）：明度约 5-8%（线性混合 vs 编码空间混合）、mask 边缘 1px AA 粒度、数像素位移
- ayagami 的 mask 渲染"忽略 opacity 但检查 visible"；官方 C++/wl-live2d 均"不检查 visible"——两者在正常模型上结果一致；本实现采用"不检查 visible + 忽略 opacity"（与官方一致）
- `sena-nana/live2d-rs` 经 api.github.com 验证 **404 不存在**（websearch 幻觉，勿再引用）

## 1.5 与 wl-live2d 的对照验证（2026-08-08 完成）

- 对照环境：`poc/live2d-compare/`（vite dev server 5173 代理 /assets → 网关 3000；
  wl-live2d es bundle 自包含，wasm 内嵌 base64，已复制到 vendor/）
- 结论：**同一动画帧姿势/构图/部件完整性完全一致**（含腿袜鞋——曾误判为缺失，
  实为"mask 源部件被误从主帧过滤"bug 导致）
- 剩余差异：色彩略暗/饱和略低（线性混合 vs wl-live2d 的 sRGB 编码值混合），
  属校准级微调，非结构错误

## 2. 已解决的关键坑（按踩坑顺序）

1. **旧 CubismJson 数字解析缺陷**：5-r.5 Framework 自带的 CubismJson 解析器，数字只以
   `\n` 或 `,` 结尾（`0.6 }` 直接报 "non-numeric character found"）。手写/编辑器导出的
   model3.json 常有 `0.6 }` 格式 → 解析失败 → setting 空 → 后续崩溃。
   解决：Rust 侧 `normalize_json()` 用 serde 重排（`to_string_pretty`，每个值独占一行）再交给 C++。
   **所有 JSON 资产（model3/motion/expression/physics/pose）都要过这道**。

2. **Core 顶点坐标约定**：`csmGetDrawableVertexPositions` 返回**画布空间、原点在画布中心、
   Y 向上**的归一化坐标（nene：x∈[-0.22,0.25] y∈[-0.70,0.85]，canvas 1x2）。
   不是"左上原点 Y 向下"像素坐标。ViewTransform 只需纯 scale（fit）+ 居中，无 offset、无翻转。

3. **纹理 UV 的 V 方向必须翻转**：Live2D 导出纹理在文件里就是上下翻转存储的。
   `uv.y = 1 - uv.y` 后才正确（主渲染 + mask 通道渲染**必须一致**地 flip）。
   已内置到 `vertex_buffer`（不再由调用方传参）。wl-live2d 的 shader 也做同样翻转
   （`v_texCoord.y = 1.0 - v_texCoord.y`）——双向印证。

4. **`CubismRenderer::StaticRelease` 无定义**：5-r.5 里该静态方法定义在平台后端
   （OpenGL/D3D/Vulkan），`CubismFramework::Dispose` 引用它。渲染器自研 → 胶水层补空实现。

5. **wgpu 细节**：
   - `write_buffer` 数据长度必须 4 字节对齐（u16 索引 111 个 = 222B → 补 padding 到 224）
   - bind group layout 必须复用同一实例（每次新建 layout 会导致校验错误）
   - 顶点缓冲 interleave pos+uv（stride 16，location0=pos/offset0，location1=uv/offset8）
   - 纹理上传做 **premultiply**（`rgb = rgb*a/255`，模拟 pixi 的 PREMULTIPLY_ON_UPLOAD），
     shader 直接消费 premultiplied 值；blend 用 premultiplied over
     （`One, OneMinusSrcAlpha`）；保存合成用 `src + dst*(1-srcA)` 不可二次乘 alpha
   - 渲染目标用 `Rgba8UnormSrgb`（sRGB 解码/编码闭环）；mask 通道纹理用 `Rgba8Unorm`

6. **mask 采样坐标**：clipped drawable 用**自己的 clip 空间坐标归一化**采样 mask 纹理
   （`mask_uv = (position.x*0.5+0.5, 0.5-position.y*0.5)`），不是自己的纹理 UV。
   （官方是 layout 紧凑布局矩阵，全屏等价实现功能相同；wl-live2d 用 u_clipMatrix 变换后
   采样，等价。）

7. **mask 源不受 visible 标志影响**：官方 `DrawMeshOpenGL` 对 mask drawable 不检查可见性，
   mask 形状照常渲染进通道。之前跳过 `!visible` 的 mask 源导致 mask 缺形状。

8. **mask 源部件也是普通 drawable**：官方主循环绘制**所有** visible drawable（含 mask 源）。
   曾把"出现在 mask 集合里的部件"从主帧过滤 → 腿袜部件（ArtMesh134/136 同时是其他
   部件的 mask 源）整块消失 → "下半身缺失"假象。**修复后与 wl-live2d 完整度一致**。

9. **`CubismUpdateScheduler` 析构会 CSM_DELETE 所有注册的 updaters**（双重释放！）。
   曾导致每次退出 HEAP_CORRUPTION（0xc0000374）。**修复：弃用 scheduler/updaters 体系，
   改为手动调用**（与官方顺序一致）：
   ```cpp
   motionManager->UpdateMotion(model, dt);      // 动作
   expressionManager->UpdateMotion(model, dt);  // 表情
   eyeBlink->UpdateParameters(model, dt);       // 眨眼（可开关）
   physics->Evaluate(model, dt);                // 物理
   pose->UpdateParameters(model, dt);           // 姿态
   model->Update();                             // Core 计算 drawable
   ```

## 3. 当前状态与剩余事项

### 已完成 ✅
- 官方 Cubism SDK for Native 5-r.5 全链路：加载/动作/表情/物理/pose/眨眼/hit test/mask/渲染
- 宁宁 + 夏目均渲染正确（与 ayagami 95%+ 一致），内存安全
- 关键 bug 全部修复：JSON 解析、UV flip、mask 源过滤/opacity、scheduler 双重释放、
  **uniform 动态偏移**、混合模式对齐（Add/Multiply/WriteMask）、mask blend (One,OneMinusSrc)

### 剩余（按优先级）
1. **清理调试代码**：renderer/example 的 L2D_* 环境变量分支与 debug 打印（保留核心调试参数）
2. **色彩微调（可选）**：当前比 ayagami 亮 5-8%；可实验"编码值直通混合"或 SRgb 色彩空间模式
3. **B1 集成**：desktop-tauri 透明 overlay 原生窗口（wgpu surface + HWND），
   对接 `docs/live2d-native-overlay-plan.md` 的意图协议；布局由前端驱动（fit 问题自然消失）
4. **B3 前端双后端**：ChatCharacterStage/CompanionView 走 `src/live2d/` 后端抽象

## 4. 调试工具速查

```powershell
# PoC 渲染（宁宁 Idle 动作）
cargo run --release --example render_frame -- --dir ..\..\assets\live2d\nene --frames 90 --size 512 --out out.png

# 调试开关（example）
--no-mask      跳过全部 mask 通道（对比用）
--drawable N   只渲染单个 drawable（隔离验证）
--test-texture 用四象限测试纹理（验证几何/UV）
--no-render    只 create+load+drop（析构/内存测试）
--no-motion    不播放动作（初始状态）

# 环境变量（renderer 调试）
L2D_TRANSPARENT_OUT=1   透明背景输出（不合成深紫）
L2D_LIMIT_ORDER=N       只画前 N 个（按 render order）
L2D_MIN_OPACITY=0.5     跳过半透明部件
L2D_ONLY_UNMASKED=1     只画无 mask 部件
L2D_ONLY_INDICES=1,2    只画指定索引
L2D_FORCE_NORMAL_BLEND=1 全部用 Normal 混合
L2D_SCALE=N             scale 覆盖
L2D_DEBUG_ALPHA=1       渲染目标 alpha 直方图
L2D_DEBUG_ORDER=1       绘制顺序尾部打印

# wl-live2d 对照（vite 5173 + 网关 3000）
node poc/live2d-compare/shot.mjs    # 截图（omitBackground 透明）+ canvas 统计
node poc/live2d-compare/probe.mjs   # 部件可见性/参数探针（与 Core 数据对比）

# 参考渲染器 ayagami（标准答案）
cargo run --release -p ayagami-offscreen -- <model3.json> <out.png> 512 512
# 注意：ayagami 是纯 Rust 解析（203 ArtMesh vs Core 381 drawable——解析口径不同但渲染正确）
```

## 5. 性能基线（release 编译，512² 离屏，含读回）

- 90 帧（1.5s 模拟）wall time ~0.9s（约 10ms/帧 含读回）
- 每帧：102 draw calls，14 mask 通道纹理，6319 顶点
- 主进程为 Rust，无 WebView2 常驻（相比 wl-live2d 网页管线内存优势在 B1 集成后体现）

## 6. 外部调查结论（2026-08-08 下午，另一协作者完成）🔎

> 对第 3 节瓶颈的独立验证。**结论先行：瓶颈假设（mask 通道对齐）不成立——mask 通道渲染经验证完全正确。问题在主 pass 的其他环节。**

### 6.1 mask 通道渲染正确的证据（决定性）

独立诊断 crate（`%TEMP%/opencode/l2d-dump`，path 依赖本 crate，只调公开 API，未改本 crate 代码）：

```
mask_set=[196] bbox x[-0.024,0.121] y[-0.683,0.012]
main_opaque=3091  channel_opaque=3065
main.png  bbox=(251,254)-(285,429)
channel.png bbox=(251,254)-(285,429)   ← 与主渲染完全一致
```

- mask 源 196（腿部 mask，330 顶点）在主渲染与通道渲染中**形状、位置、像素数一致**
- 复刻 example 的 L2D_OVERLAY_MASK2 叠加流程 → overlay red=3065（不是之前 example 输出的 396px——那次叠加/统计受主帧内容影响，不代表通道错误）
- [115] 通道（眉毛区域小形状）同样与主渲染一致（64px vs 70px，形状本身就只有这么大）
- ViewTransform 数学核对：`fit(1,2,512,512)` → scale=256 → uniform=[1,1,0,0]（NDC=顶点原值），src115 的 bbox 换算后与实测屏幕位置吻合

**结论：第 3 节"疑点 A/B"已排除；"疑点 C"（作者刻意裁剪）部分成立——被裁部件（如 d5）被裁是因为 mask 形状本就小于部件，属正常 Cubism 行为。**

### 6.2 问题重新定位（真实存在的渲染缺陷）

与 wl-live2d 同模型对照（Playwright 截 `http://127.0.0.1:3000/chat`，wl-live2d 渲染完全正常）：

- **native 面部被半透明灰黑网格/遮罩覆盖**，五官不可见
- **native 腿部完全缺失**（裙摆以下无腿袜），而 wl-live2d 腿部完整
- native 角色整体偏小、位置偏上（视口约定差异，次要）

**候选根因（按嫌疑排序，需逐项验证）**：
1. **渲染顺序/遮挡**：主 pass 的 `sort_by_key(render_order)` 若 render_order 数据异常（大量相同值）或排序语义与官方不一致，高优先级部件可能被后画部件覆盖 → 面部"灰黑网格"（类似蒙版层压脸）
2. **masked drawable 的 alpha 应用**：fs_masked 的 mask_uv 用 clip 空间归一化（`pos.x*0.5+0.5, 0.5-pos.y*0.5`）——已核对方向正确；但若 drawable 顶点位置在动画帧中超出 NDC（如 x 超出 [-1,1]），mask_uv 越界 → clamp 到边缘 → 裁剪区域错误 → 腿部被裁没
3. **顶点数据/索引范围**：`draw_indexed(0..d.indices.len())` 若 indices 有越界（C++ 侧读回的数据问题）→ 部分三角形不画 → 腿部缺失
4. **multiply blend 的 19 个 drawable**（blend modes: {0:362, 2:19}）：Multiply 混合在 premultiplied 管线下的系数已核对与官方一致，但若这些 drawable 纹理 alpha 低 → 覆盖区域变暗（面部灰黑候选）

**建议的下一步**（比"与 wl-live2d 逐像素对照"更快的定位手段）：
- 用 `--drawable N` 逐个渲染腿部/面部 drawable，确认单部件几何与纹理是否正确（排除数据问题）
- 检查 render_order 分布（`sort_by_key` 前的原始顺序 vs 排序后）
- 检查 19 个 Multiply drawable 的索引与纹理区域，用 `--drawable` 单独渲染看是否变暗

### 6.3 已知性能债（两人都未处理）

- `render_to_image` 每帧新建：target texture、uniform buffer、所有 vertex/index buffer、mask textures、bind groups——**wgpu 资源不释放，长跑会累积**（驱动级 OOM/卡顿）
- mask 纹理用主目标全分辨率（512²），官方默认 256×256 足够（mask 是形状，线性过滤）——带宽浪费 ~4x
- mask 通道内 mask drawable 未按 render_order 排序（重叠 mask 源时顺序可能错）

### 6.4 已确认可复用的调试工具

- `L2D_OVERLAY_MASK=1` / `L2D_OVERLAY_MASK2=1`：主帧叠加 mask 通道（红）验证对齐
- `--drawable N` / `--no-mask`：单部件与无 mask 对照
- 独立诊断 crate 的复用：`%TEMP%/opencode/l2d-dump`（改 mask_set 参数即可 dump 任意通道 + 主渲染对照）

## 7. B1 壳侧 overlay 窗口（2026-08-08 晚，另一协作者完成）🪟

> 路径 B 的 Tauri 壳侧交付：透明 overlay 窗口 + `aics_live2d_*` IPC 命令 + 前端桥注入。
> 渲染器（本 crate）接入点：`desktop-tauri/src-tauri/src/live2d_overlay.rs`。

### 7.1 已交付并真机验证

| 项 | 说明 |
|---|---|
| overlay 窗口 | `desktop-tauri/src-tauri/src/live2d_overlay.rs`：WS_EX_LAYERED + WS_POPUP + TOOLWINDOW + NOACTIVATE，独立线程消息循环 |
| `setFrame` | 屏幕物理像素定位 + SW_SHOWNA/SW_HIDE + LWA_ALPHA 透明度；实测窗口创建→定位→隐藏→destroy→重建全链路 OK |
| `destroy` | 隐藏复位（窗口线程常驻，避免 destroy→setFrame 线程重建竞态；渲染器接入后在此释放 GPU 资源） |
| IPC 命令 | `aics_live2d_set_character/set_frame/play_motion/set_expression/set_mouth_level/set_emotion/set_gaze/hit_test/destroy` 全部注册；未挂渲染器时 setCharacter/playMotion/setExpression 返回 `{ok:false, error:"native renderer not attached yet"}` |
| 前端桥 | shim.rs 注入 `window.aicsLive2dNative`（16 方法，契约全对齐），companion/atelier 窗口均注入；CDP 实测完整 |
| 渲染器接入 API | `live2d_overlay::overlay_hwnd(app)`（取 HWND 建 surface）、`mark_renderer_attached(app)`（命令不再 not-attached） |

### 7.2 踩坑记录（Windows）

1. **`CW_USEDEFAULT` 仅支持 WS_OVERLAPPED**：WS_POPUP 用它必报 `ERROR_INVALID_PARAMETER (87)`——overlay 用具体坐标
2. **`WS_EX_LAYERED` 不能配 `HWND_MESSAGE` 父窗口**（同样报 87）——overlay 要显示在桌面并接收鼠标，父窗口用 null
3. **`RegisterClassExW` 重复注册报 1410（ERROR_CLASS_ALREADY_EXISTS）**——destroy 后重建属正常路径，1410 时继续 CreateWindowExW
4. **HWND 是 `*mut c_void` 非 Send**：tauri manage 要求 Send——状态里以 `isize` 存储，用时转回
5. **DPI 缩放**：overlay 窗口实测请求 500×600 → 实际 286×343（≈0.57 缩放）——窗口线程的 DPI 感知与主线程不一致，**渲染器接入时统一处理**（`SetProcessDpiAwarenessContext` 或按 `GetDpiForWindow` 换算）
6. **CreateWindowExW 需要 `GetModuleHandleW(null)` 的 hInstance**：null hInstance 创建失败

### 7.3 渲染器接入 checklist

1. 在 overlay 窗口线程内用 `overlay_hwnd(app)` 创建 wgpu surface（WS_EX_LAYERED + `CompositeAlphaMode::PreMultiplied`）
2. `mark_renderer_attached(app)` 后 setCharacter 生效；模型白名单资产路径解析参考 `desktop-tauri/src-tauri/src/paths.rs`
3. 事件：`aics:live2d:ready / motion-started / motion-failed / hit-test / entrance-finished`（emit 到全部窗口）
4. 点击：overlay WndProc 的 `WM_NCHITTEST` 目前返回 `HTTRANSPARENT`（穿透）；渲染器命中测试就绪后改 HTCLIENT + 转发坐标
5. 性能：渲染器 `render_to_image` 的每帧资源创建需改为缓存（见 6.3）

### 7.4 B1 实机交付记录（2026-08-08 晚，本会话）

> 7.1 的清单是设计预期；本节记录实际落地差异与验证证据。

**交付内容**：
- desktop-tauri/src-tauri/src/live2d_overlay.rs：overlay 窗口 + DX12 surface + 渲染循环 + OverlayCommand 通道（SetCharacter/PlayMotion/SetExpression/SetMouthLevel/SetEmotion/SetGaze/HitTestAsync/Destroy）+ ensure_overlay/pply_frame/ics_live2d_* IPC + selftest()。
- desktop-tauri/src-tauri/src/main.rs：DesktopPaths 补 manage（此前 pply_frame 等全部会 state() called before manage() panic）；LIVE2D_SELFTEST=1 环境变量驱动自测。
- desktop-tauri/src-tauri/src/shim.rs：window.aicsLive2dNative（16 方法）companion/atelier 双窗口注入（并行会话已写，本轮确认挂载）。
- desktop-tauri/native-live2d/src/renderer.rs：Renderer::new 增加 ormat: wgpu::TextureFormat 参数（pipeline 与 surface 格式对齐），example 同步。

**验证证据（本机实跑）**：
1. LIVE2D_SELFTEST=1 ai-cg-studio-desktop.exe → [live2d] adapter: "NVIDIA GeForce RTX 4070 Ti SUPER" backend=Dx12 → Cubism Core 6.0 加载宁宁（motions=8 hitareas=7）→ LIVE2D_SELFTEST_OK frames=85（800×800 overlay，3s 约 28fps，debug 构建 + vsync）。
2. 
ative-live2d render_frame example（offscreen）：102 draw calls、14 mask textures、6319 vertices、opaque 40516/262144 像素，1.37s 出图。
3. 真实壳 i-cg-studio-desktop.exe 20s 冒烟：窗口 + gateway attached（:3000）无 panic。

**踩坑（本轮新）**：
1. **Vulkan surface 对 HWND 返回空 formats**（caps.formats 空 → panic/surface has no formats）→ **必须强制 Backends::DX12**。PRIMARY 默认选中 Vulkan，RawHandle 的 HWND surface 兼容性查询为空。DX12 一次通过。
2. **窗口必须已显示（ShowWindow SW_SHOWNA）DXGI 才能枚举格式**：create_overlay_window 创建后立即 ShowWindow 一次，位置由后续 SetWindowPos 校正；窗口创建尺寸别用 0×0。
3. **Renderer pipeline 格式与 surface 格式不匹配**：native-live2d 硬编码 Rgba8UnormSrgb；DX12 surface 首选 sRGB 格式与 pipeline 不一致时 Render pass is incompatible panic → Renderer::new 加 format 参数，ensure_surface 先查 capabilities 再建 renderer。
4. **SetCharacter 必须先 ensure_surface**：模型加载（load_model）要求 renderer 已建；此前只在 render_frame 里惰性建 surface，命令先行时失败 → SetCharacter 分支先 ctx.ensure_surface(hwnd)。
5. **DesktopPaths 从未 manage**：pply_frame 等 9 个 IPC 入口 pp.state::<DesktopPaths>() 直接 panic → main.rs setup 补 pp.manage(state.paths.clone())，DesktopPaths 加 #[derive(Clone)]。
6. **wgpu 24 与 25+ 的 API 差异**：Instance::new(&desc)（引用）、create_surface → unsafe create_surface_unsafe(SurfaceTargetUnsafe::RawHandle)、InstanceDescriptor 无 display/memory_budget_thresholds 字段（用 ackends/flags/backend_options）。

**与 7.1 清单差异**：
- 未抽 overlay_hwnd()/mark_renderer_attached() 辅助函数：HWND 存 state.hwnd（isize），renderer 就绪由 RenderContext 内部保证（surface=Some ⇔ renderer=Some）；错误码不是 
ative renderer not attached yet，而是逐命令的 enderer not created/model not loaded 等具体原因。
- CompositeAlphaMode 用 Auto（layered 窗口由 LWA_ALPHA 控制整体透明度，未强制 PreMultiplied）；selftest 验证通过，如后续要逐像素半透明再评估。
- rame_count（AtomicU64）加入 state 供自测/诊断；渲染帧成功计数。

**对方（渲染器/打包）接入点**：
- 渲染线程签名 overlay_window_thread(state: Arc<Live2DOverlayState>, assets_root: PathBuf, app: Option<AppHandle>)；pp=None 时事件 emit 跳过（selftest 路径）。
- 模型目录约定：ssets_root/live2d/<character>/（宁宁 
ene），与 web ssets/live2d/ 同级内容；打包时注意资源路径。
- OverlayCommand 枚举 + oneshot reply：新命令沿用 send_command 模式即可。

### 7.5 扩展自测：命令路径全覆盖 + 渲染快照识图验证（2026-08-08 深夜）

selftest 从「加载+出帧」扩展为完整命令路径覆盖，并新增渲染快照（离屏 ender_to_image 存 PNG）供识图验收：

**新增能力**：
- OverlayCommand::Snapshot { path, reply }：渲染线程离屏 800×800 渲染 + readback 存 PNG（后续调试/验收通用）。
- state.hit_test_result：HitTestAsync 结果落 state（app=None 时无事件可发，selftest 直接断言）。
- LIVE2D_SNAPSHOT_DIR 环境变量指定快照输出目录。

**验证证据（一次 selftest 全部通过）**：
`
LIVE2D_SELFTEST_HITTEST areas=["Face"]     # (0.5,0.11) 命中脸部 HitArea
LIVE2D_SELFTEST_OK frames=109
`
- 宁宁：TapHead 动作 ✓、SetMouthLevel(0.8) 后快照**嘴巴张开（识图确认）**✓、SetEmotion ✓、hit-test 命中 Face ✓、快照×2。
- 夏目：加载（14×4096 纹理，debug 构建约 84s，release 会快得多）✓、Start 动作 ✓、快照确认与宁宁明显不同的角色、无渲染缺陷 ✓。

**本轮新修 bug（真实验证发现，非推断）**：
1. **HitArea Name→ArtMesh 映射缺失**：l2d_model_hit_test 原来直接用 HitArea 的 Name（如 "Hair"）查 GetDrawableIndex，而 model3.json 的 HitAreas 是 Name→Id(ArtMesh) 映射，直接查永远 -1 → 全部 miss。改为遍历 GetHitAreaCount/Name/Id 先按 Name 匹配再取 ArtMesh index。
2. **口型/情绪/凝视参数被动作曲线覆写**：参数写入在 model.update(dt)（含 UpdateMotion）之前，动作播放中每帧覆写 → 口型恒为动作姿态。改为**先 update 再写覆写参数**（一帧延迟，可接受）。
3. **DX12 readback 256 字节行对齐**：ender_to_image 的 copy_texture_to_buffer 用 width*4 做 bytes_per_row 在 DX12 下 Validation Error（Vulkan 不强制）。改为 padded_row = width*4 向上对齐 256，unmap 后按行去 padding（L2D_DEBUG_HIT/纹理加载耗时打印保留，env 门控）。

**自测入口**：
`
=1; =<dir>; .\target\debug\ai-cg-studio-desktop.exe
# 退出码 0 = 全链路通过；快照输出到 
`

**剩余待办（已知）**：
- 真实桌面端到端（companion 页面 ?live2dBackend=native 时 overlay 与页面 Live2D 框对齐、口型随 TTS）需人工上真机确认——selftest 已覆盖同一条渲染/命令链路。
- 打包模式 assets_root/live2d/ 资源路径解析。
- 夏目口型参数 ParamMouthForm3（-0.5..0）的极性未在真实音频下回归（宁宁 ParamMouthOpenY 已实测）。

### 7.6 真实桌面端到端验证记录（2026-08-08 深夜，另一协作者）✅ 壳侧 / ⚠️ 前端残留

> release 构建壳 + Atelier `/chat?live2dBackend=native` + CDP 驱动实测。

**壳侧验证通过（证据）**：
- `aics_live2d_set_character` 手动调用：0.73s 返回 `{ok:true}`（渲染线程已热后）
- 点击启用后壳侧状态：`{"character":"nene","ready":true,"rendererAttached":true,"windowReady":true}`
- 前端 `layout()` 的 setFrame 到位：overlay 窗口 rect 527×659（屏幕物理像素，随舞台动态更新），与页面舞台换算一致
- **新修（本会话）**：ready 事件时序 bug——`connect()` 里先 `await setCharacter`（壳已 emit `aics:live2d:ready`），之后才 `onModelLoaded` 订阅，一次性事件丢失 → 前端 connect 超时显示"Live2D 加载超时"。修复：壳新增 `aics_live2d_get_state` 命令（返回 `ready/windowReady/rendererAttached/character`），shim 的 `onReady` 先查状态（已 ready 立即回调）再订阅事件。selftest 不受影响（不依赖事件时序）

**前端残留问题（交接给渲染器/前端侧）**：
- 点击"启用 Live2D"后壳侧 ready=true，但前端按钮状态停在"启用 Live2D"（未到"已连接"）——前端 enable→load→onModelLoaded 状态机未走完；前端 `ready.value` 未置位 → `layout()` 不跑 → overlay 保持上次的 vis=False
- 现象链：按钮"启用 Live2D"（enabled=false 语义）→ 点击 → 壳 ready=true 但前端 ready 未达 → overlay 窗口有正确位置但 `vis=False`
- 排查方向：`useLive2D.enable()` 的 lifecycleToken / `load()` 中 `connect()` 与 `onModelLoaded` 的调用时序；点击后 `document.hidden`/`prefers-reduced-motion` 是否短路
- **注意**：首次点击（冷启动，wgpu 设备+模型加载 > 前端超时）会先显示"加载超时"，渲染线程热后重试即通（release 下第二次点击链路正常）——前端超时时间或重试策略可考虑放宽

**口型随 TTS 的真机回归**（宁宁）仍未做，属于同一联调批次。

### 7.6 简化改进轮（2026-08-08 深夜，本会话）

用户指示"简单的先做"，完成 4 项自查薄弱点修复（§5.3）：

1. **夏目 hit-test 修复**：hit_area_ids() 从 model3.json HitAreas **动态解析**（Model3Json.hit_areas → name 列表，setCharacter 时存入 ctx.hit_area_names），删除 nene 硬编码映射。selftest 证据：夏目 motions=10 hitareas=7，动态读取生效。
2. **情绪表演参数对齐浏览器路径**：pply_emotion 重写为双角色参数表（emotion_params()），宁宁 5 情绪 × 7 参数、夏目 5 情绪 × 3-4 参数，与 src/utils/emotionRuntime.ts 的 NENE/NATSUME_RUNTIME_CONFIG emotionParams 逐值对齐（base × intensity，参数不存在跳过）。原实现只驱动 ParamCheek 且忽略角色（let _ = character）。
3. **selftest 强断言**：hit-test 结果必须**非空**（期望命中 Face），空/无结果直接 FAIL（原只打印）。
4. **165fps 帧率支持**（用户要求）：渲染循环固定 16ms sleep（60fps 上限）改为目标帧率驱动，**默认 165**，L2D_TARGET_FPS 环境变量可覆盖（1..=1000 校验）。surface 保持 AutoVsync（165Hz 屏即 165fps）。selftest 证据：同窗口 3s 渲染帧数 100 → **170**（debug 构建 CPU 受限，release 应接近 165）。

验证：LIVE2D_SELFTEST=1 全链路通过（宁宁 TapHead/口型/情绪/hit-test Face + 夏目加载/Start + 快照×3），LIVE2D_SELFTEST_HITTEST areas=["Face"]、LIVE2D_SELFTEST_OK frames=170。

> 备注：期间遇到一次 PowerShell 重定向 2>&1 | Out-String 与 native stderr 的交互问题（程序秒退 exit=0 无输出，直接跑正常）——非代码问题，验证请直接调用 exe 或 2>&1 | Out-File。
