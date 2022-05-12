import { expect, test as base, Page } from '@playwright/test';

class TryPlaywrightPage {
  constructor(private readonly page: Page) { }
  async executeExample(nth: number): Promise<void> {
    await this.page.goto('/?l=javascript');
    await this.page.locator(`.rs-panel-group > .rs-panel:nth-child(${nth})`).click();
    await Promise.all([
      this.page.waitForResponse("**/service/control/run"),
      this.page.locator('text="Run"').click(),
    ])
  }
  async getConsoleLines(): Promise<string[]> {
    let consoleLines = this.page.locator(".rs-panel-body code")
    await consoleLines.waitFor();
    return await consoleLines.evaluate<string[], HTMLElement>((code) => code.innerText.split(/\n/).filter(Boolean))
  }
  images = this.page.locator('p[data-test-id="file"] > img');
  pdfs = this.page.locator('p[data-test-id="file"] object');
  videos = this.page.locator('p[data-test-id="file"] video');
  fileNames = this.page.locator('p[data-test-id="file"] span.file-name')
}



const test = base.extend<{ tpPage: TryPlaywrightPage }>({
  tpPage: async ({ page }, using) => {
    const tryPlaywrightPage = new TryPlaywrightPage(page);
    await using(tryPlaywrightPage);
  }
});

test.describe('Examples', () => {
  test("1: should be able to make screenshots in all browsers", async ({ tpPage }) => {
    await tpPage.executeExample(1)
    await expect(tpPage.images).toHaveCount(2)
    await expect(tpPage.videos).toHaveCount(0)
    await expect(tpPage.fileNames).toHaveText([
      "example-chromium.png",
      "example-webkit.png",
    ])
  })
  test("2: should be able to set the geolocation", async ({ tpPage }) => {
    await tpPage.executeExample(2)
    await expect(tpPage.images).toHaveCount(1)
    await expect(tpPage.videos).toHaveCount(0)
    await expect(tpPage.fileNames).toHaveText([
      "colosseum-iphone.png"
    ])
  })
  test("3: should be able to generate a PDF file", async ({ page, tpPage }) => {
    await tpPage.executeExample(3)
    await expect(tpPage.pdfs).toHaveCount(1)
    await expect(tpPage.images).toHaveCount(0)
    await expect(tpPage.videos).toHaveCount(0)
    await expect(tpPage.fileNames).toHaveText([
      "document.pdf"
    ])
  })
  test("4: should be able to record a video", async ({ page, tpPage }) => {
    await tpPage.executeExample(4)
    await expect(tpPage.images).toHaveCount(0)
    await expect(tpPage.videos).toHaveCount(1)
    await expect(tpPage.fileNames).toHaveText([
      /.*\.webm/
    ])
  })
  test("5: should be able to execute something in the browser context", async ({ page, tpPage }) => {
    await tpPage.executeExample(5)
    const logStatements = await tpPage.getConsoleLines()
    expect(logStatements.length).toBe(1)
    const parsed = JSON.parse(logStatements[0])
    expect(Object.keys(parsed)).toEqual(["width", "height", "deviceScaleFactor"])
  })
  test("6: should be able to intercept network requests", async ({ tpPage }) => {
    await tpPage.executeExample(6)
    const logStatements = await tpPage.getConsoleLines()
    expect(logStatements.length).toBeGreaterThan(20) // just so we know that something is going on here
    const allStartsWithHttpOrHttpsProtocol = logStatements.every(entry => entry.startsWith("http://") || entry.startsWith("https://"))
    expect(allStartsWithHttpOrHttpsProtocol).toBe(true)
  })
  test("7: should be able to intercept and modify network requests", async ({ tpPage }) => {
    await tpPage.executeExample(7)
    await expect(tpPage.images).toHaveCount(1)
    await expect(tpPage.fileNames).toHaveText([
      "window.png"
    ])
  })
  test("8: should be able to run the todomvc.com example", async ({ tpPage }) => {
    await tpPage.executeExample(8)
    await expect(tpPage.videos).toHaveCount(1)
    await expect(tpPage.fileNames).toHaveText([
      /.*\.webm/
    ])
  })
  test("9: should be able to run the y-combinator crawling example", async ({ tpPage }) => {
    await tpPage.executeExample(9)
    await expect(tpPage.images).toHaveCount(1)
    await expect(tpPage.fileNames).toHaveText([
      "Y-Combinator.png"
    ])
    const logStatements = await tpPage.getConsoleLines()
    expect(logStatements.length).toBeGreaterThan(20)
  })
});

test.describe("Share functionality", () => {
  test("should not generate share URL for predefined example", async ({ page }) => {
    await page.goto('?l=javascript');
    await page.click("text='Share'")
    await page.waitForTimeout(500)
    await expect(page).toHaveURL('/?l=javascript&e=page-screenshot')
  })
  test("should generate share URL", async ({ page, baseURL }) => {
    await page.goto('?l=javascript');

    await page.click(".monaco-editor")
    await page.keyboard.press("Meta+KeyA")
    await page.keyboard.type('console.log("FolioAssert")')

    await page.click("text='Share'")
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/\/\?l=javascript&s=.*/)

    await page.reload()
    await page.waitForTimeout(500);
    await page.click("text='Run'")
    await expect(page.locator("data-testid=right-panel >> text=FolioAssert")).toBeVisible();
  })
})

test.describe("should handle platform core related features", () => {
  test("should handle the timeout correctly", async ({ page }) => {
    const CODE = `(async () => {
  await new Promise(resolve => setTimeout(resolve, 70 * 1000))`
    await page.goto('?l=javascript');
    await page.click(".monaco-editor")
    await page.keyboard.press("Meta+KeyA")
    await page.keyboard.type(CODE)
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.type("();")

    await page.click("text='Run'")
    await expect(page.locator("text=Execution timeout!")).toBeVisible({
      timeout: 70 * 1000,
    });
  })
  test("should handle uncaughtException correctly", async ({ page }) => {
    await page.goto('?l=javascript');
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
    await expect(page.locator("text=Error: foobar!")).toBeVisible();
  })
  test("should prevent access to the control microservice from inside the worker", async ({ page }) => {
    await page.goto('?l=javascript');
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