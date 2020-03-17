export interface Example {
  title: string;
  description?: string;
  code: string;
}

export const Examples: Example[] = [
  {
    title: "Page screenshot",
    description: "This code snippet navigates to whatsmyuseragent.org in Chromium and WebKit, and saves 3 screenshots.",
    code: `const playwright = require("playwright");

(async () => {
  for (const browserType of ['chromium', 'webkit']) {
    const browser = await playwright[browserType].launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://whatsmyuseragent.org/');
    await page.screenshot({ path: \`example-\${browserType}.png\` });
    await browser.close();
  }
})();`
  }, {
    title: "Mobile and geolocation",
    description: "This snippet emulates Mobile Safari on a device at a given geolocation, navigates to maps.google.com, performs action and takes a screenshot.",
    code: `const playwright = require("playwright");

(async () => {
  const { webkit, devices } = playwright;
  const iPhone11 = devices['iPhone 11 Pro'];
  const browser = await webkit.launch();
  const context = await browser.newContext({
    viewport: iPhone11.viewport,
    userAgent: iPhone11.userAgent,
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: { 'https://www.google.com': ['geolocation'] }
  });
  const page = await context.newPage();
  await page.goto('https://maps.google.com');
  await page.click(".ml-my-location-fab button");
  await page.waitForRequest(/.*preview\\/pwa/);
  await page.screenshot({ path: 'colosseum-iphone.png' });
  await browser.close();
})();`
  }, {
    title: "Generate a PDF",
    description:"This example will search for 'Google' on Google and stores the rendered site as a PDF.",
    code: `const playwright = require("playwright");

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.google.com/search?q=Google');
  await page.pdf({ path: \`document.pdf\` });
  await browser.close();
})();`
  }, {
    title: "Record a video using 'playwright-video'",
    description: "This example navigates to 'example.com', clicks on the first 'a' link and stores it as a video.",
    code: `const playwright = require("playwright");
const { saveVideo } = require('playwright-video');

(async () => {
  const { devices } = playwright
  const iPhone = devices['iPhone 6'];
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({
    viewport: iPhone.viewport,
    userAgent: iPhone.userAgent,
  });
  const page = await context.newPage();

  const caputure = await saveVideo(page, '/tmp/video.mp4');

  await page.goto('http://example.org');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('a'),
  ]);
  await caputure.stop()
  await browser.close();
})();`
  }, {
    title: "Evaluate in browser context",
    description: "This code snippet navigates to example.com in WebKit, and executes a script in the page context.",
    code: `const playwright = require("playwright");

(async () => {
  const browser = await playwright.webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.example.com/');
  const dimensions = await page.evaluate(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
      deviceScaleFactor: window.devicePixelRatio
    }
  })
  console.log(JSON.stringify(dimensions));

  await browser.close();
})();`
  }, {
    title: `Intercept network requests`,
    description: "This code snippet sets up network interception for a WebKit page to log all network requests.",
    code: `const playwright = require("playwright");

(async () => {
  const browser = await playwright.webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log and continue all network requests
  page.route('**', request => {
    console.log(request.url());
    request.continue();
  });

  await page.goto('http://todomvc.com');
  await browser.close();
})();`
  }
]