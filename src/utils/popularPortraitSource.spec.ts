import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPopularPortraitPending, popularPortraitSrc } from './popularPortraitSource'
import { loadPortraitCloud } from './particlePortrait'

afterEach(() => vi.unstubAllGlobals())

vi.mock('../../data/popular-onboarding.json', () => ({
  default: { characters: [
    { id: 'pending_test', portraitPending: true },
    { id: 'published_test', portraitPending: false },
  ] },
}))

describe('registered characters without generated portraits', () => {
  it.each(['pending_test'])('shows an explicit placeholder for %s', id => {
    expect(isPopularPortraitPending(id)).toBe(true)
    expect(popularPortraitSrc(id, 42)).toBe('/assets/characters/portrait-pending.svg')
  })
  it('preserves existing portrait paths and versioned caching', () => {
    expect(isPopularPortraitPending('published_test')).toBe(false)
    expect(popularPortraitSrc('published_test', 42)).toBe('/assets/characters/thumbs/popular-published_test.webp?v=42')
  })
  it('does not request a nonexistent particle asset for a pending portrait', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await loadPortraitCloud('pending_test')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
