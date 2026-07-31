const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS = path.resolve(__dirname, 'ui-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const pages = [
  { path: '/prompt-builder', name: '02-prompt-builder-v2' },
  { path: '/color-script', name: '09-color-script' },
  { path: '/scenario', name: '10-scenario' },
];

(async () => {
  const edgeCandidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const executablePath = edgeCandidates.find(fs.existsSync);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
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
