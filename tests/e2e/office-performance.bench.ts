import { test, expect, type Request } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

test('drawing route entry metrics', async ({ browser, baseURL }) => {
  const results: object[] = []
  for (let sample = 0; sample < 3; sample++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    try {
      for (const mode of ['cold', 'warm']) {
        const scripts = new Set<string>()
        const onRequest = (request: Request) => {
          if (request.resourceType() === 'script') scripts.add(new URL(request.url()).pathname.split('/').pop()!)
        }
        page.on('request', onRequest)
        const started = Date.now()
        await page.goto(`${baseURL}/prompt-builder`)
        await expect(page.locator('.gen-bar')).toBeVisible()
        await expect(page.locator('.material-switch')).toBeVisible()
        const enteredAt = Date.now()
        await page.locator('[aria-controls="material-story"]').click()
        await expect(page.locator('#material-story')).toBeVisible()
        results.push({ sample, mode, entryMs: enteredAt - started, firstActionMs: Date.now() - enteredAt, scripts: [...scripts].sort() })
        page.off('request', onRequest)
      }
    } finally { await context.close() }
  }
  const phase = process.env.AICS_OFFICE_PHASE === 'before' ? 'before' : 'after'
  mkdirSync('runtime/office-code-2026-09-11', { recursive: true })
  writeFileSync(`runtime/office-code-2026-09-11/browser-${phase}.json`, JSON.stringify({ browser: browser.version(), scope: 'isolated single-worker local-production-build, fresh-context then cached-document-navigation, no GPU', results }, null, 2))
})
