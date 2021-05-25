import path from 'path'

import { PlaywrightTestProject, PlaywrightTestConfig } from '@playwright/test';

const options = {
  ignoreHTTPSErrors: true,
  viewport: {
    width: 1920,
    height: 1080,
  },
};

const projects: PlaywrightTestProject[] = [
  {
    name: 'chromium',
    use: {
      browserName: 'chromium',
      ...options,
    },
    testIgnore: /api/
  },
  {
    name: 'webkit',
    use: {
      browserName: 'webkit',
      ...options,
    },
    testIgnore: /api/
  },
  {
    name: 'firefox',
    use: {
      browserName: 'firefox',
      ...options,
    },
    testIgnore: /api/
  },
  {
    name: 'api',
    testMatch: /api/,
  },
];

const config: PlaywrightTestConfig = {
  timeout: 120 * 1000,
  testDir: path.join(__dirname, 'tests'),
  forbidOnly: !!process.env.CI,
  retries: 2,
  reporter: ['list'],
  projects,
};

export default config
