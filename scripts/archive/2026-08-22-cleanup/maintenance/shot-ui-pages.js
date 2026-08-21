const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS = path.resolve(__dirname, 'ui-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const pages = [
  { path: '/', name: '01-home' },
  { path: '/prompt-builder', name: '02-prompt-builder' },
  { path: '/chat', name: '03-chat' },
  { path: '/scene-explorer', name: '04-scene-explorer' },
  { path: '/showcase', name: '05-showcase' },
  { path: '/gallery', name: '06-gallery' },
  { path: '/control', name: '07-control' },
  { path: '/style', name: '08-style' },
];

(async () => {
  const edgeCandidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const executablePath = edgeCandidates.find(fs.existsSync);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text().slice(0, 120)); });
  for (const p of pages) {
    try {
      await page.goto('http://127.0.0.1:3000' + p.path, { waitUntil: 'networkidle', timeout: 25000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(SHOTS, p.name + '.png') });
      console.log('shot:', p.name);
    } catch (e) {
      console.log('FAIL', p.name, e.message.slice(0, 100));
    }
  }
  await browser.close();
})();
