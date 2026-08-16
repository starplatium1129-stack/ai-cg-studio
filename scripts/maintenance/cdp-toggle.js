// CDP experiment: toggle ui-hidden and watch stage/overlay tracking.
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  let page = null
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      if (p.url().includes('/companion')) page = p
    }
  }
  if (!page) { console.log('NO_PAGE'); await browser.close(); return }

  const readStage = () => page.evaluate(() => {
    const s = document.querySelector('.portrait-stage')
    const r = s.getBoundingClientRect()
    const host = document.querySelector('#live2dHost')
    const hr = host.getBoundingClientRect()
    return {
      stage: { x: r.x, y: r.y, w: r.width, h: r.height },
      host: { x: hr.x, y: hr.y, w: hr.width, h: hr.height },
      uiHidden: document.documentElement.classList.contains('companion-ui-hidden'),
      innerH: window.innerHeight,
    }
  })

  const before = await readStage()
  console.log('BEFORE:', JSON.stringify(before))

  // toggle ui-hidden ON (toolbar+conversation disappear -> stage grows)
  await page.evaluate(() => document.documentElement.classList.add('companion-ui-hidden'))
  await page.waitForTimeout(800)
  const hidden = await readStage()
  console.log('UI_HIDDEN:', JSON.stringify(hidden))

  // toggle OFF
  await page.evaluate(() => document.documentElement.classList.remove('companion-ui-hidden'))
  await page.waitForTimeout(800)
  const after = await readStage()
  console.log('AFTER:', JSON.stringify(after))
  await browser.close()
}

main().catch((e) => { console.error('ERR:', e); process.exit(1) })
