// @ts-check
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: {
      dir: 'videos/'
    }
  });
  const page = await context.newPage();

  await page.goto('https://github.com');
  await page.type('input[name="q"]', 'Playwright');
  await page.press('input[name="q"]', 'Enter');
  await page.click('.repo-list-item:nth-child(1) a');
  await page.waitForLoadState('networkidle');

  await browser.close();
})();
