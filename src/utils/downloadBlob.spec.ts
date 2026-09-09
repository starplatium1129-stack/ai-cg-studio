import { afterEach, expect, it, vi } from 'vitest'
import { downloadBlob } from './downloadBlob'
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
it('attaches the download anchor, removes it and keeps the URL alive until the browser can read it', () => {
  vi.useFakeTimers()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.isConnected).toBe(true)
    expect(this.download).toBe('archive.json')
  })
  downloadBlob(new Blob(['test']), 'archive.json')
  expect(click).toHaveBeenCalledOnce()
  expect(document.querySelector('a[download]')).toBeNull()
  expect(revoke).not.toHaveBeenCalled()
  vi.advanceTimersByTime(60_000)
  expect(revoke).toHaveBeenCalledWith('blob:download')
})
