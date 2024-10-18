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

  for (let i = 0; i < 3; i++) {
    await page.goto('https://news.ycombinator.com/');
    await page.getByRole('link', { name: 'new', exact: true }).click();
    await page.locator('.pagetop > a').first().click();
    await page.getByRole('link', { name: 'comments', exact: true }).click();
    await page.getByRole('link', { name: 'ask' }).click();
    await page.getByRole('link', { name: 'show' }).click();
    await page.getByRole('link', { name: 'jobs' }).click();
    await page.getByRole('link', { name: 'login' }).click();
  }

  await browser.close();
})();
