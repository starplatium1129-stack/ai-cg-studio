/** IME confirmation must not be mistaken for a request to send a message. */
export function submitChatOnEnter(event: KeyboardEvent, submit: () => unknown): void {
  if (event.isComposing || event.keyCode === 229 || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return
  event.preventDefault()
  void submit()
}
