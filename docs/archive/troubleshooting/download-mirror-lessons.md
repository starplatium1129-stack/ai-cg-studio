# ModelScope 大文件并发分段下载疑难（2026-08-21 留档）

> 场景：用国内镜像下载 Qwen3.8-27B 两个 GGUF（→ `E:\tools\llama-cpp\models\`）。
> 本档记录「现象 → 根因 → 修复 → 验证」，避免后续会话/协作者重复踩坑。

## 现象

1. **8 段 Range 并发下载（每段 ~1.5GB）被误判为卡死**：启动后 20 秒抽查，8 个分片全部 0 字节，
   就认为并发有问题并去 kill；实际这些段在几十秒的「连接建立慢启动」后开始正常涨数据
   （kill 前已各自下到 600~775MB）。**结论：ModelScope CDN 对并发大 Range 有慢启动/连接排队，不能 20 秒就判死。**
2. `--retry-all-errors --retry-delay 3` + `--max-time 3600` 会让 curl 在连接被并发压掉时
   **无限重试、永远停在 0 字节**（每次尝试 <1s 就失败，然后 sleep 3s 再来）。
3. DSH harness 的**后台任务里套 `Start-Job`** 调 curl 会卡 0 字节（进程管道被沙箱限制），
   但同一命令在**前台**或**后台直接调 curl** 都正常 —— 后来归因测试确认前台/后台直连都能写盘。

## 根因

- ModelScope 直链 `modelscope.cn/models/<ns>/<repo>/resolve/master/<file>` 会 302 到
  `cdn-lfs-cn-1.modelscope.cn/...?auth_key=...`（签名 URL，每次请求重新解析，无过期问题）。
- **HEAD/Content-Length 靠不住**（302 链上拿不到真实长度），要拿真实总长用：
  `curl -sL --range 0-0 -D - -o NUL <resolve-url>` 解析 `Content-Range: bytes 0-0/<total>`。
- 并发大段在连接层被限流/排队 → 短窗口内只见 0 字节；`--retry-all-errors` 把这种瞬时失败
  变成无限空转。

## 修复（实锤有效的组合）

- **每段一条独立后台任务，直接 `curl`（不要 Start-Job）**：
  `curl.exe -sL --connect-timeout 20 --max-time 1800 -r <start>-<end> -o <part> <url>`，
  **不要** `--retry-all-errors`（需要重试就裸 `--retry N`）。
- 8 段并发启动，**等完成通知/等待 job 结束，不要 20~30 秒抽查就 kill**。
- `dl-seg.ps1` 已同步为 `--retry 3`（不加 `--retry-all-errors`）和 1800s 单段上限，避免连接失败时空转。
- 收尾：逐段校验长度 → 拼接 → `Get-FileHash` sha256 → 与 HF LFS oid 比对 → 移入 models\。
- 复用脚本（在 `E:\tools\llama-cpp\`）：`dl-seg.ps1`（单段下载）+ `concat-verify.ps1`（拼接校验入库）。

## 验证（2026-08-21）

| 文件 | 大小 (B) | sha256 (=HF LFS oid) | GGUF 头 |
|---|---|---|---|
| Qwen3.8-27B-UD-IQ3_S.gguf | 12,040,883,104 | d847e2c1e4aa276e4b7b8e9ad7628050e61e165d49ab995407bc36677a6f3864 | VALID, qwen35/65层 |
| Qwen3.8-27B-IQ4_XS-4.00bpw.gguf | 13,663,372,416 | d5193a4981982d384550bf0eb26032d32b7f9a0dc2be300b4bf421eaf87d6235 | VALID, qwen35/65层 |

## 测速参考（本机实测，2026-08-21）

- ModelScope 单流 ~28~33MB/s（10s 测速），8 段并发的慢启动期过后总量约 70~100MB/s。
- hf-mirror 单流 ~17~19MB/s。→ 大 GGUF 优先 ModelScope 直链。
- LLM 权重若在 HF，先 `huggingface.co/api/models/<repo>/tree/main?recursive=true` 取
  `lfs.size` 与 `lfs.oid`(sha256)，ModelScope 同名仓库 resolve/master 常直接可用。

## 附：Qwen3.8 llama.cpp 配置要点（2026-08-21，`E:\tools\llama-cpp`）

推荐参数已落地 `start-server.ps1`（agent/chat 双模式 + `-DryRun`/`-NoVision`）与 `control-panel.ps1`；
所有 flag 在 build 10516 实测均通过。已实测的坑与显存账：

- **`--cache-type-k g4_0` 是坑**：build 10516 只接受 f32/f16/bf16/q8_0/q4_0/q4_1/iq4_nl/q5_0/q5_1，
  `g4_0`（新版格式）直接报 `Unsupported cache type: g4_0`。本机用等价 `q4_0`；升级新版 llama.cpp 后可换回。
- **`--reasoning on` + 客户端 `max_tokens` 给小了 → content 返回空**：思考 token 先吃掉预算，
  只剩 reasoning_content、正文为空。客户端必须给足 max_tokens（thinking+answer，实测 256+ 才稳），
  或调低 `--reasoning-budget`。
- **16G 卡显存账（实测 MiB）**：
  - agent IQ3_S @96K 无视觉 = 15508（94.7%）
  - chat  IQ4  @64K 无视觉 = 15797（96.5%）
  - agent IQ3_S @48K + mmproj = 15249（93.1%）
  - chat  IQ4  @32K + mmproj = 15922（97.2%）
  - 结论：视觉与长上下文不可兼得；脚本在「加载到 mmproj」时自动降 ctx（agent 48K / chat 32K），
    `-NoVision` 拿最大 ctx。
- **Qwen-VL 提示**：加载日志会打 `require at minimum 1024 image tokens` 警告；接地/定位类图像任务
  精度不足时加 `--image-min-tokens 1024`（基础图像描述实测无需）。
- **`v22_chat_template.jinja`** 本机暂无（`models\` 也没有）；缺它时 reasoning 照常（内置模板，effort
  默认档），放入该 jinja 后脚本自动启用 `reasoning_effort=xhigh`，无需改代码。
- **vision 模式（纯视觉辅助，2026-08-21；2026-08-21 配置收口）**：`start-server.ps1 -Mode vision`（或面板第三档）
  = IQ4 @16K + **3 slots** + `--image-min-tokens 1024` + reasoning off + `ubatch 256`
  （实测显存约 15.8/16.0GB，16G 卡压线但稳定）。现有 `audit_direct.json` 已验证三路同时完成。
  与项目 `scripts/maintenance/image-inspect.js` 兜底后端对接：主端点 `:8317` 不可用时自动
  `[fallback]` 到 `127.0.0.1:8000/v1`，模型 ID 自动取 `/v1/models`；批量首轮使用 `--concurrency 3`，
  输出上限建议 1600 tokens，定稿候选和争议结果再以 Gemini 终审。实机测得大图视觉预填充可低至约
  3.55 prompt tokens/s，首次或大图审核不应以 180s/300s 超时判死；启动后必须跑 `warmup.ps1`，审核快捷
  脚本默认给每张 900s。`warmup.ps1` 现在仅在视觉预热成功时才返回成功，失败会返回非零退出码，避免误报 ready。
- **tok/s 实测（q4_0 KV + MTP 投机解码）**：prefill ~1280~1600 tok/s；decode 带投机
  agent(IQ3_S) 62~66、chat(IQ4) 46 tok/s；llama-bench 无投机 tg39.4 / pp1512 → MTP 提速约 +60%。
- **冷启动一次性慢**：首次请求可能极慢（IQ4 完整 mmap 进显存实测 268s），之后有 OS 文件缓存即正常；
  启动后可先发一个最小请求预热。
