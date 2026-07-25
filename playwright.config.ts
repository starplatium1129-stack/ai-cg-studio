import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChromiumCandidates = process.platform === 'win32' ? [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
] : [];
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  localChromiumCandidates.find(candidate => existsSync(candidate));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['line']] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {}
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
    env: { DISABLE_TUNNEL: '1' }
  }
});
