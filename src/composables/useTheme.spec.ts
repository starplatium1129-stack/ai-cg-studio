import { beforeEach, describe, expect, it } from 'vitest'
import { initializeTheme, preferredTheme, setTheme, useTheme } from './useTheme'
import { THEME_KEY } from '@/utils/storageKeys'

describe('theme persistence', () => {
  beforeEach(() => { localStorage.clear(); setTheme('dark') })
  it('applies and persists light mode', () => {
    setTheme('light')
    expect(useTheme().theme.value).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(preferredTheme()).toBe('light')
  })
  it('falls back safely when a stored value is invalid', () => {
    localStorage.setItem(THEME_KEY, 'unknown')
    initializeTheme()
    expect(useTheme().theme.value).toBe('dark')
  })
  it('keeps peer windows in sync', () => {
    initializeTheme()
    localStorage.setItem(THEME_KEY, 'light')
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'light' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
