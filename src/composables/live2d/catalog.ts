/**
 * Live2D 目录（/api/live2d-status）宽松解析（拆分 Step 1 自 useLive2D.ts 原样搬出）。
 * 纯函数：未知字段给安全默认值，顶层格式错误立即抛错。
 */

export interface Live2DModelInfo {
  available: boolean
  modelUrl: string
  source: string
  missing: string[]
  canvas?: { width: number; height: number }
}

export interface Live2DCatalog {
  models: Record<string, Live2DModelInfo>
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readLive2DCatalog(value: unknown): Live2DCatalog {
  if (!isRecord(value) || !isRecord(value.models)) throw new Error('Live2D 状态响应格式无效')
  const models: Record<string, Live2DModelInfo> = {}
  for (const [character, raw] of Object.entries(value.models)) {
    if (!isRecord(raw)) continue
    models[character] = {
      available: Boolean(raw.available),
      modelUrl: typeof raw.modelUrl === 'string' ? raw.modelUrl : '',
      source: typeof raw.source === 'string' ? raw.source : '',
      missing: Array.isArray(raw.missing) ? raw.missing.filter((item): item is string => typeof item === 'string') : [],
      canvas: isRecord(raw.canvas)
        ? { width: Number(raw.canvas.width) || 420, height: Number(raw.canvas.height) || 610 }
        : undefined,
    }
  }
  return { models }
}
