import { describe, expect, it } from 'vitest'
import { highlightSearchText } from './highlightSearchText'

describe('search highlighting', () => {
  it('matches the original characters without corrupting escaped entities', () => {
    expect(highlightSearchText('A&B <tag>', '&')).toBe('A<mark class="search-hl">&amp;</mark>B &lt;tag&gt;')
    expect(highlightSearchText('<img>', 'lt')).toBe('&lt;img&gt;')
  })
  it('escapes markup in matched and unmatched text', () => {
    expect(highlightSearchText('<script>alert(1)</script>', '<script>')).toBe('<mark class="search-hl">&lt;script&gt;</mark>alert(1)&lt;/script&gt;')
    expect(highlightSearchText('a.b A.B', 'a.b')).toBe('<mark class="search-hl">a.b</mark> <mark class="search-hl">A.B</mark>')
    expect(highlightSearchText('a+b', '+')).toBe('a<mark class="search-hl">+</mark>b')
  })
})
