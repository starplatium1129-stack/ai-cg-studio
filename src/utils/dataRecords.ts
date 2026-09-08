export function requireDataCollection(value: unknown, key: string): unknown[] {
  const collection = Array.isArray(value) ? value : value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined
  if (!Array.isArray(collection)) throw new Error(`${key} 必须是数组`)
  return collection
}

/** 必需 JSON 不允许把损坏数据转换为空列表并缓存为加载成功。 */
export function requireDataRecords(value: unknown, label: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) throw new Error(`${label} 必须是数组`)
  const ids = new Set<string>()
  return value.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || typeof row.id !== 'string' || !row.id.trim()) {
      throw new Error(`${label} 第 ${index + 1} 条缺少有效 id`)
    }
    if (ids.has(row.id)) throw new Error(`${label} 包含重复 id：${row.id}`)
    ids.add(row.id)
    return row as Record<string, unknown>
  })
}
