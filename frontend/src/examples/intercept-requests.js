const playwright = require("playwright");

(async () => {
  const browser = await playwright.webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log and continue all network requests
  page.route('**', (route, request) => {
    console.log(request.url());
    route.continue();
  });

  await page.goto('http://todomvc.com');
  await browser.close();
})();