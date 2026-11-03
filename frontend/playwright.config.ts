import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-components.
 */
// Keep this off the Vite dev server's default port so a different app
// already listening on 5173 is not reused as the gallery.
const galleryURL = 'http://localhost:3100/playwright/gallery/index.html';

const config = defineConfig({
  testDir: './',
  testMatch: '**/*.spec.ts',
  /* Maximum time one test can run for. */
  timeout: 10 * 1000,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    baseURL: galleryURL,
    serviceWorkers: 'block',
    reuseContext: true,
  },
  webServer: {
    command: 'npm run dev -- --port 3100 --strictPort',
    url: galleryURL,
    reuseExistingServer: !process.env.CI,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],
});

export default config;
