interface Example {
  title: string
  code: string
}

export const Examples: Example[] = [
  {
    title: "Page screenshot",
    code: `for (const browserType of ['chromium', 'firefox', 'webkit']) {
  const browser = await playwright[browserType].launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://whatsmyuseragent.org/');
  await page.screenshot({ path: \`example-\${browserType}.png\` });
  await browser.close();
}`
  }, {
    title: "Mobile and geolocation",
    code: `const { webkit, devices } = playwright;
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
await browser.close();`
  }, {
    title: "Generate a PDF",
    code: `const browser = await playwright.chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto('https://www.google.com/search?q=Google');
await page.pdf({ path: \`document.pdf\` });
await browser.close();`
  },
]