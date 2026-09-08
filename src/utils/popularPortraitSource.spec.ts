import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPopularPortraitPending, popularPortraitSrc } from './popularPortraitSource'
import { loadPortraitCloud } from './particlePortrait'

afterEach(() => vi.unstubAllGlobals())

describe('registered characters without generated portraits', () => {
  it.each(['raphtalia', 'chloe_von_einzbern', 'maomao', 'togawa_sakiko'])('shows an explicit placeholder for %s', id => {
    expect(isPopularPortraitPending(id)).toBe(true)
    expect(popularPortraitSrc(id, 42)).toBe('/assets/characters/portrait-pending.svg')
  })
  it('preserves existing portrait paths and versioned caching', () => {
    expect(isPopularPortraitPending('katou_megumi')).toBe(false)
    expect(popularPortraitSrc('katou_megumi', 42)).toBe('/assets/characters/thumbs/popular-katou_megumi.webp?v=42')
  })
  it('does not request a nonexistent particle asset for a pending portrait', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await loadPortraitCloud('raphtalia')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
