import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals() })

// 模拟连接层事件；验证调用方可从同步/异步失败恢复，而非模拟数据库实现。
function databaseFactory() {
  const db = { close: vi.fn(), onversionchange: null as (() => void) | null }
  const open = vi.fn(() => {
    const request = { result: db, onsuccess: null as (() => void) | null }
    queueMicrotask(() => request.onsuccess?.())
    return request
  })
  return { db, open }
}

describe.each(['images', 'kv'])('%s 数据库连接恢复', store => {
  async function reader() {
    vi.resetModules()
    if (store === 'kv') return (await import('./useKVStore')).kvInit
    const { imgDeleteMany } = await import('./useImageStore')
    return () => imgDeleteMany(['test'])
  }

  function installDatabase() {
    const factory = databaseFactory()
    const transaction = { objectStore: () => ({ delete: vi.fn() }), oncomplete: null as (() => void) | null }
    Object.assign(factory.db, { transaction: () => {
      queueMicrotask(() => transaction.oncomplete?.())
      return transaction
    } })
    vi.stubGlobal('indexedDB', factory)
    return factory
  }

  it('暂时缺少 IndexedDB 后可以重试', async () => {
    const read = await reader()
    vi.stubGlobal('indexedDB', undefined)
    await expect(read()).rejects.toThrow('IndexedDB')
    const factory = installDatabase()
    await read()
    expect(factory.open).toHaveBeenCalledTimes(1)
  })

  it('open 同步抛错后恢复，并复用成功连接', async () => {
    const read = await reader()
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('unavailable') } })
    await expect(read()).rejects.toThrow('unavailable')
    const factory = installDatabase()
    await read()
    await read()
    expect(factory.open).toHaveBeenCalledTimes(1)
    factory.db.onversionchange?.()
    await read()
    expect(factory.db.close).toHaveBeenCalledTimes(1)
    expect(factory.open).toHaveBeenCalledTimes(2)
  })

  it('open 异步失败后允许重新连接', async () => {
    const read = await reader()
    vi.stubGlobal('indexedDB', { open: () => {
      const request = { error: new Error('open failed'), onerror: null as (() => void) | null }
      queueMicrotask(() => request.onerror?.())
      return request
    } })
    await expect(read()).rejects.toThrow('open failed')
    const factory = installDatabase()
    await read()
    expect(factory.open).toHaveBeenCalledTimes(1)
  })
})

it.each([0, 100000])('图片计数 %i 只读取计数结果', async total => {
  vi.resetModules()
  const factory = databaseFactory()
  const count = vi.fn(() => {
    const request = { result: total, onsuccess: null as (() => void) | null }
    queueMicrotask(() => request.onsuccess?.())
    return request
  })
  const getAllKeys = vi.fn(() => { throw new Error('不得枚举图片 ID') })
  Object.assign(factory.db, { transaction: () => ({ objectStore: () => ({ count, getAllKeys }) }) })
  vi.stubGlobal('indexedDB', factory)
  const { imgCount } = await import('./useImageStore')
  await expect(imgCount()).resolves.toBe(total)
  expect(count).toHaveBeenCalledTimes(1)
  expect(getAllKeys).not.toHaveBeenCalled()
})
