/** Escape each text segment after matching, so HTML entities cannot split a match. */
export function highlightSearchText(text: string, query: string): string {
  const source = String(text ?? '')
  const needle = String(query ?? '').trim()
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (!needle) return escape(source)
  const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  let result = '', cursor = 0
  for (const match of source.matchAll(pattern)) {
    const index = match.index!
    result += escape(source.slice(cursor, index)) + '<mark class="search-hl">' + escape(match[0]) + '</mark>'
    cursor = index + match[0].length
  }
  return result + escape(source.slice(cursor))
}
