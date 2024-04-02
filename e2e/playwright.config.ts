import path from 'path'

import { defineConfig } from '@playwright/test';

let baseURL = 'http://localhost:8080';
{
  const { ROOT_TEST_URL } = process.env;
  if (ROOT_TEST_URL) {
    if (ROOT_TEST_URL.at(-1) === '/')
      baseURL = ROOT_TEST_URL.slice(0, -1);
    else
      baseURL = ROOT_TEST_URL;
  }
}

const config = defineConfig({
  timeout: 120 * 1000,
  testDir: path.join(__dirname, 'tests'),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : undefined,
  reporter: 'html',
  workers: 1,
  use: {
    trace: process.env.CI ? 'on-all-retries' : undefined,
    ignoreHTTPSErrors: true,
    viewport: {
      width: 1920,
      height: 1080,
    },
    baseURL,
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
});

export default config
