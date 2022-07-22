// @ts-check
const playwright = require('playwright');

(async () => {
  const { chromium, devices } = playwright;
  const pixel5 = devices['Pixel 5'];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...pixel5,
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: ['geolocation']
  });
  const page = await context.newPage();
  await page.goto('https://www.openstreetmap.org');
  await page.click('[aria-label="Show My Location"]');
  await page.screenshot({ path: 'colosseum-iphone.png' });
  await browser.close();
})();
