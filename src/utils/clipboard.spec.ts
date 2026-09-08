import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'
import { nextCopyId } from './copyId'

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren() })

describe('copy actions', () => {
  it('awaits the native clipboard and leaves no temporary fields', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText } as unknown as Clipboard)
    expect(await copyText('正文')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('正文')
    expect(document.querySelector('textarea')).toBeNull()
  })
  it('falls back inside an active modal and restores focus', async () => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue({ writeText: vi.fn().mockRejectedValue(new Error('denied')) } as unknown as Clipboard)
    document.body.innerHTML = '<dialog open><button>复制</button></dialog>'
    const button = document.querySelector('button')!
    button.focus()
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn(() => {
      expect(document.querySelector('dialog textarea')).not.toBeNull()
      return true
    }) })
    expect(await copyText('正文')).toBe(true)
    expect(document.activeElement).toBe(button)
    expect(document.querySelector('textarea')).toBeNull()
  })
  it('reports failure rather than success when neither copying API works', async () => {
    vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false })
    expect(await copyText('正文')).toBe(false)
    expect(await copyText('')).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })
  it('keeps repeated blueprint copies unique without changing source content', () => {
    expect(nextCopyId('scene', ['scene', 'scene_copy', 'scene_copy_2'])).toBe('scene_copy_3')
    expect(nextCopyId('scene', ['scene'])).toBe('scene_copy')
  })
})
