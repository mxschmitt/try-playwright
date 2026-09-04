// @ts-check
const playwright = require('playwright');

const IMAGE_URL = 'https://placehold.co/300x70?text=Yey+Playwright!';

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({
    // Cloudflare does block us otherwise
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
  });
  // Production enables Cloudflare Turnstile for real users. Automated browsers
  // fail that check (Turnstile error 600010) and never POST /service/control/run,
  // so this intercept demo would hang. The playground honors this flag.
  await context.addInitScript(() => {
    window['__TRY_PLAYWRIGHT_TURNSTILE__'] = 'noop';
  });
  const page = await context.newPage();
  // Open the exact same page on which we are right now
  await page.goto('https://try.playwright.tech');

  // Intercept here all the API requests to the backend of the 'Try Playwright'
  // service. We respond for all the backend calls which are made by pressing the
  // 'Run' button a hard-coded response which will lead to a blue banner with the
  // text Playwright.
  await page.route('**/service/control/run', (route) => {
    // Here you can either modify the response by using 'route.fulfill()' or
    // just continue as normal by using 'route.continue()'. Try to remove
    // the entire statement and replace it with the other one in the bottom.
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        version: 'We are intercepting Requests',
        duration: 12346789,
        files: [{
          fileName: 'banner.png',
          publicURL: IMAGE_URL,
          extension: '.png'
        }],
        output: ''
      })
    })

    // By using this statement the default example will be executed and you dont
    // see anymore the custom one. So we just pass all requests through.

    // route.continue()
  })

  await Promise.all([
    // Wait until the image is fully loaded
    page.waitForResponse(response => (
      response.url().includes('placehold.co') || response.url().endsWith('.png')
    )),
    page.getByRole('button', {
      name: 'Run'
    }).click(),
  ]);

  // Make a screenshot in the end to see the result
  await page.screenshot({ path: `window.png` });

  await browser.close();
})();
