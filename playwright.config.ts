import { defineConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const localChromiumCandidates = process.platform === 'win32' ? [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
] : [];
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  localChromiumCandidates.find(candidate => existsSync(candidate));

// 端口只在 tests/e2e/mock-ports.json 里定义一次，Node 侧（mock-stack.js）
// 与测试侧（flows.spec.ts）共用，避免三处各写一份漂移
const MOCK_PORTS = JSON.parse(
  readFileSync(join(__dirname, 'tests', 'e2e', 'mock-ports.json'), 'utf8')
) as { gateway: number };

const browserUse = {
  baseURL: 'http://127.0.0.1:3000',
  trace: 'retain-on-failure' as const,
  screenshot: 'only-on-failure' as const,
  launchOptions: executablePath ? { executablePath } : {}
};

/**
 * 主流程回归跑在独立网关上（mock 上游），所以不能跟随 desktop 的 baseURL。
 * 其余 project 必须显式排除 flows.spec.ts，否则它们会拿 3000 端口的真上游去跑
 * —— 真上游没启动时那些用例只会「跳过式通过」，等于白测。
 */
const FLOWS_SPEC = /flows\.spec\.ts/;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['line']] : 'line',
  use: {
    ...browserUse,
    viewport: { width: 1440, height: 960 }
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: FLOWS_SPEC,
      use: { ...browserUse, viewport: { width: 1440, height: 960 } }
    },
    {
      name: 'flows',
      testMatch: FLOWS_SPEC,
      use: {
        ...browserUse,
        baseURL: `http://127.0.0.1:${MOCK_PORTS.gateway}`,
        viewport: { width: 1440, height: 1200 }
      }
    },
    {
      name: 'desktop-narrow',
      testMatch: /a11y-device\.spec\.ts/,
      use: { ...browserUse, viewport: { width: 1280, height: 800 } }
    },
    {
      name: 'tablet',
      testMatch: /a11y-device\.spec\.ts/,
      use: { ...browserUse, viewport: { width: 768, height: 1024 } }
    },
    {
      name: 'phone',
      testMatch: /a11y-device\.spec\.ts/,
      use: { ...browserUse, viewport: { width: 390, height: 844 } }
    }
  ],
  webServer: [
    {
      command: 'node server.js',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { DISABLE_TUNNEL: '1' }
    },
    {
      // 四个假上游 + 一个真网关，runtime 目录隔离到 tmp
      command: 'node scripts/tests/mock-stack.js',
      url: `http://127.0.0.1:${MOCK_PORTS.gateway}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { DISABLE_TUNNEL: '1' }
    }
  ]
});
