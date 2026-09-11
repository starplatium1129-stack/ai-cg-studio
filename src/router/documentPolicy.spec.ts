import { describe, expect, it, vi, afterEach } from 'vitest'
import { needsDocumentReload } from './documentPolicy'

afterEach(() => vi.unstubAllGlobals())
describe('document CSP boundaries', () => {
  it.each(['/chat', '/companion', '/chat/', '/companion?source=home'])('reloads both ways for %s in a fresh session', path => {
    expect(needsDocumentReload('/', path)).toBe(true)
    expect(needsDocumentReload(path, '/gallery')).toBe(true)
  })
  it('does not depend on available browser storage', () => {
    vi.stubGlobal('sessionStorage', { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } })
    expect(needsDocumentReload('/gallery', '/chat')).toBe(true)
    expect(needsDocumentReload('/chat', '/companion-chat')).toBe(true)
  })
  it('keeps same-policy navigation inside the SPA', () => {
    expect(needsDocumentReload('/chat', '/companion')).toBe(false)
    expect(needsDocumentReload('/', '/gallery')).toBe(false)
    expect(needsDocumentReload('/companion-chat', '/control')).toBe(false)
  })
})
