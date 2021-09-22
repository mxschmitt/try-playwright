import path from 'path'

import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 120 * 1000,
  testDir: path.join(__dirname, 'tests'),
  forbidOnly: !!process.env.CI,
  retries: 2,
  reporter: 'list',
  workers: 1,
  use: {
    trace: 'retry-with-trace',
    ignoreHTTPSErrors: true,
    viewport: {
      width: 1920,
      height: 1080,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
      testIgnore: /api/
    },
    {
      name: 'webkit',
      use: {
        browserName: 'webkit',
      },
      testIgnore: /api/
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
      },
      testIgnore: /api/
    },
    {
      name: 'api',
      testMatch: /api/,
    },
  ],
};

export default config
