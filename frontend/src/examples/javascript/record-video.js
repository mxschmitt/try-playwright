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
  await page.getByRole('button', { name: 'Search or jump to...' }).click()
  await page.getByRole('combobox', { name: 'Search' }).fill('Playwright')
  await page.getByRole('combobox', { name: 'Search' }).press('Enter')
  await page.getByRole('link', { name: 'microsoft/playwright', exact: true }).click()
  await page.waitForLoadState('networkidle');

  await browser.close();
})();
