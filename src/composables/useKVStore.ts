/** AICKVStore 的 TypeScript 替代：IndexedDB KV 存储（history / projects 等） */

const DB_NAME = 'aics_kv_store'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('当前浏览器不支持 IndexedDB')); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME))
        req.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => { db.close(); dbPromise = null }
      resolve(db)
    }
    req.onerror = () => { dbPromise = null; reject(req.error ?? new Error('KV 数据库打开失败')) }
  })
  return dbPromise
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  // 不再走内存缓存：memCache 是标签页私有副本，跨标签页写入后另一页会
  // 一直读到旧值（历史/作品册"丢新记录"）。IndexedDB 单键读取是毫秒级，
  // 本项目数据量下直接查库没有可感知的性能代价。
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => {
      resolve((req.result?.value ?? null) as T | null)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(value))
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ key, value: snapshot })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('KV 事务已取消'))
  })
}

/** 兼容旧版 AICKVStore.init() 调用 */
export const kvInit = openDb
