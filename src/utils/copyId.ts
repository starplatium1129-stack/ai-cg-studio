/** Repeated copies must remain independently addressable in an unsaved draft. */
export function nextCopyId(source: string, existing: string[]): string {
  const ids = new Set(existing)
  const base = `${source}_copy`
  let id = base
  for (let n = 2; ids.has(id); n++) id = `${base}_${n}`
  return id
}
