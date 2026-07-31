/** AICKVStore 的 TypeScript 替代：IndexedDB KV 存储（history / projects 等） */

const DB_NAME = 'aics_kv_store'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null
const memCache: Record<string, unknown> = {}

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
  if (memCache[key] !== undefined) return JSON.parse(JSON.stringify(memCache[key])) as T
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => {
      const val = req.result?.value ?? null
      if (val !== null) memCache[key] = JSON.parse(JSON.stringify(val))
      resolve(val as T | null)
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
    tx.oncomplete = () => { memCache[key] = JSON.parse(JSON.stringify(snapshot)); resolve() }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('KV 事务已取消'))
  })
}

/** 兼容旧版 AICKVStore.init() 调用 */
export const kvInit = openDb
