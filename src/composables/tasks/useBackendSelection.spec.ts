import { effectScope, nextTick, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { useBackendSelection } from './useBackendSelection'

it('cached-page task switches keep the latest identity even when old responses arrive last', async () => {
  const id = ref('first'), apply = vi.fn(), failed = vi.fn()
  const replies = new Map<string, (value: string) => void>()
  const signals = new Map<string, AbortSignal>()
  const scope = effectScope()
  scope.run(() => useBackendSelection(() => id.value, () => undefined, (key, signal) => {
    signals.set(key, signal)
    return new Promise<string>(resolve => replies.set(key, resolve))
  }, apply, failed))
  await nextTick()
  id.value = 'second'; await nextTick()
  replies.get('second')!('second result'); await nextTick()
  replies.get('first')!('late first result'); await nextTick()
  expect(signals.get('first')?.aborted).toBe(true)
  expect(apply.mock.calls).toEqual([['second result']])
  expect(failed).not.toHaveBeenCalled()
  scope.stop()
})

it('leaving the page aborts selection and suppresses its late error', async () => {
  const id = ref('one'), apply = vi.fn(), failed = vi.fn()
  let reject!: (error: Error) => void
  let signal!: AbortSignal
  const scope = effectScope()
  scope.run(() => useBackendSelection(() => id.value, () => undefined, (_key, value) => {
    signal = value; return new Promise((_resolve, fail) => { reject = fail })
  }, apply, failed))
  await nextTick()
  id.value = ''; await nextTick()
  expect(signal.aborted).toBe(true)
  reject(new Error('aborted')); await nextTick()
  expect(failed).not.toHaveBeenCalled()
  scope.stop()
})

it('the same task can retry after failure and concurrent retries share one request', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('recovered')
  const apply = vi.fn(), failed = vi.fn(), scope = effectScope()
  const selection = scope.run(() => useBackendSelection(() => 'one', () => undefined, fetch, apply, failed))!
  await selection.retry()
  expect(failed).toHaveBeenCalledOnce()
  await Promise.all([selection.retry(), selection.retry()])
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(apply).toHaveBeenCalledWith('recovered')
  scope.stop()
  await selection.retry()
  expect(fetch).toHaveBeenCalledTimes(2)
})
