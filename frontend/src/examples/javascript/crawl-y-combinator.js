// @ts-check
const playwright = require('playwright');

(async () => {
  const browser = await playwright.webkit.launch();
  const page = await browser.newPage();
  await page.goto('https://news.ycombinator.com');

  // Get all the entries on the page with a CSS selector in this case identified
  // by the class name.
  const entries = page.locator('.athing');

  for (let i = 0; i < await entries.count(); i++) {
    // Query for the next title element on the page
    const title = entries.nth(i).locator('td.title .titleline > a');
    // Write the entry to the console
    console.log(`${i + 1}: ${await title.innerText()}`);
  }

  await page.screenshot({ path: 'Y-Combinator.png' });
  await browser.close();
})();