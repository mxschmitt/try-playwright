import { Page } from 'playwright';
import { expect, test } from '@playwright/test';
import { ROOT_URL } from './utils';

const executeExample = async (page: Page, nth: number): Promise<void> => {
  await page.goto(ROOT_URL, { waitUntil: "networkidle" });
  await page.click(`.rs-panel-group > .rs-panel:nth-child(${nth})`);
  await Promise.all([
    page.waitForResponse("**/service/control/run"),
    page.click('text="Run"'),
  ])
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

test.describe('Examples', () => {
  test("1: should be able to make screenshots in all browsers", async ({ page }) => {
    await executeExample(page, 1)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(2)
    const imageNames = await getFileNames(page)
    expect(new Set(imageNames)).toEqual(new Set(["example-chromium.png", "example-webkit.png"]))
  })
  test("2: should be able to set the geolocation", async ({ page }) => {
    await executeExample(page, 2)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["colosseum-iphone.png"])
  })
  test("3: should be able to generate a PDF file", async ({ page }) => {
    await executeExample(page, 3)
    await page.waitForSelector(".rs-panel-body object")
    const pdfCount = await page.$$eval('p[data-test-id="file"] object', (objects) => objects.length)
    expect(pdfCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["document.pdf"])
  })
  test("4: should be able to record a video", async ({ page }) => {
    await executeExample(page, 4)
    const videoCount = await getVideoCount(page)
    expect(videoCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames.length).toBe(1)
    expect(imageNames[0].endsWith(".webm")).toBe(true)
  })
  test("5: should be able to execute something in the browser context", async ({ page }) => {
    await executeExample(page, 5)
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBe(1)
    const parsed = JSON.parse(logStatements[0])
    expect(Object.keys(parsed)).toEqual(["width", "height", "deviceScaleFactor"])
  })
  test("6: should be able to intercept network requests", async ({ page }) => {
    await executeExample(page, 6)
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBeGreaterThan(20) // just so we know that something is going on here
    const allStartsWithHttpOrHttpsProtocol = logStatements.every(entry => entry.startsWith("http://") || entry.startsWith("https://"))
    expect(allStartsWithHttpOrHttpsProtocol).toBe(true)
  })
  test("7: should be able to intercept and modify network requests", async ({ page }) => {
    await executeExample(page, 7)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["window.png"])
  })
  test("8: should be able to run the todomvc.com example", async ({ page }) => {
    await executeExample(page, 8)
    const videoCount = await getVideoCount(page)
    expect(videoCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames.length).toBe(1)
    expect(imageNames[0].endsWith(".webm")).toBe(true)
  })
  test("9: should be able to run the y-combinator crawling example", async ({ page }) => {
    await executeExample(page, 9)
    const imageCount = await getImageCount(page)
    expect(imageCount).toBe(1)
    const imageNames = await getFileNames(page)
    expect(imageNames).toEqual(["Y-Combinator.png"])
    const logStatements = await getConsoleLines(page)
    expect(logStatements.length).toBeGreaterThan(20)
  })
});

test.describe("Share functionality", () => {
  test("should not generate share URL for predefined example", async ({ page }) => {
    await page.goto(ROOT_URL, { waitUntil: "networkidle" });
    await page.click("text='Share'")
    await page.waitForTimeout(500)
    expect(page.url()).toBe(`${ROOT_URL}/?l=javascript&e=page-screenshot`)
  })
  test("should generate share URL", async ({ page }) => {
    await page.goto(ROOT_URL, { waitUntil: "networkidle" });

    await page.click(".monaco-editor")
    await page.keyboard.press("Meta+KeyA")
    await page.keyboard.type('console.log("FolioAssert")')

    await page.click("text='Share'")
    await page.waitForTimeout(500)
    expect(page.url().startsWith(`${ROOT_URL}/?l=javascript&s=`)).toBeTruthy()

    await page.reload()
    await page.click("text='Run'")
    await page.waitForSelector("text=FolioAssert")
  })
})

test.describe("should handle platform core related features", () => {
  test("should handle the timeout correctly", async ({ page }) => {
    const CODE = `(async () => {
  await new Promise(resolve => setTimeout(resolve, 70 * 1000))`
    await page.goto(ROOT_URL, { waitUntil: "networkidle" });
    await page.click(".monaco-editor")
    await page.keyboard.press("Meta+KeyA")
    await page.keyboard.type(CODE)
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.type("();")

    await page.click("text='Run'")
    await page.waitForSelector("text=Execution timeout!", {
      timeout: 70 * 1000
    })
  })
  test("should handle uncaughtException correctly", async ({ page }) => {
    await page.goto(ROOT_URL);
    await page.waitForTimeout(200)
    await page.evaluate(() => {
      // @ts-ignore
      window.monacoEditorModel.setValue(`// @ts-check
const playwright = require("playwright");

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  page.route("**/*", () => {
    throw new Error("foobar!")
  })
  await page.goto("https://example.com")
  await browser.close();
})();`)
    })
    await page.waitForTimeout(200)
    await page.click("text='Run'")
    await page.waitForSelector("text=Error: foobar!")
  })
  test("should prevent access to the control microservice from inside the worker", async ({ page }) => {
    await page.goto(ROOT_URL);
    await page.waitForTimeout(200)
    await page.evaluate(() => {
      // @ts-ignore
      window.monacoEditorModel.setValue(`// @ts-check
const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const response = await page.goto('http://control:8080/service/control/health');
  console.log(\`Status: \${response.status()}\`)
  await browser.close();
})();`)
    })
    await page.waitForTimeout(200)
    await Promise.all([
      page.waitForSelector("text=Status: 500"),
      page.click("text='Run'")
    ])
  })
})