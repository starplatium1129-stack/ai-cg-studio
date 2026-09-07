import { expect, test } from '@playwright/test'

test('different source spellings form one complete work group', async ({ page }) => {
  await page.goto('/character')
  const oregairu = page.locator('.cb-group').filter({ has: page.locator('.cb-group-head', { hasText: '我的青春恋爱物语果然有问题' }) })
  await expect(oregairu).toHaveCount(1)
  await expect(oregairu.locator('.cb-card')).toHaveCount(4)
  const saekano = page.locator('.cb-group').filter({ has: page.locator('.cb-group-head', { hasText: '路人女主的养成方法' }) })
  await expect(saekano).toHaveCount(1)
  await expect(saekano.locator('.cb-card')).toHaveCount(2)
  await page.getByRole('button', { name: /^路人女主的养成方法/ }).click()
  await expect(page.locator('.cb-card')).toHaveCount(2)
})

test('replacement portrait and compact avatar load with an honest source label', async ({ page }) => {
  await page.goto('/character?character=katou_megumi')
  await expect(page.locator('.character-name')).toHaveText('加藤惠')
  await expect(page.locator('.portrait-badge')).toContainText('角色场景样张')
  const portrait = page.locator('.portrait-image')
  await expect.poll(() => portrait.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  const card = page.locator('.cb-card').filter({ has: page.locator('.cb-name', { hasText: '加藤惠' }) })
  await expect(card.locator('img')).toHaveAttribute('src', '/assets/characters/thumbs/popular-katou_megumi.webp')
})
