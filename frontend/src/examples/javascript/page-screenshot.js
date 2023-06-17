// @ts-check
const playwright = require('playwright');

(async () => {
  // Try to add 'playwright.firefox' to the list ↓
  for (const browserType of [playwright.chromium, playwright.webkit]) {
    const browser = await browserType.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://playwright.dev');
    await page.screenshot({ path: `example-${browserType.name()}.png` });
    await browser.close();
  }
})();