import { test, expect } from '@playwright/test'
import MOCK_PORTS from './mock-ports.json'

test('anima engine: main generate shows result in main frame through mock ComfyUI', async ({ page, request }) => {
  test.setTimeout(240000)
  const errors: string[] = []
  const directComfyRequests: string[] = []
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)))
  page.on('request', browserRequest => {
    const pathname = new URL(browserRequest.url()).pathname
    if (pathname.startsWith('/comfy') || ['/prompt', '/queue', '/history', '/interrupt', '/view'].includes(pathname)) {
      directComfyRequests.push(pathname)
    }
  })

  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10, historyTransient: 2 } })

  // 绘图页有持续的服务状态轮询，networkidle 永远不会成立。
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
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
  const deadline = Date.now() + 30000
  while (Date.now() < deadline && !imgFound) {
    await page.waitForTimeout(5000)
    const count = await page.locator('.result-image-wrap img.result-image').count()
    if (count > 0) imgFound = true
  }
  console.log('MAIN_RESULT_IMG:', imgFound)
  console.log('PAGE_ERRORS:', errors.length ? errors.join(' | ') : 'none')
  expect(imgFound).toBe(true)
  expect(directComfyRequests).toEqual([])
  const comfyState = await (await request.get(`${mockComfy}/__mock/state`)).json()
  expect(comfyState.calls.filter((call: { path: string }) => call.path === '/prompt')).toHaveLength(1)
  expect(comfyState.calls.filter((call: { path: string }) => call.path === '/view')).toHaveLength(1)
  expect(errors).toEqual([])
})

test('anima panel and main button share one parent-owned request metadata snapshot', async ({ page, request }) => {
  test.setTimeout(240000)
  const bodies: unknown[] = []
  page.on('request', browserRequest => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname === '/api/anima/jobs') {
      bodies.push(browserRequest.postDataJSON())
    }
  })

  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10 } })
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.locator('.engine-switch button').nth(1).click()
  await page.locator('.anima-quick-panel > summary').click()
  await page.locator('.story-input').fill('宁宁在咖啡馆里穿着魔女服，对我微笑')
  await page.locator('.anima-quick-panel .anima-seed').fill('424242')
  await page.waitForTimeout(600)

  await page.locator('.anima-quick-panel .anima-primary').click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(1)
  await expect(page.locator('.result-image-wrap img.result-image')).toHaveCount(1, { timeout: 30000 })

  await page.locator('#stepResult .btn-primary').first().click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(2)
  expect(bodies[0]).toEqual(bodies[1])
  expect((bodies[0] as { profileId?: string }).profileId).toBeUndefined()
  expect((bodies[0] as { character: string }).character).toBe('nene')
})
