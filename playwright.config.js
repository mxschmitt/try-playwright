import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: true,
  workers: 2,
  retries: 0,
  repeatEach: 3,
  use: {
    baseURL: "http://127.0.0.1:4182",
  },
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4182 --strictPort",
    url: "http://127.0.0.1:4182",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], headless: true },
    },
  ],
});
