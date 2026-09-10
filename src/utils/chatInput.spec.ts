import { describe, expect, it, vi } from 'vitest'
import { submitChatOnEnter } from './chatInput'
describe('chat Enter handling', () => {
  it('keeps IME confirmation and shifted Enter for editing', () => {
    const send = vi.fn()
    const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true })
    submitChatOnEnter(composing, send)
    submitChatOnEnter(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }), send)
    expect(send).not.toHaveBeenCalled()
    expect(composing.defaultPrevented).toBe(false)
  })
  it('sends on ordinary Enter and prevents an extra newline', () => {
    const send = vi.fn(), event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    submitChatOnEnter(event, send)
    expect(send).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })
})
