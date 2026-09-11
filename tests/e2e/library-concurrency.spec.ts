import { test, expect, type Page } from '@playwright/test'
import { build } from 'esbuild'
import { resolve } from 'node:path'

type LibraryFixture = {
  artworkRepository: {
    appendArtwork(entry: { id: string; favorite?: boolean }): Promise<unknown[]>
    patchArtwork(id: string, patch: Record<string, unknown>): Promise<unknown>
    softDeleteArtwork(id: string): Promise<unknown>
    restoreArtwork(id: string): Promise<unknown>
  }
  ARTWORK_HISTORY_KEY: string
  kvGet(key: string): Promise<Array<{ id: string; favorite?: boolean }> | null>
  kvSet(key: string, value: unknown): Promise<void>
  restoreBackupData(backup: unknown, replace: boolean): Promise<void>
  normalizeBackup(backup: unknown): unknown
}
declare global {
  interface Window {
    libraryFixture: LibraryFixture
    libraryBarrier?: { entered: boolean; release(): void; done: Promise<void> }
  }
}

let sourceBundle: string
test.beforeAll(async () => {
  const root = resolve(__dirname, '../..')
  const bundled = await build({
    stdin: { contents: [
      "export * from './src/storage/artworkRepository.ts';",
      "export * from './src/composables/useKVStore.ts';",
      "export * from './src/storage/backupRestore.ts';",
      "export * from './src/utils/backupCore.ts';",
    ].join('\n'), resolveDir: root },
    bundle: true, write: false, format: 'iife', globalName: 'libraryFixture', platform: 'browser',
    alias: { '@': resolve(root, 'src') }, logLevel: 'silent',
  })
  sourceBundle = bundled.outputFiles[0].text
})

test.beforeEach(async ({ context }) => {
  // Only the document shell is a fixture. Storage, locks and product source are real.
  await context.route('**/__library-fixture', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Isolated library test</title><script src="/__library-fixture.js"></script>',
  }))
  await context.route('**/__library-fixture.js', route => route.fulfill({ contentType: 'application/javascript', body: sourceBundle }))
})

async function enter(page: Page) {
  await page.goto('/__library-fixture')
  await page.waitForFunction(() => Boolean(window.libraryFixture?.artworkRepository))
}
async function ids(page: Page) {
  return page.evaluate(async () => (await window.libraryFixture.kvGet(window.libraryFixture.ARTWORK_HISTORY_KEY) || []).map(item => item.id).sort())
}

async function holdLibrary(page: Page, commitOnRelease = false) {
  await page.evaluate(commit => {
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const state: NonNullable<Window['libraryBarrier']> = { entered: false, release, done: Promise.resolve() }
    window.libraryBarrier = state
    state.done = Promise.resolve(navigator.locks.request('huiyu-artwork-library', async () => {
      state.entered = true
      await barrier
      if (commit) await window.libraryFixture.kvSet(window.libraryFixture.ARTWORK_HISTORY_KEY, [{ id: 'concurrent' }])
    }))
  }, commitOnRelease)
  await page.waitForFunction(() => window.libraryBarrier?.entered)
}

test('home migration retains legacy data when another page commits before its read', async ({ page, context }) => {
  const writer = await context.newPage()
  await enter(writer)
  await writer.evaluate(() => localStorage.setItem(window.libraryFixture.ARTWORK_HISTORY_KEY, JSON.stringify([{ id: 'legacy' }])))
  await holdLibrary(writer, true)
  try {
    await page.goto('/')
    // Wait for either a queued reader or an unsafe completed migration, without timing guesses.
    await expect.poll(() => writer.evaluate(async () =>
      (await navigator.locks.query()).pending?.some(lock => lock.name === 'huiyu-artwork-library')
      || localStorage.getItem(window.libraryFixture.ARTWORK_HISTORY_KEY) === null,
    )).toBe(true)
  } finally {
    await writer.evaluate(async () => { window.libraryBarrier!.release(); await window.libraryBarrier!.done })
  }
  await expect.poll(() => writer.evaluate(async () => (await navigator.locks.query()).held?.length || 0)).toBe(0)
  expect(await ids(writer)).toEqual(['concurrent'])
  expect(await writer.evaluate(() => JSON.parse(localStorage.getItem(window.libraryFixture.ARTWORK_HISTORY_KEY) || '[]'))).toEqual([{ id: 'legacy' }])
})

test('home legacy migration and a queued append preserve both works', async ({ page, context }) => {
  const writer = await context.newPage()
  await enter(writer)
  await writer.evaluate(() => localStorage.setItem(window.libraryFixture.ARTWORK_HISTORY_KEY, JSON.stringify([{ id: 'legacy' }])))
  await holdLibrary(writer)
  let append = Promise.resolve<string | null>(null)
  try {
    await page.goto('/')
    await expect.poll(() => writer.evaluate(async () => (await navigator.locks.query()).pending?.length || 0)).toBe(1)
    append = writer.evaluate(async () => {
      try {
        await window.libraryFixture.artworkRepository.appendArtwork({ id: 'new-work' })
        return null
      } catch (error) { return String(error) }
    })
    await expect.poll(() => writer.evaluate(async () => (await navigator.locks.query()).pending?.length || 0)).toBe(2)
  } finally {
    await writer.evaluate(async () => { window.libraryBarrier!.release(); await window.libraryBarrier!.done })
  }
  expect(await append).toBeNull()
  expect(await ids(writer)).toEqual(['legacy', 'new-work'])
  expect(await writer.evaluate(() => localStorage.getItem(window.libraryFixture.ARTWORK_HISTORY_KEY))).toBeNull()
})

test('two pages preserve every concurrent history append in real IndexedDB', async ({ page, context }) => {
  const other = await context.newPage()
  await Promise.all([enter(page), enter(other)])
  for (let round = 0; round < 40; round++) {
    await page.evaluate(() => window.libraryFixture.kvSet(window.libraryFixture.ARTWORK_HISTORY_KEY, []))
    await Promise.all([
      page.evaluate(id => window.libraryFixture.artworkRepository.appendArtwork({ id }), `left-${round}`),
      other.evaluate(id => window.libraryFixture.artworkRepository.appendArtwork({ id }), `right-${round}`),
    ])
    expect(await ids(page)).toEqual([`left-${round}`, `right-${round}`])
  }
})

test('append, favorite, delete, restore and backup merge share the same cross-page boundary', async ({ page, context }) => {
  const other = await context.newPage()
  await Promise.all([enter(page), enter(other)])
  await page.evaluate(() => window.libraryFixture.artworkRepository.appendArtwork({ id: 'original' }))
  await Promise.all([
    page.evaluate(() => window.libraryFixture.artworkRepository.appendArtwork({ id: 'second' })),
    other.evaluate(() => window.libraryFixture.artworkRepository.patchArtwork('original', { favorite: true })),
  ])
  expect(await ids(page)).toEqual(['original', 'second'])
  expect(await page.evaluate(async () => (await window.libraryFixture.kvGet(window.libraryFixture.ARTWORK_HISTORY_KEY))?.find(item => item.id === 'original')?.favorite)).toBe(true)
  await Promise.all([
    page.evaluate(() => window.libraryFixture.artworkRepository.appendArtwork({ id: 'third' })),
    other.evaluate(() => window.libraryFixture.artworkRepository.softDeleteArtwork('original')),
  ])
  expect(await ids(page)).toEqual(['second', 'third'])
  await Promise.all([
    page.evaluate(() => window.libraryFixture.artworkRepository.appendArtwork({ id: 'fourth' })),
    other.evaluate(() => window.libraryFixture.artworkRepository.restoreArtwork('original')),
  ])
  await Promise.all([
    page.evaluate(() => window.libraryFixture.artworkRepository.appendArtwork({ id: 'fifth' })),
    other.evaluate(() => window.libraryFixture.restoreBackupData(window.libraryFixture.normalizeBackup({
      data: { history: [{ id: 'imported' }], projects: [], settings: {} }, images: [],
    }), false)),
  ])
  expect(await ids(page)).toEqual(['fifth', 'fourth', 'imported', 'original', 'second', 'third'])
})

test('a failed transaction releases the cross-page lock and permits a retry', async ({ page, context }) => {
  const other = await context.newPage()
  await Promise.all([enter(page), enter(other)])
  const failed = await page.evaluate(async () => {
    const originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      IDBObjectStore.prototype.put = originalPut
      throw new DOMException('fixture quota failure', 'QuotaExceededError')
    }
    try {
      await window.libraryFixture.artworkRepository.appendArtwork({ id: 'retry' })
      return false
    } catch { return true }
    finally { IDBObjectStore.prototype.put = originalPut }
  })
  expect(failed).toBe(true)
  await Promise.all([
    page.evaluate(() => window.libraryFixture.artworkRepository.appendArtwork({ id: 'retry' })),
    other.evaluate(() => window.libraryFixture.artworkRepository.appendArtwork({ id: 'other' })),
  ])
  expect(await ids(page)).toEqual(['other', 'retry'])
})

test('unsupported lock environments refuse writes instead of silently losing data', async ({ page }) => {
  await enter(page)
  const result = await page.evaluate(async () => {
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true })
    try {
      await window.libraryFixture.artworkRepository.appendArtwork({ id: 'unsafe' })
      return ''
    } catch (error) { return String(error) }
  })
  expect(result).toContain('跨窗口安全保存')
  expect(await ids(page)).toEqual([])
})
