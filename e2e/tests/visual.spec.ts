import { expect, test as base, Page } from '@playwright/test';

async function attachAggregatorLogs(testId?: string) {
  const testInfo = test.info();
  const effectiveTestId = testId || testInfo.testId;
  const base = (process.env.LOG_AGGREGATOR_URL || '').replace(/\/$/, '');
  if (!base) return;
  try {
    const res = await fetch(`${base}/logs/${encodeURIComponent(effectiveTestId)}`);
    if (!res.ok) return;
    const body = await res.text();
    if (body.trim().length === 0) return;
    await testInfo.attach(`logs-${effectiveTestId}`, {
      body,
      contentType: 'text/plain',
    });
  } catch {
    // best-effort; ignore
  }
}

const JS_EXAMPLES = [
  { id: 'page-screenshot', marker: 'example-${browserType.name()}' },
  { id: 'mobile-and-geolocation', marker: 'colosseum-iphone.png' },
  { id: 'generate-pdf', marker: 'document.pdf' },
  { id: 'record-video', marker: 'Running and debugging tests' },
  { id: 'evaluate-javascript', marker: 'deviceScaleFactor' },
  { id: 'intercept-requests', marker: 'http://todomvc.com' },
  { id: 'intercept-modify-requests', marker: 'placehold.co' },
  { id: 'todo-mvc', marker: 'Bake a cake' },
  { id: 'crawl-y-combinator', marker: 'Y-Combinator.png' },
] as const

class TryPlaywrightPage {
  constructor(private readonly page: Page) { }
  async executeExample(nth: number): Promise<void> {
    const example = JS_EXAMPLES[nth - 1]
    await this.page.goto('/?l=javascript');
    await this.page.locator(`.rs-panel-group > .rs-panel:nth-child(${nth})`).getByRole('link').click();
    await expect(this.page).toHaveURL(new RegExp(`[?&]e=${example.id}\\b`));
    await this.page.waitForFunction((marker) => {
      return Boolean(window['monacoEditorModel']?.getValue?.()?.includes(marker))
    }, example.marker);
    const responsePromise = this.page.waitForResponse((resp) =>
      resp.url().includes('/service/control/run') && resp.request().method() === 'POST'
    );
    await this.page.getByRole('button', { name: 'Run' }).click();
    const resp = await responsePromise;
    try {
      const payload = await resp.json();
      await attachAggregatorLogs(payload?.testId);
    } catch (_) {
      // ignore: best-effort log attachment
    }
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
  page: async ({ page }, use) => {
    // CI should not depend on Cloudflare Turnstile completing. The backend
    // already skips verification when TURNSTILE_SECRET_KEY is unset.
    await page.route('https://challenges.cloudflare.com/**', (route) => route.abort());
    await page.addInitScript(() => {
      (window as any).turnstile = {
        reset() {},
        execute(_el: unknown, opts?: { callback?: (token: string) => void }) {
          opts?.callback?.('e2e-turnstile-token');
        },
      };
    });
    await use(page);
  },
  tpPage: async ({ page }, use) => {
    await use(new TryPlaywrightPage(page));
  }
});

test.describe('Examples', () => {
  test("1: should be able to make screenshots in all browsers", async ({ tpPage }) => {
    await tpPage.executeExample(1)
    await expect(tpPage.images).toHaveCount(2)
    await expect(tpPage.videos).toHaveCount(0)
    await expect(tpPage.fileNames).toContainText(["example-chromium.png"])
    await expect(tpPage.fileNames).toContainText(["example-webkit.png"])
    await expect(tpPage.fileNames).toHaveCount(2)
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
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page).toHaveURL('/?l=javascript&e=page-screenshot')
  })
  test("should generate share URL", async ({ page, baseURL }) => {
    await page.goto('?l=javascript');
    await page.waitForFunction(() => window['monacoEditorModel'])
    await page.evaluate(() => {
      // @ts-ignore
      window.monacoEditorModel.setValue(`console.log("FolioAssert")`)
    })

    await page.getByRole('button', { name: 'Share' }).click()
    await expect(page).toHaveURL(/\/\?l=javascript&s=.*/)

    await page.reload()
    await page.getByRole('button', { name: 'Run' }).click()

    await expect(page.getByTestId('right-panel').getByText('FolioAssert')).toBeVisible();
  })
})

test.describe("should handle platform core related features", () => {
  test("should handle the timeout correctly", async ({ page }) => {
    await page.goto('?l=javascript');
    await page.waitForFunction(() => window['monacoEditorModel'])
    await page.evaluate(() => {
      // @ts-ignore
      window.monacoEditorModel.setValue(`// @ts-check
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 70 * 1000))
      })();
      `)
    })

    await page.getByRole('button', { name: 'Run'}).click();
    await expect(page.getByText("Execution timeout!")).toBeVisible({
      timeout: 90 * 1000,
    });
  })
  test("should handle uncaughtException correctly", async ({ page }) => {
    await page.goto('?l=javascript');
    await page.waitForFunction(() => window['monacoEditorModel'])
    await page.evaluate(() => {
      // @ts-ignore
      window.monacoEditorModel.setValue(`// @ts-check
const playwright = require("playwright");

(async () => {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.route("**/*", () => {
    throw new Error("foobar!")
  })
  await page.goto("https://example.com")
  await browser.close();
})();`)
    })
    await page.getByRole('button', { name: 'Run'}).click();
    await expect(page.getByText("Error: foobar!")).toBeVisible();
  })
  test("should prevent access to the control microservice from inside the worker", async ({ page }) => {
    await page.goto('?l=javascript');
    await page.waitForFunction(() => window['monacoEditorModel'])
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
    await Promise.all([
      page.getByText("Status: 403").waitFor(),
      page.getByRole('button', { name: 'Run'}).click(),
    ])
  })
})