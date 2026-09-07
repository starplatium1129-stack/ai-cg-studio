import { expect, test } from '@playwright/test'

test('all franchise groups have Chinese labels while both language aliases remain searchable', async ({ page }) => {
  await page.goto('/popular-scenes')
  const series = page.getByLabel('筛选角色系列')
  const group = series.locator('option[value="Blue Archive"]')
  await expect(group).toHaveCount(1)
  const labels = await series.locator('option').allTextContents()
  expect(labels.filter(label => !/[\u4e00-\u9fff]/.test(label))).toEqual([])
  const count = Number((await group.textContent())!.split(' · ').at(-1))
  await series.selectOption('Blue Archive')
  await expect(page.locator('.directory-item')).toHaveCount(count)
  const search = page.getByRole('searchbox', { name: '搜索角色或作品' })
  await search.fill('Blue Archive')
  await expect(page.locator('.directory-item')).toHaveCount(count)
  await search.fill('蔚蓝档案')
  await expect(page.locator('.directory-item')).toHaveCount(count)
})

test('home character captions use the shared Chinese franchise labels', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.pop-cap-franchise').first()).toBeVisible()
  const labels = await page.locator('.pop-cap-franchise').allTextContents()
  expect(labels.length).toBeGreaterThan(0)
  expect(labels.filter(label => !/[\u4e00-\u9fff]/.test(label))).toEqual([])
})
