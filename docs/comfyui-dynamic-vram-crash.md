# ComfyUI DynamicVRAM 卡死疑难留档（2026-08-17）

> 现象 → 根因 → 修复 → 验证。后续 ComfyUI 再出现「任务无进度 + GPU 满转 +
> 服务器挂」先查本档，不要再从零排查。**最终结论已更新（2026-08-17 深夜）：
> 稳定组合 = ComfyUI b1693ec(8-02 v0.30.0) + comfy-aimdo 0.4.8 + DynamicVRAM 默认参数。**

## 现象

- 绘图页/视频页提交 **15 秒 H3 图生视频**（Anima 出图后切换 H3）：
  - ComfyUI 日志：`got prompt` 后 **29 分钟无任何进度**（无采样进度条）；
  - `nvidia-smi`：**GPU 利用率 99%、显存 15.5/16.4GB 占满**（进程满负荷空转）；
  - 最终 ComfyUI HTTP 服务器瘫痪：`Task exception was never retrieved ...
    OSError(22, '指定的网络名不再可用')` + `Accept failed on a socket`（8188 停止接受连接）；
  - python 进程不死，变成僵尸占着 GPU 与显存。

## 根因（复现 4 次 + 对照实验定位）

- ComfyUI 0.31.0（8-07）+ comfy-aimdo **0.4.13** 时，**「显存有 Anima 驻留 →
  加载 H3 主模型（20GB staged）」的组合必死锁**：卡在 `MiniMaxH3TEModel_
  prepared` 之后、`Requested to load MiniMaxH3` 之前，AIMDO 的卸载/搬运规划
  死锁（GPU 99% 空转）。对照实验：显存干净时 H3 冷加载**成功**；
  H3 连续跑（驻留复用）**成功**；H3→Anima 切换（4GB 小模型）**成功**。
- 对应上游回归：Comfy-Org/ComfyUI [issue #15255](https://github.com/Comfy-Org/ComfyUI/issues/15255)
  「Dynamic VRAM streaming crashes ... regression after Aug 3 2026 update」
  （8-03 的 pin-memory 改动 #15266 为嫌疑；PR #15348 只修 init 失败回退，
  不修运行时卡死）。0.4.13 已是最新版，无更新可升。
- 前科：08-14 同模块报过 `RuntimeError: hostbuf_file_reader_read failed`。

## 修复（最终锁定）

1. **ComfyUI 回退到 8-02 的 b1693ec（v0.30.0）**：`git -C <ComfyUI> checkout b1693ec`
   （8-03 回归之前、含 H3 支持 57500fc）；
2. **comfy-aimdo 回退到 0.4.8**：`venv\Scripts\python -m pip install comfy-aimdo==0.4.8`；
3. **启动参数用全默认**（不加 `--disable-dynamic-vram`、不加 `--disable-pinned-memory`）；
4. 启动脚本：`scripts/maintenance/start-comfyui.ps1`（v2，锁定上述组合）。

## 验证

- 稳定组合下全链路实测：**Anima 出图 78s + H3 15s 视频 503s = 583s 端到端成功**
  （脚本 `scripts/maintenance/repro-h3-15s.js`，BUDGET=620）；
- 失败组合对比：8-07+0.4.13 ❌ / 8-02+0.4.13 ❌ / 8-02+0.4.8 ✅。

## 边界与备注（重要）

- **内存（RAM）高占用是 DynamicVRAM 机制**：20GB H3 模型 staged 到系统内存
  （host buffer），按需换入显存——32GB 内存实测占用 ~29GB，属正常，不是故障；
  传统模式（--disable-dynamic-vram）RAM 低但慢。
- **16GB 卡跑 20GB 模型的物理速度**：H3 15s 每步 ~84s、整片 ~8.4 分钟；
  「别人 3060Ti 随便跑」不成立（8GB 卡只会更慢，多半是 5s/10s 或旧版本）。
- **venv 的 python.exe 会显示为两个进程**（venv launcher + base 解释器），
  是**一个实例**，不要只杀其中一个。
- 用户手动启动 ComfyUI 请用 `start-comfyui.ps1`，保持稳定组合。
- 日志位置：`E:\code\2\lora\AI\ComfyUI\user\comfyui_8188.log`（执行日志）、
  `comfyui-run.log/.err.log`（stdout/stderr）。
