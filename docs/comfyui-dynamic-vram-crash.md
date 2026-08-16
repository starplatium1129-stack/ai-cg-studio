# ComfyUI DynamicVRAM 卡死疑难留档（2026-08-17）

> 现象 → 根因 → 修复 → 验证。后续 ComfyUI 再出现「任务无进度 + GPU 满转 +
> 服务器挂」先查本档，不要再从零排查。

## 现象

- 绘图页/视频页提交 **15 秒 H3 图生视频**后：
  - ComfyUI 日志：`got prompt` 后 **29 分钟无任何进度**（无采样进度条）；
  - `nvidia-smi`：**GPU 利用率 99%、显存 15.5/16.4GB 占满**（进程满负荷空转）；
  - 最终 ComfyUI HTTP 服务器瘫痪：`Task exception was never retrieved ...
    OSError(22, '指定的网络名不再可用')` + `Accept failed on a socket`（8188 停止接受连接）；
  - python 进程不死，变成僵尸占着 GPU 与显存。

## 根因

- ComfyUI 0.31 检测到 `comfy-aimdo`（0.4.13）安装后**自动启用 DynamicVRAM**
  （`main.py`: `aimdo_enabled = True`，无默认关闭开关，仅 `--disable-dynamic-vram` 可关）；
- DynamicVRAM 用 AIMDO 做模型权重的 mmap/搬运。**大权重搬运（H3 20GB staged、
  16GB 卡必须动态换入换出）时 AIMDO 卡死**，任务永远进不了采样阶段；
- 前科：08-14 日志同模块报过 `RuntimeError: hostbuf_file_reader_read failed`
  （`comfy_aimdo.host_buffer.read_file_to_device`）；
- 官方已知不稳定：`main.py` 警告文案明说 dynamic vram 出问题可报告、该参数
  即将移除；5s/10s 任务权重小未触发（当晚 4 个 5s H3 任务正常）。

## 修复

1. 杀掉僵死进程（释放 GPU/显存）；
2. 用**系统 Python**（用户实际启动路径）重启 ComfyUI，**必须带
   `--disable-dynamic-vram`**（回退 legacy ModelPatcher 传统 lowvram 卸载路径）：

   ```
   python -u E:\code\2\lora\AI\ComfyUI\main.py --listen 127.0.0.1 --port 8188 --disable-pinned-memory --disable-dynamic-vram
   ```

3. 启动脚本：`scripts/maintenance/start-comfyui.ps1`（带参数 + 日志重定向 +
   健康检查，纯 ASCII）。

## 验证

- 重启后 8188 健康检查通过、`vram_free` 回到 ~14.8GB（干净）、Anima online=True；
- 后续用户实测 15s 任务正常（确认后此处打勾）。

## 边界与备注

- **用户手动启动 ComfyUI 时也必须带 `--disable-dynamic-vram`**，否则复发；
- `--disable-dynamic-vram` 会回退传统 lowvram 卸载，15s 长视频可能比
  DynamicVRAM 理论速度慢，但不会卡死（稳定性优先）；
- 日志位置：`E:\code\2\lora\AI\ComfyUI\user\comfyui_8188.log`（执行日志）、
  `comfyui-run.log/.err.log`（本次重启后 stdout/stderr）。
