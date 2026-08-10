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

test('anima derives the promoted Natsume v20 LoRA and blocks triad', async ({ page, request }) => {
  test.setTimeout(240000)
  const bodies: Array<Record<string, unknown>> = []
  page.on('request', browserRequest => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname === '/api/anima/jobs') {
      bodies.push(browserRequest.postDataJSON() as Record<string, unknown>)
    }
  })
  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10 } })
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  await page.locator('#stepChar .char-btn').filter({ hasText: '夏目' }).click()
  await page.locator('.engine-switch button').nth(1).click()
  await expect(page.locator('.anima-preview-note')).toHaveCount(0)
  await page.locator('.story-input').fill('夏目在咖啡馆里端来一杯咖啡')
  await page.locator('.anima-quick-panel > summary').click()
  await page.locator('.anima-quick-panel .anima-primary').click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(1)
  expect(bodies[0].character).toBe('natsume')
  expect(bodies[0].loraId).toBe('L_NAT_V20_ANIMA')
  await expect(page.locator('.result-image-wrap img.result-image')).toHaveCount(1, { timeout: 30000 })

  await page.locator('#stepChar .char-btn').filter({ hasText: '宁宁' }).click()
  await expect(page.locator('.engine-switch button').nth(1)).toBeEnabled()
  await expect(page.locator('.anima-preview-note')).toHaveCount(0)
  await page.locator('#stepChar .char-btn').filter({ hasText: '双人' }).click()
  await expect(page.locator('.engine-switch button').nth(1)).toBeDisabled()
  expect(bodies).toHaveLength(1)
})

test('Krea 2 is a separate natural-language request with no LoRA or negative field', async ({ page, request }) => {
  test.setTimeout(240000)
  const bodies: Array<Record<string, unknown>> = []
  await page.route('**/api/creative/status', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true,
      online: true,
      models: [{ id: 'krea2-turbo-fp8', label: 'Krea 2 Turbo', family: 'krea2', profileId: 'krea2_turbo_fp8', available: true, defaults: { steps: 8, cfg: 1, sampler: 'euler', scheduler: 'simple' } }],
      loras: [],
    }) })
  })
  page.on('request', browserRequest => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname === '/api/creative/jobs') {
      bodies.push(browserRequest.postDataJSON() as Record<string, unknown>)
    }
  })
  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10 } })
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  await page.locator('.engine-switch button').nth(2).click()
  await expect(page.locator('.engine-switch button').nth(2)).toHaveClass(/active/)
  await page.locator('#visualDescription').fill('A girl stands beside a rain-covered cafe window, warm interior light behind her.')
  await page.locator('.anima-quick-panel > summary').click()
  await page.locator('.anima-quick-panel .anima-primary').click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(1)
  expect(bodies[0].loraId).toBeUndefined()
  expect(bodies[0].negative).toBe('')
  expect(bodies[0].modelId).toBe('krea2-turbo-fp8')
})

test('Krea 2 and Anima both block triad mode', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${MOCK_PORTS.gateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.locator('#stepChar .char-btn').filter({ hasText: '双人' }).click()
  await expect(page.locator('.engine-switch button').nth(1)).toBeDisabled()
  await expect(page.locator('.engine-switch button').nth(2)).toBeDisabled()
  await expect(page.locator('.engine-switch button').nth(2)).toHaveAttribute('title', /Krea 2/)
})

// ── 热门角色无 LoRA 创作模式 ───────────────────────────────────────────────

test('popular creator · Anima no-LoRA: loraId omitted, workflow has no LoraLoader, negative encoded', async ({ page, request }) => {
  test.setTimeout(240000)
  const bodies: Array<Record<string, unknown>> = []
  page.on('request', browserRequest => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname === '/api/anima/jobs') {
      bodies.push(browserRequest.postDataJSON() as Record<string, unknown>)
    }
  })
  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10, historyTransient: 2 } })
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '雷电将军' }).click()
  await expect(page.locator('.popular-outfits')).toBeVisible()
  await expect(page.locator('.popular-nolora-badge')).toContainText('无需 LoRA')

  await page.locator('.blueprint-card').first().click()
  await expect(page.locator('.blueprint-card.active')).toHaveCount(1)

  // 画面描述框输入必须真正进入无 LoRA 请求（此前被 outfit.prose 硬编码吞掉）。
  await page.locator('#visualDescription').fill('The girl gently holds a bouquet of flowers, petals drifting onto her shoulder.')
  await expect(page.locator('#visualDescription')).toHaveValue(/bouquet/)

  // 进入热门模式应自动切到 Anima；SD 按钮被禁用。
  await expect(page.locator('.engine-switch button').nth(1)).toHaveClass(/active/)
  await expect(page.locator('.engine-switch button').nth(0)).toBeDisabled()

  const genBtn = page.getByRole('button', { name: '生成图片' })
  await expect(genBtn).toBeEnabled({ timeout: 30000 })
  await genBtn.click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(1)
  expect(bodies[0].loraId).toBeUndefined()
  expect(bodies[0].loraStrength).toBeUndefined()
  expect(bodies[0].character).toBeNull()
  expect(bodies[0].modelId).toBe('anima-aesthetic-v1.1')
  expect(String(bodies[0].prompt)).toContain('raiden_shogun')
  expect(String(bodies[0].prompt)).toContain('bouquet')
  expect(String(bodies[0].prompt)).not.toMatch(/nene_|natsume_|ayachi_nene|shiki_natsume|<lora:/i)

  await expect(page.locator('.result-image-wrap img.result-image')).toHaveCount(1, { timeout: 30000 })

  const comfyState = await (await request.get(`${mockComfy}/__mock/state`)).json()
  const promptCall = comfyState.calls.find((call: { path: string }) => call.path === '/prompt')
  const graph = promptCall?.body?.prompt as Record<string, { class_type?: string; inputs?: Record<string, unknown> }> | undefined
  expect(graph).toBeTruthy()
  const classes = Object.values(graph || {}).map(node => node.class_type)
  expect(classes).not.toContain('LoraLoader')
  expect(graph!['2'].inputs?.clip_name).toBe('qwen_3_06b_base.safetensors')
  expect(String(graph!['5'].inputs?.text)).toContain('worst quality')
  expect(graph!['7'].inputs?.sampler_name).toBe('er_sde')
})

test('popular creator · Krea 2 request has no negative and no LoRA', async ({ page, request }) => {
  test.setTimeout(240000)
  const bodies: Array<Record<string, unknown>> = []
  page.on('request', browserRequest => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname === '/api/creative/jobs') {
      bodies.push(browserRequest.postDataJSON() as Record<string, unknown>)
    }
  })
  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10 } })
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '雷电将军' }).click()
  await page.locator('.blueprint-card').first().click()
  await page.locator('.engine-switch button').nth(2).click()
  await expect(page.locator('.engine-switch button').nth(2)).toHaveClass(/active/)

  const genBtn = page.getByRole('button', { name: '生成图片' })
  await expect(genBtn).toBeEnabled({ timeout: 30000 })
  await genBtn.click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(1)
  expect(bodies[0].loraId).toBeUndefined()
  expect(bodies[0].negative).toBe('')
  expect(bodies[0].modelId).toBe('krea2-turbo-fp8')
  expect(String(bodies[0].prompt)).toContain('Raiden Shogun')
  expect(String(bodies[0].prompt)).not.toMatch(/nene_|natsume_|ayachi_nene|shiki_natsume|<lora:/i)
  await expect(page.locator('.result-image-wrap img.result-image')).toHaveCount(1, { timeout: 30000 })
})

test('popular creator · Krea style recipe selection in expert mode lands in the request prompt', async ({ page, request }) => {
  test.setTimeout(240000)
  const bodies: Array<Record<string, unknown>> = []
  page.on('request', browserRequest => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname === '/api/creative/jobs') {
      bodies.push(browserRequest.postDataJSON() as Record<string, unknown>)
    }
  })
  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10 } })
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '雷电将军' }).click()
  await page.locator('.blueprint-card').first().click()
  await page.locator('.engine-switch button').nth(2).click()
  await expect(page.locator('.engine-switch button').nth(2)).toHaveClass(/active/)

  // 配方面板只出现在专家模式；手选「梦幻粉彩」覆盖蓝图 hint（花海 hint 是电影感剧照）。
  await page.getByRole('button', { name: '专家模式', exact: true }).click()
  await page.locator('#stepRecipe summary').click()
  await page.locator('#stepRecipe .recipe-opt').filter({ hasText: '梦幻粉彩' }).click()
  await expect(page.locator('#stepRecipe .recipe-opt.selected')).toContainText('梦幻粉彩')

  const genBtn = page.getByRole('button', { name: '生成图片' })
  await expect(genBtn).toBeEnabled({ timeout: 30000 })
  await genBtn.click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(1)
  const prompt = String(bodies[0].prompt)
  expect(prompt).toContain('A dreamy pastel illustration bathed in soft diffused light')
  expect(prompt).toMatch(/dreamy pastel art\.$/i)
  expect(prompt).not.toMatch(/nene_|natsume_|ayachi_nene|shiki_natsume|<lora:/i)
  await expect(page.locator('.result-image-wrap img.result-image')).toHaveCount(1, { timeout: 30000 })
})

test('popular creator · adult style recipes are invisible to underage characters', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${MOCK_PORTS.gateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '樱岛麻衣' }).click()
  await page.getByRole('button', { name: '专家模式', exact: true }).click()
  await page.locator('#stepRecipe summary').click()
  await expect(page.locator('#stepRecipe .recipe-opt.adult')).toHaveCount(0)
  await expect(page.locator('#stepRecipe .recipe-opt .scene-rating-tag')).toHaveCount(0)
  await expect(page.locator('#stepRecipe .recipe-opt')).toHaveCount(9)
})

test('popular creator · adult gate cannot be bypassed for underage characters', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${MOCK_PORTS.gateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '樱岛麻衣' }).click()
  await expect(page.locator('.popular-outfits')).toBeVisible()

  // 未成年/年龄不明角色：任何视图下都不得出现成人蓝图。
  await expect(page.locator('.blueprint-card[data-adult="true"]')).toHaveCount(0)
  await page.locator('.blueprint-reco-btn').filter({ hasText: '查看全部' }).click()
  await expect(page.locator('.blueprint-card[data-adult="true"]')).toHaveCount(0)

  // 成人筛选分类对非成人角色不可达：选一张普通蓝图，预览不得含显式词。
  await page.locator('.blueprint-card').first().click()
  await expect(page.locator('.preview-output')).not.toContainText('nsfw')
  await expect(page.locator('.preview-output')).not.toContainText('nude')
})

test('popular creator · draft round-trips subject/outfit/blueprint through reload', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${MOCK_PORTS.gateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '雷电将军' }).click()
  await page.locator('.outfit-chip').filter({ hasText: '将军神装' }).click()
  await page.locator('.blueprint-card').first().click()

  // 草稿经 280ms debounce 落盘；等待 localStorage 出现完整热门角色状态。
  await expect.poll(async () => page.evaluate(() => {
    const raw = localStorage.getItem('aics_pb_last_draft')
    if (!raw) return null
    try {
      const draft = JSON.parse(raw)
      return draft.subject === 'popular' && draft.characterId === 'raiden_shogun'
        && draft.outfitId && typeof draft.blueprintId === 'string' && draft.noLora === true ? 'ok' : null
    } catch { return null }
  })).toBe('ok')

  await page.reload()
  await page.waitForTimeout(2000)
  // 刷新后热门角色状态、服装与蓝图选择原样恢复；引擎被强制回 Anima。
  await expect(page.locator('.pb')).toHaveAttribute('data-subject', 'popular')
  await expect(page.locator('.popular-card.active')).toContainText('雷电将军')
  await expect(page.locator('.outfit-chip.active')).toHaveCount(1)
  await expect(page.locator('.blueprint-card.active')).toHaveCount(1)
  await expect(page.locator('.engine-switch button').nth(1)).toHaveClass(/active/)
})

test('popular creator · copy copies the popular-aware prompt', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`http://127.0.0.1:${MOCK_PORTS.gateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '雷电将军' }).click()
  await page.locator('.blueprint-card').first().click()

  // #promptMonitor 是 advanced-decision，basic 模式 display:none，先切专家模式。
  await page.getByRole('button', { name: '专家模式', exact: true }).click()
  await page.locator('#promptMonitor summary').click()
  await page.locator('#promptMonitor .preview-actions .btn-primary').click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  // 复制的必须是 popular prompt：身份锚 + 蓝图词 + [NEG] 负向，且无宁宁/夏目 LoRA 痕迹。
  expect(clipboard).toContain('raiden_shogun')
  expect(clipboard).toContain('[NEG]')
  expect(clipboard).toMatch(/flower field|festival|library|night|snow|street|cafe|sunset/i)
  expect(clipboard).not.toMatch(/ayachi_nene|shiki_natsume|nene_|natsume_|<lora:/i)
})

test('popular creator · select blueprint after Krea is active clamps size to Krea sizes', async ({ page, request }) => {
  test.setTimeout(240000)
  const bodies: Array<Record<string, unknown>> = []
  page.on('request', browserRequest => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname === '/api/creative/jobs') {
      bodies.push(browserRequest.postDataJSON() as Record<string, unknown>)
    }
  })
  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10 } })
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '雷电将军' }).click()
  // 先切 Krea，再选场景：blueprint 推荐尺寸必须收敛到 Krea 白名单，不能 400。
  await page.locator('.engine-switch button').nth(2).click()
  await expect(page.locator('.engine-switch button').nth(2)).toHaveClass(/active/)
  await page.locator('.blueprint-card').first().click()

  const genBtn = page.getByRole('button', { name: '生成图片' })
  await expect(genBtn).toBeEnabled({ timeout: 30000 })
  await genBtn.click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(1)
  const width = Number(bodies[0].width)
  const height = Number(bodies[0].height)
  expect(['1024x1024', '1024x1536', '1536x1024']).toContain(`${width}x${height}`)
  expect(bodies[0].modelId).toBe('krea2-turbo-fp8')
  await expect(page.locator('.result-image-wrap img.result-image')).toHaveCount(1, { timeout: 30000 })
})

test('popular creator · switching back to studio immediately restores the nene LoRA path', async ({ page, request }) => {
  test.setTimeout(240000)
  const bodies: Array<Record<string, unknown>> = []
  page.on('request', browserRequest => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname === '/api/anima/jobs') {
      bodies.push(browserRequest.postDataJSON() as Record<string, unknown>)
    }
  })
  const mockGateway = `http://127.0.0.1:${MOCK_PORTS.gateway}`
  const mockComfy = `http://127.0.0.1:${MOCK_PORTS.translate + 1}`
  await request.post(`${mockComfy}/__mock/reset`)
  await request.post(`${mockComfy}/__mock/fault`, { data: { renderMs: 10, historyTransient: 2 } })
  await page.goto(`${mockGateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  await page.locator('.popular-card').filter({ hasText: '雷电将军' }).click()
  await expect(page.locator('.popular-nolora-badge')).toContainText('无需 LoRA')
  await page.locator('.blueprint-card').first().click()

  // 切回工作室角色：model/lora 必须立即恢复，不等 15s 轮询。
  await page.locator('.char-source-btn').filter({ hasText: '工作室角色' }).click()
  await expect(page.locator('.pb')).toHaveAttribute('data-subject', 'studio')
  await expect(page.locator('.anima-preview-note')).toHaveCount(0)

  const genBtn = page.getByRole('button', { name: '生成图片' })
  await expect(genBtn).toBeEnabled({ timeout: 30000 })
  await genBtn.click()
  await expect.poll(() => bodies.length, { timeout: 30000 }).toBe(1)
  expect(bodies[0].character).toBe('nene')
  expect(bodies[0].loraId).toBe('L_NENE_V20B_ANIMA')
  await expect(page.locator('.result-image-wrap img.result-image')).toHaveCount(1, { timeout: 30000 })
})

test('popular creator · adult blueprint is cleared and unreachable when switching to underage', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${MOCK_PORTS.gateway}/prompt-builder`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('.char-source-btn').filter({ hasText: '热门角色' }).click()
  // 成年角色：默认成熟内容开关开启 → 成人蓝图可见。
  await page.locator('.popular-card').filter({ hasText: '雷电将军' }).click()
  await page.locator('.blueprint-reco-btn').filter({ hasText: '查看全部' }).click()
  await expect(page.locator('.blueprint-card[data-adult="true"]').first()).toBeVisible()
  await page.locator('.blueprint-card[data-adult="true"]').first().click()
  await expect(page.locator('.blueprint-card.active[data-adult="true"]')).toHaveCount(1)

  // 切到未成年角色：成人蓝图必须消失，且已选蓝图被清空、预览不含显式词。
  await page.locator('.popular-card').filter({ hasText: '樱岛麻衣' }).click()
  await expect(page.locator('.blueprint-card[data-adult="true"]')).toHaveCount(0)
  await expect(page.locator('.blueprint-card.active')).toHaveCount(0)
  await expect(page.locator('.preview-output')).not.toContainText('nsfw')
  await expect(page.locator('.preview-output')).not.toContainText('nude')
})
