export interface ChatModel {
  name: string
  parameters?: string
}

export interface ChatStatus {
  online: boolean
  model: string
  models: ChatModel[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseChatStatus(value: unknown): ChatStatus {
  const status = isRecord(value) ? value : {}
  const models = Array.isArray(status.models)
    ? status.models.flatMap((item): ChatModel[] => {
        if (!isRecord(item) || typeof item.name !== 'string' || !item.name.trim()) return []
        const parameters = typeof item.parameters === 'string' && item.parameters.trim()
          ? item.parameters
          : undefined
        return [{ name: item.name.trim(), parameters }]
      })
    : []
  return {
    online: status.online === true,
    model: typeof status.model === 'string' ? status.model : '',
    models,
  }
}
