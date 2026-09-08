/** Copy only after an explicit user action; never read the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  if (!text || typeof document === 'undefined') return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* Older webviews and denied permissions can still support selection copy. */ }
  const active = document.activeElement as HTMLElement | null
  const selection = document.getSelection()
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : []
  const field = document.createElement('textarea')
  field.value = text
  field.readOnly = true
  field.setAttribute('aria-label', '待复制内容')
  field.style.position = 'fixed'
  field.style.left = '-10000px'
  // Keep the fallback in the active modal: the rest of the document may be inert.
  const host = active?.closest('dialog[open], [role="dialog"], [role="alertdialog"]') || document.body
  try {
    host.append(field)
    field.select()
    return typeof document.execCommand === 'function' && document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
    active?.focus({ preventScroll: true })
    if (selection) { selection.removeAllRanges(); for (const range of ranges) selection.addRange(range) }
  }
}
