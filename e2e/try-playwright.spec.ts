import { Page } from 'playwright';
import { expect, folio } from '@playwright/test';

const fixtures = folio.extend();
fixtures.contextOptions.override(async ({ contextOptions }, runTest) => {
  await runTest({
    ...contextOptions,
    ignoreHTTPSErrors: true,
    viewport: {
      width: 1920,
      height: 1080
    }
  });
});
const { it, describe } = fixtures.build();

const ROOT_URL = process.env.ROOT_TEST_URL || "https://localhost"

const executeExample = async (page: Page, nth: number): Promise<void> => {
  await page.goto(ROOT_URL, { waitUntil: "networkidle" });
  await page.click(`.rs-panel-group > .rs-panel:nth-child(${nth})`);
  await page.click('text="Run"');
  await page.waitForResponse(resp => resp.url().endsWith("/service/control/run"))
}

const getImageCount = async (page: Page): Promise<number> => {
  await page.waitForSelector('p[data-test-id="file"]')
  return await page.$$eval('p[data-test-id="file"] > img', (images) => images.length)
}
const getVideoCount = async (page: Page): Promise<number> => {
  await page.waitForSelector(".rs-panel-body video")
  return await page.$$eval('p[data-test-id="file"] video', (videos) => videos.length)
}
const getFileNames = (page: Page): Promise<string[]> => page.$$eval<string[], HTMLSpanElement>('p[data-test-id="file"] span.file-name', (elements) => elements.map(el => el.innerText))
const getConsoleLines = async (page: Page): Promise<string[]> => {
  await page.waitForSelector(".rs-panel-body code")
  return await page.$eval<string[], HTMLElement>(".rs-panel-body code", (code) => code.innerText.split(/\n/).filter(Boolean))
}

describe('Examples', () => {
  it("1: should be able to make screenshots in all browsers", async ({ page }) => {
    await executeExample(page, 1)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(2)
    const imageNames = await getFileNames(page)
    expect(new Set(imageNames)).toEqual(new Set(["example-chromium.png", "example-webkit.png"]))
  })
  it("2: should be able to set the geolocation", async ({ page }) => {
    await executeExample(page, 2)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["colosseum-iphone.png"])
  })
  it("3: should be able to generate a PDF file", async ({ page }) => {
    await executeExample(page, 3)
    await page.waitForSelector(".rs-panel-body object")
    const pdfCount = await page.$$eval('p[data-test-id="file"] object', (objects) => objects.length)
    expect(pdfCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["document.pdf"])
  })
  it("4: should be able to record a video", async ({ page }) => {
    await executeExample(page, 4)
    const videoCount = await getVideoCount(page)
    expect(videoCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames.length).toBe(1)
    expect(imageNames[0].endsWith(".webm")).toBe(true)
  })
  it("5: should be able to execute something in the browser context", async ({ page }) => {
    await executeExample(page, 5)
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBe(1)
    const parsed = JSON.parse(logStatements[0])
    expect(Object.keys(parsed)).toEqual(["width", "height", "deviceScaleFactor"])
  })
  it("6: should be able to intercept network requests", async ({ page }) => {
    await executeExample(page, 6)
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBeGreaterThan(20) // just so we know that something is going on here
    const allStartsWithHttpOrHttpsProtocol = logStatements.every(entry => entry.startsWith("http://") || entry.startsWith("https://"))
    expect(allStartsWithHttpOrHttpsProtocol).toBe(true)
  })
  it("7: should be able to intercept and modify network requests", async ({ page }) => {
    await executeExample(page, 7)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["window.png"])
  })
  it("8: should be able to run the todomvc.com example", async ({ page }) => {
    await executeExample(page, 8)
    const videoCount = await getVideoCount(page)
    expect(videoCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames.length).toBe(1)
    expect(imageNames[0].endsWith(".webm")).toBe(true)
  })
  it("9: should be able to run the y-combinator crawling example", async ({ page }) => {
    await executeExample(page, 9)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["Y-Combinator.png"])
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBeGreaterThan(20)
  })
});

describe("Share functionality", () => {
  it("should not generate share URL for predefined example", async ({ page }) => {
    await page.goto(ROOT_URL, { waitUntil: "networkidle" });
    await page.click("text='Share'")
    await page.waitForTimeout(500)
    expect(page.url()).toBe(`${ROOT_URL}/?e=page-screenshot`)
  })
  it("should not generate share URL for predefined example", async ({ page }) => {
    await page.goto(ROOT_URL, { waitUntil: "networkidle" });

    await page.click(".monaco-editor")
    await page.keyboard.press("Meta+KeyA")
    await page.keyboard.type('console.log("FolioAssert")')

    await page.click("text='Share'")
    await page.waitForTimeout(500)
    expect(page.url().startsWith(`${ROOT_URL}/?s=`)).toBeTruthy()

    await page.reload()
    await page.click("text='Run'")
    await page.waitForSelector("text=FolioAssert")
  })
})

describe("should handle platform core related features", test => {
  test.slow();
}, () => {
  it("should handle the timeout correctly", async ({ page }) => {
    const CODE = `(async () => {
  await new Promise(resolve => setTimeout(resolve, 40 * 1000))`
    await page.goto(ROOT_URL, { waitUntil: "networkidle" });
    await page.click(".monaco-editor")
    await page.keyboard.press("Meta+KeyA")
    await page.keyboard.type(CODE)
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.type("();")

    await page.click("text='Run'")
    await page.waitForSelector("text='Error: Timeout!'", {
      timeout: 40 * 1000
    })
  })
})