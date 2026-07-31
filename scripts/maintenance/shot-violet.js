const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS = path.resolve(__dirname, 'ui-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const pages = [
  { path: '/', name: '01-home-violet' },
  { path: '/prompt-builder', name: '02-prompt-builder-violet' },
  { path: '/showcase', name: '05-showcase-violet' },
  { path: '/chat', name: '03-chat-violet' },
];

(async () => {
  const edgeCandidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const executablePath = edgeCandidates.find(fs.existsSync);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, colorScheme: 'dark' });
  const page = await context.newPage();
  // 强制暗色：清除本地存储的主题偏好，并设置 color-scheme
  await page.addInitScript(() => { try { localStorage.removeItem('aics_theme') } catch {} });
  for (const p of pages) {
    try {
      await page.goto('http://127.0.0.1:3000' + p.path, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SHOTS, p.name + '.png') });
      console.log('shot:', p.name);
    } catch (e) { console.log('FAIL', p.name, e.message.slice(0, 80)); }
  }
  await browser.close();
})();
