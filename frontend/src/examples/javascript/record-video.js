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

  await page.goto('https://playwright.dev');
  await page.getByRole('link', { name: 'Get started' }).click();
  await page.getByRole('link', { name: 'Installation', exact: true }).click();
  await page.getByRole('link', { name: 'Writing tests', exact: true }).click();
  await page.getByRole('link', { name: 'Running and debugging tests', exact: true }).click();

  await browser.close();
})();
