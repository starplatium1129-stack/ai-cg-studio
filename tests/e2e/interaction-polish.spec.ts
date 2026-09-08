import { expect, test } from '@playwright/test'

test('interface sound is opt-in and persists the explicit choice', async ({ page }) => {
  await page.goto('/')

  const sound = page.getByRole('button', { name: '开启界面音效' })
  await expect(sound).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(() => localStorage.getItem('aics_interface_sound_v1'))).toBeNull()

  await sound.click()
  await expect(page.getByRole('button', { name: '关闭界面音效' })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => localStorage.getItem('aics_interface_sound_v1'))).toBe('1')

  await page.reload()
  await expect(page.getByRole('button', { name: '关闭界面音效' })).toHaveAttribute('aria-pressed', 'true')
})

test('navigation uses hand-drawn icons and a settled selection indicator', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: '主导航' })
  const sceneLink = nav.getByRole('link', { name: '灵感', exact: true })
  await expect(sceneLink.locator('svg.archive-icon')).toHaveCount(1)
  await sceneLink.click()
  await expect(page).toHaveURL(/scene-explorer$/)
  await expect(sceneLink).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.nav-links > .animated-selection')).toBeVisible()
  await expect(page.locator('.route-loader')).not.toHaveClass(/active/)
})

test('entering a character room keeps the interface clear of transition overlays', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation').getByRole('link', { name: '房间', exact: true }).click()
  await expect(page).toHaveURL(/chat$/)
  await expect(page.locator('main h1')).toBeVisible()
  await expect(page.locator('.route-cut,.interaction-impulse')).toHaveCount(0)
})

test('gallery empty content uses the shared archive state panel', async ({ page }) => {
  await page.goto('/gallery')

  const state = page.locator('.archive-state-panel[data-kind="empty"]')
  await expect(state).toBeVisible()
  await expect(state).toContainText('展墙还在等你的第一幅作品')
  await expect(state.getByRole('link', { name: '开始绘制' })).toBeVisible()
})

test('scene cards keep drawing actions subordinate until interaction', async ({ page }) => {
  await page.goto('/scene-explorer')

  await expect(page.locator('.scene-grid').getByRole('link', { name: '开始绘制' }).first()).toHaveClass(/scene-draw-action/)
})

test('global motion feedback is suppressed when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const state = await page.evaluate(() => ({
    loader: getComputedStyle(document.querySelector('.route-loader')!).display,
    overlays: document.querySelectorAll('.route-cut,.interaction-impulse').length,
  }))
  expect(state).toEqual({ loader: 'none', overlays: 0 })
})

test('repeated navigation keeps a visible route view mounted', async ({ page }) => {
  await page.goto('/')

  for (const destination of [
    { label: '灵感', url: /\/scene-explorer$/, heading: '灵感场景' },
    { label: 'CG 画册', url: /\/showcase$/, heading: '把心动，一页页收藏。' },
    { label: '作品册', url: /\/gallery$/, heading: '作品册' },
  ]) {
    if (destination.label === '作品册') await page.locator('.nav-more summary').click()
    await page.getByRole('navigation').getByRole('link', { name: destination.label, exact: true }).click()
    await expect(page).toHaveURL(destination.url)
    await expect(page.locator('#main')).toContainText(destination.heading)
    expect(await page.locator('#main .route-view').evaluateAll(views => views.some(view => {
      const style = getComputedStyle(view)
      return style.opacity !== '0' && view.getBoundingClientRect().height > 0
    }))).toBe(true)
  }
})

for (const theme of ['dark', 'light']) {
  test(`copy failure has recovery feedback ${theme}`, async ({ page }) => {
    await page.addInitScript(value => {
      localStorage.setItem('aics_theme', value)
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
      document.execCommand = () => false
    }, theme)
    await page.goto('/color-script')
    await page.locator('.mood-card').first().click()
    await page.getByRole('button', { name: /复制 Prompt/ }).click()
    await expect(page.locator('.toast-msg')).toContainText('复制未完成')
    await expect(page.locator('.toast-msg')).not.toContainText('已复制')
    await expect(page.getByRole('button', { name: /复制 Prompt/ })).toBeFocused()
    await page.screenshot({ path: `.review-shots/feature-copy-${theme}.png`, fullPage: true })
  })
  test(`failed page navigation can be recovered ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: theme === 'dark' ? 390 : 1440, height: 900 })
    await page.addInitScript(value => localStorage.setItem('aics_theme', value), theme)
    await page.route(/\/_app\/ScenarioView-[^/]+\.js$/, route => route.abort())
    await page.goto('/style')
    await page.getByRole('link', { name: '剧本与分幕', exact: true }).click()
    const recovery = page.getByRole('alert', { name: '页面加载恢复' })
    await expect(recovery).toBeVisible()
    await expect(page.getByRole('heading', { name: '画风', exact: true })).toBeVisible()
    await expect(recovery.getByRole('link', { name: '重新打开目标页面' })).toHaveAttribute('href', '/scenario')
    await page.screenshot({ path: `.review-shots/feature-recovery-${theme}.png`, fullPage: true })
    await page.unroute(/\/_app\/ScenarioView-[^/]+\.js$/)
    await recovery.getByRole('link', { name: '重新打开目标页面' }).click()
    await expect(page.getByRole('heading', { name: '剧本模式', exact: true })).toBeVisible()
    await expect(recovery).not.toBeVisible()
  })
}

test('gallery filtering does not retain hidden selections', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('aics_pb_history', JSON.stringify([
      { id: 'audit-one', sceneTitle: '审计甲', prompt: 'audit first', favorite: true },
      { id: 'audit-two', sceneTitle: '审计乙', prompt: 'audit second', favorite: false },
    ]))
  })
  await page.goto('/gallery')
  await page.getByRole('button', { name: '选择', exact: true }).click()
  await page.getByRole('button', { name: /全选/ }).click()
  await expect(page.locator('.gallery-bulk-count')).toContainText('已选 2 / 2')
  await page.getByLabel('搜索作品', { exact: true }).fill('审计甲')
  await expect(page.locator('.gallery-bulk-count')).toContainText('已选 0 / 1')
  await expect(page.getByRole('button', { name: '移入回收站（0）', exact: true })).toBeDisabled()
})


test('gallery keeps failed bulk items selected for retry', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('aics_pb_history', JSON.stringify([
      { id: 'audit-one', sceneTitle: '审计甲', prompt: 'audit first' },
      { id: 'audit-two', sceneTitle: '审计乙', prompt: 'audit second' },
    ]))
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value, key) {
      if (value?.key === 'aics_pb_history' && Array.isArray(value.value) && value.value.length === 0) throw new DOMException('Test quota failure', 'QuotaExceededError')
      return key === undefined ? put.call(this, value) : put.call(this, value, key)
    }
  })
  await page.goto('/gallery')
  await page.getByRole('button', { name: '选择', exact: true }).click()
  await page.getByRole('button', { name: /全选/ }).click()
  await page.getByRole('button', { name: '移入回收站（2）', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '移入回收站', exact: true }).click()
  await expect(page.locator('.toast-msg')).toContainText('1 幅没成功')
  await expect(page.locator('.gallery-bulk-count')).toContainText('已选 1 / 1')
  await expect(page.getByRole('button', { name: '移入回收站（1）', exact: true })).toBeEnabled()
})


for (const theme of ['dark', 'light']) {
  test(`control configuration shows pending state and allows retry ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('aics_theme', value), theme)
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    let requests = 0
    await page.route('**/api/config', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      requests++
      await pending
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '模拟保存失败' }) })
    })
    try {
      await page.goto('/control')
      await page.getByRole('button', { name: '保存全部并检测', exact: true }).first().click()
      const buttons = page.getByRole('button', { name: '正在保存…', exact: true })
      await expect(buttons).toHaveCount(3)
      for (const button of await buttons.all()) await expect(button).toBeDisabled()
      await page.locator('#sd-host').press('Enter')
      expect(requests).toBe(1)
      await page.locator('.service-config-panel').screenshot({ path: `.review-shots/feature-control-${theme}.png` })
      release()
      await expect(page.getByRole('button', { name: '保存全部并检测', exact: true }).first()).toBeEnabled()
    } finally { release() }
  })
}


for (const theme of ['dark', 'light']) {
  test(`batch selection progress and stop stay consistent ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: theme === 'dark' ? 1440 : 390, height: 960 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(value => localStorage.setItem('aics_theme', value), theme)
    let submitted = 0, finish = false
    await page.route('**/api/anima/jobs', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      submitted++
      await route.fulfill({ json: { ok: true, job: { id: 'batch-audit-' + submitted, status: 'queued' } } })
    })
    await page.route(/\/api\/anima\/jobs\/batch-audit-\d+$/, route => route.fulfill({ json: { ok: true, job: { id: 'batch-audit-1', status: finish ? 'succeeded' : 'running', seed: 42, resultAvailable: finish, resultUrl: '/batch-audit-result.svg' } } }))
    await page.route('**/batch-audit-result.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="gray"/></svg>' }))
    await page.goto('/prompt-builder')
    await page.getByRole('button', { name: '专家模式', exact: true }).click()
    await page.getByRole('tab', { name: '任务', exact: true }).click()
    await page.getByRole('button', { name: '批量出图 · 场景 / 多角色', exact: true }).click()
    const panel = page.getByRole('dialog', { name: '批量出图', exact: true })
    await panel.getByRole('button', { name: 'Anima', exact: true }).click()
    await expect(panel.locator('.batch-scene-card')).toHaveCount(30)
    await panel.getByRole('button', { name: '全选匹配项', exact: true }).click()
    await panel.getByRole('button', { name: '取消全选', exact: true }).click()
    await expect(panel.locator('.batch-hint')).toContainText('已选 0 个场景')
    const safe = panel.locator('.batch-scene-card').filter({ hasNot: page.locator('.batch-scene-adult') })
    await safe.nth(0).click(); await safe.nth(1).click()
    await panel.getByLabel('搜索批量场景').fill('没有任何匹配_audit')
    await expect(panel.locator('.batch-hint')).toContainText('已选 2 个场景')
    await panel.getByRole('button', { name: '开始批量出图', exact: true }).click()
    await expect(panel.locator('.batch-result-grid .batch-card')).toHaveCount(2)
    await expect(panel.locator('.batch-progress-head')).toContainText('正在逐张出图')
    await panel.getByRole('button', { name: '关闭', exact: true }).click()
    await page.getByRole('button', { name: '查看批量进度', exact: true }).click()
    await expect(panel.locator('.batch-progress-head')).toContainText('正在逐张出图')
    await panel.getByRole('button', { name: '停止（当前张完成后停）', exact: true }).click()
    finish = true
    await expect(panel.locator('.batch-card[data-state="cancelled"]')).toHaveCount(1)
    await expect(panel.locator('.batch-count-label')).toContainText('1 未执行')
    await expect(panel.locator('.batch-card[data-state="succeeded"]')).toHaveCount(1)
    expect(submitted).toBe(1)
    await panel.screenshot({ path: `.review-shots/batch-${theme}.png` })
  })
}
