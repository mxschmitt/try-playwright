const qawolf = require("qawolf");

let browser;
let page;

const ROOT_URL = process.env.ROOT_TEST_URL || "https://localhost"

beforeAll(async () => {
  browser = await qawolf.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  await qawolf.register(context);
  page = await context.newPage();
  await page.goto(ROOT_URL);
});

afterAll(async () => {
  await browser.close();
});

const executeExample = async (nth, switchToExamples=true) => {
  if (switchToExamples) {
    await page.click('button[data-test-id="toggel-right-panel"]')
  }
  await page.click(`.rs-panel-group > .rs-panel:nth-child(${nth})`);
  await page.click('text="Run"');
  await page.waitForResponse(resp => resp.url().endsWith("/api/v1/run"))
}

const getImageCount = async () => {
  await page.waitFor('p[data-test-id="file"]')
  return await page.$$eval('p[data-test-id="file"] > img', (images) => images.length)
}
const getVideoCount = () => page.$$eval('p[data-test-id="file"] video', (videos) => videos.length)
const getFileNames = () => page.$$eval('p[data-test-id="file"] span.file-name', (elements) => elements.map(el => el.innerText))
const getConsoleLines = async () => {
  await page.waitFor(".rs-panel-body code")
  return await page.$eval(".rs-panel-body code", (code) => code.innerText.split(/\n/).filter(Boolean))
}

describe('Examples', () => {
  it("1: should be able to make screenshots in all browsers", async () => {
    await executeExample(1, false)
    const imageCount = await getImageCount()
    expect(imageCount).toBe(2)
    const imageNames = await getFileNames()
    expect(imageNames).toEqual(["example-chromium.png", "example-webkit.png"])
  })
  it("2: should be able to set the geolocation", async () => {
    await executeExample(2)
    const imageCount = await getImageCount()
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames()
    expect(imageNames).toEqual(["colosseum-iphone.png"])
  })
  it("3: should be able to generate a PDF file", async () => {
    await executeExample(3)
    await page.waitFor(".rs-panel-body object")
    const pdfCount = await page.$$eval('p[data-test-id="file"] object', (objects) => objects.length)
    expect(pdfCount).toBe(1)
    const imageNames = await getFileNames()
    expect(imageNames).toEqual(["document.pdf"])
  })
  it("4: should be able to record via 'playwright-video'", async () => {
    await executeExample(4)
    await page.waitFor(".rs-panel-body video")
    const videoCount = await getVideoCount()
    expect(videoCount).toBe(1)
    const imageNames = await getFileNames()
    expect(imageNames).toEqual(["/tmp/video.mp4"])
  })
  it("5: should be able to execute something in the browser context", async () => {
    await executeExample(5)
    const logStatements = await getConsoleLines()
    expect(logStatements.length).toBe(1)
    const parsed = JSON.parse(logStatements[0])
    expect(Object.keys(parsed)).toEqual(["width", "height", "deviceScaleFactor"])
  })
  it("6: should be able to intercept network requests", async () => {
    await executeExample(6)
    const logStatements = await getConsoleLines()
    expect(logStatements.length).toBeGreaterThan(20) // just so we know that something is going on here
    const allStartsWithHttpOrHttpsProtocol = logStatements.every(entry => entry.startsWith("http://") || entry.startsWith("https://"))
    expect(allStartsWithHttpOrHttpsProtocol).toBe(true)
  })
  it("7: should be able to intercept and modify network requests", async () => {
    await executeExample(7)
    const imageNames = await getFileNames()
    expect(imageNames).toEqual(["window.png"])
  })
  it("8: should be able to run the todomvc.com example", async () => {
    await executeExample(8)
    await page.waitFor(".rs-panel-body video")
    const videoCount = await getVideoCount()
    expect(videoCount).toBe(1)
    const imageNames = await getFileNames()
    expect(imageNames).toEqual(["video.mp4"])
  })
});
