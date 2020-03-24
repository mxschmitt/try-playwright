const playwright = require("playwright");
const { saveVideo } = require('playwright-video');

(async () => {
  const { devices } = playwright
  const iPhone = devices['iPhone 6'];
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({
    viewport: iPhone.viewport,
    userAgent: iPhone.userAgent,
  });
  const page = await context.newPage();

  const caputure = await saveVideo(page, '/tmp/video.mp4');

  await page.goto('http://example.org');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('a'),
  ]);
  await caputure.stop()
  await browser.close();
})();