import { test, expect } from '@playwright/test'

test('anima engine: main generate shows result in main frame', async ({ page }) => {
  test.setTimeout(240000)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)))

  await page.goto('/prompt-builder', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  await page.locator('.engine-switch button').nth(1).click()
  await page.waitForTimeout(1500)

  const genBtn = page.locator('#stepResult .btn-primary').first()
  await expect(genBtn).toBeEnabled({ timeout: 30000 })
  console.log('GEN_BTN_ENABLED: true')

  await page.locator('.story-input').fill('宁宁在咖啡馆里穿着魔女服，对我微笑')
  await page.waitForTimeout(1500)
  await genBtn.click()

  let imgFound = false
  const deadline = Date.now() + 120000
  while (Date.now() < deadline && !imgFound) {
    await page.waitForTimeout(5000)
    const count = await page.locator('.result-image-wrap img.result-image').count()
    if (count > 0) imgFound = true
  }
  console.log('MAIN_RESULT_IMG:', imgFound)
  console.log('PAGE_ERRORS:', errors.length ? errors.join(' | ') : 'none')
  expect(imgFound).toBe(true)
  expect(errors).toEqual([])
})
