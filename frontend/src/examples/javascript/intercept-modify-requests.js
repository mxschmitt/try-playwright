// @ts-check
const playwright = require('playwright');

const IMAGE_URL = 'https://via.placeholder.com/300x70/e74c3c/2c3e50/?text=Yey%20Playwright!';

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  // Open the exact same page on which we are right now
  await page.goto('https://try.playwright.tech');

  // Intercept here all the API requests to the backend of the 'Try Playwright'
  // service. We respond for all the backend calls which are made by pressing the
  // 'Run' button a hard-coded response which will lead to a blue banner with the
  // text Playwright.
  await page.route('https://try.playwright.tech/service/control/run', (route) => {
    // Here you can either modify the response by using 'route.fulfill()' or
    // just continue as normal by using 'route.continue()'. Try to remove
    // the entire statement and replace it with the other one in the bottom.
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 'We are intercepting Requests',
        duration: 12346789,
        files: [{
          filename: 'banner.png',
          publicURL: IMAGE_URL,
          extension: '.png'
        }],
        logs: []
      })
    })

    // By using this statement the default example will be executed and you dont
    // see anymore the custom one. So we just pass all requests through.

    // route.continue()
  })

  await page.click('"Run"')

  // Wait until the image is fully loaded
  await page.waitForResponse(response => (
    response.url().endsWith(IMAGE_URL) || response.url().endsWith('.png')
  ))

  // Make a screenshot in the end to see the result
  await page.screenshot({ path: `window.png` });

  await browser.close();
})();
