/** One lock for the library across tabs, including compensating image operations.
 * Do not nest this lock or fall back to a tab-local queue: that would silently lose writes.
 * KV transactions still commit related records atomically inside this lock.
 */
export async function withArtworkMutation<T>(work: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks
  if (!locks) throw new Error('当前环境不支持跨窗口安全保存，请使用本机地址或 HTTPS，并更新浏览器后重试')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    return await locks.request('huiyu-artwork-library', { signal: controller.signal }, async () => {
      clearTimeout(timer)
      return work()
    })
  } catch (error) {
    if (controller.signal.aborted) throw new Error('其他窗口仍在整理作品，请稍后重试；本次尚未写入')
    throw error
  } finally { clearTimeout(timer) }
}
