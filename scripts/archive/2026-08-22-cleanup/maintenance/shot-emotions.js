const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOTS = path.resolve(__dirname, 'ui-shots');
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const edgeCandidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const executablePath = edgeCandidates.find(fs.existsSync);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto('http://127.0.0.1:3000/prompt-builder', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '02-prompt-builder-emotions.png') });
  console.log('shot: 02-prompt-builder-emotions');
  await browser.close();
})();
