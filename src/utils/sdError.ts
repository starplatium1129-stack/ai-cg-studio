// SD 出图错误分类与恢复建议 — 从重构前 tools/sd-error.js 迁移
// 目的：失败时给出可执行的下一步，而不是丢一句 "生成失败"

export type SDErrorKind =
  | 'cancelled' | 'oom' | 'lora' | 'model' | 'sampler'
  | 'timeout' | 'gateway' | 'offline' | 'parameters' | 'unknown'

export type SDRecoveryId =
  | 'retry_light' | 'retry_without_lora' | 'retry_current_model'
  | 'retry_safe_sampler' | 'recheck_connection' | 'open_settings'

export interface SDRecoveryAction {
  id: SDRecoveryId
  label: string
}

export interface SDErrorReport {
  kind: SDErrorKind
  title: string
  message: string
  action: SDRecoveryAction | null
  details: string
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function errorRecord(error: unknown): Record<string, unknown> {
  return typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : {}
}

export function errorText(error: unknown): string {
  const source = errorRecord(error)
  let message = clean(source.message || (typeof error === 'string' ? error : ''))
  const detail = clean(source.detail)
  if (detail && !message.includes(detail)) message += (message ? ' · ' : '') + detail
  return message.slice(0, 1200)
}

function report(
  kind: SDErrorKind, title: string, message: string,
  action: SDRecoveryAction | null, details: string,
): SDErrorReport {
  return { kind, title, message, action, details }
}

export function classifySDError(error: unknown): SDErrorReport {
  const source = errorRecord(error)
  const text = errorText(error)
  const lower = text.toLowerCase()
  const status = Number(source.status) || 0
  const name = clean(source.name)

  if (name === 'AbortError') {
    return report('cancelled', '已停止生成', '本次任务已停止，参数与 Prompt 都保留在当前页面。', null, text)
  }
  if (/cuda out of memory|out of memory|outofmemory|显存不足|显存溢出|vram/.test(lower)) {
    return report('oom', '显存不足',
      '当前尺寸或高清修复占用过高。可先关闭 hires.fix 并降低尺寸后重试。',
      { id: 'retry_light', label: '降低负载后重试' }, text)
  }
  if (/lora.*(not found|missing|could not|cannot find)|could not find.*lora|unknown lora|找不到.*lora/.test(lower)) {
    return report('lora', 'LoRA 不可用',
      '当前角色 LoRA 在 WebUI 中不可用。可临时跳过 LoRA 生成，之后再检查文件与路径。',
      { id: 'retry_without_lora', label: '跳过 LoRA 重试' }, text)
  }
  if (/checkpoint.*(not found|missing|could not|cannot find)|model.*(not found|missing|could not find)|找不到.*模型|找不到.*checkpoint/.test(lower)) {
    return report('model', '模型不可用',
      '上次选择的模型在当前 WebUI 中不可用。可切换回 WebUI 当前模型后重试。',
      { id: 'retry_current_model', label: '改用当前模型重试' }, text)
  }
  if (/sampler.*(not found|invalid|unknown)|scheduler.*(not found|invalid|unknown)|采样器.*(不存在|无效)|调度器.*(不存在|无效)/.test(lower)) {
    return report('sampler', '采样器设置不可用',
      '当前 WebUI 不支持这组采样器或调度器。可恢复为通用稳定组合后重试。',
      { id: 'retry_safe_sampler', label: '恢复稳定采样器重试' }, text)
  }
  if (name === 'TimeoutError' || /请求超时|timed out|timeout/.test(lower)) {
    return report('timeout', '生成超时',
      'WebUI 可能仍在加载模型或当前负载过高。降低尺寸与高清修复后通常更容易完成。',
      { id: 'retry_light', label: '降低负载后重试' }, text)
  }
  if (status === 404) {
    return report('gateway', 'SD 网关不可用',
      '当前页面没有可用的 SD API 代理。请从控制面板或 node server.js 打开工作台。',
      { id: 'open_settings', label: '查看出图参数' }, text)
  }
  if (name === 'NetworkError' || status === 502 || status === 503
      || /未响应|无法连接|connection refused|econnrefused|network/.test(lower)) {
    return report('offline', 'SD WebUI 未连接',
      '请确认 WebUI 已启动并启用 --api；恢复后可重新检测连接，不会自动提交生成。',
      { id: 'recheck_connection', label: '重新检测连接' }, text)
  }
  if (status === 400 || /validationerror|invalid request|bad request|参数.*无效/.test(lower)) {
    return report('parameters', '出图参数被拒绝',
      '模型端拒绝了当前参数组合。请检查模型、尺寸、采样器与 hires.fix 设置。',
      { id: 'open_settings', label: '查看出图参数' }, text)
  }
  return report('unknown', '生成失败',
    '已保留 Prompt 与当前参数。可检查出图参数后再次提交。',
    { id: 'open_settings', label: '查看出图参数' }, text)
}

/** 稳定回退组合：采样器/调度器不被支持时用 */
export const SAFE_SAMPLING = { sampler: 'Euler a', scheduler: '' }

/** 降负载方案：OOM / 超时时用 */
export const LIGHT_LOAD = { size: '832x1216', hiresFix: false }
