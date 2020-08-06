const ROOT_URL = process.env.ROOT_TEST_URL || "https://localhost"

jest.setTimeout(35 * 1000)

beforeAll(async () => {
  await page.goto(ROOT_URL);
});

const executeExample = async (page, nth, switchToExamples=true) => {
  if (switchToExamples) {
    await page.click('button[data-test-id="toggel-right-panel"]')
  }
  await page.click(`.rs-panel-group > .rs-panel:nth-child(${nth})`);
  await page.click('text="Run"');
  await page.waitForResponse(resp => resp.url().endsWith("/api/v1/run"))
}

const getImageCount = async (page) => {
  await page.waitForSelector('p[data-test-id="file"]')
  return await page.$$eval('p[data-test-id="file"] > img', (images) => images.length)
}
const getVideoCount = async (page) => {
  await page.waitForSelector(".rs-panel-body video")
  return await page.$$eval('p[data-test-id="file"] video', (videos) => videos.length)
}
const getFileNames = (page) => page.$$eval('p[data-test-id="file"] span.file-name', (elements) => elements.map(el => el.innerText))
const getConsoleLines = async (page) => {
  await page.waitForSelector(".rs-panel-body code")
  return await page.$eval(".rs-panel-body code", (code) => code.innerText.split(/\n/).filter(Boolean))
}

describe('Examples', () => {
  it("1: should be able to make screenshots in all browsers", async () => {
    await executeExample(page, 1, false)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(2)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["example-chromium.png", "example-webkit.png"])
  })
  it("2: should be able to set the geolocation", async () => {
    await executeExample(page, 2)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["colosseum-iphone.png"])
  })
  it("3: should be able to generate a PDF file", async () => {
    await executeExample(page, 3)
    await page.waitForSelector(".rs-panel-body object")
    const pdfCount = await page.$$eval('p[data-test-id="file"] object', (objects) => objects.length)
    expect(pdfCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["document.pdf"])
  })
  it("4: should be able to record via 'playwright-video'", async () => {
    await executeExample(page, 4)
    const videoCount = await getVideoCount(page)
    expect(videoCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["/tmp/video.mp4"])
  })
  it("5: should be able to execute something in the browser context", async () => {
    await executeExample(page, 5)
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBe(1)
    const parsed = JSON.parse(logStatements[0])
    expect(Object.keys(parsed)).toEqual(["width", "height", "deviceScaleFactor"])
  })
  it("6: should be able to intercept network requests", async () => {
    await executeExample(page, 6)
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBeGreaterThan(20) // just so we know that something is going on here
    const allStartsWithHttpOrHttpsProtocol = logStatements.every(entry => entry.startsWith("http://") || entry.startsWith("https://"))
    expect(allStartsWithHttpOrHttpsProtocol).toBe(true)
  })
  it("7: should be able to intercept and modify network requests", async () => {
    await executeExample(page, 7)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["window.png"])
  })
  it("8: should be able to run the todomvc.com example", async () => {
    await executeExample(page, 8)
    const videoCount = await getVideoCount(page)
    expect(videoCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["video.mp4"])
  })
  it("9: should be able to run the y-combinator crawling example", async () => {
    await executeExample(page, 9)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["Y-Combinator.png"])
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBeGreaterThan(20)
  })
});
