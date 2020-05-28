// @ts-check
const { chromium } = require("playwright");
const { saveVideo } = require("playwright-video");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const capture = await saveVideo(page, "/tmp/video.mp4");

  await page.goto("https://github.com");
  await page.type('input[name="q"]', "Playwright");
  await page.press('input[name="q"]', "Enter");
  await page.click(".repo-list-item:nth-child(1) a");

  await capture.stop();
  await browser.close();
})();
