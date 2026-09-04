import { expect, test as base, APIResponse } from '@playwright/test';
import { attachAggregatorLogs } from './logAggregator';

type TestFixtures = {
  executeCode: (code: string, language: string) => Promise<APIResponse>
};

const test = base.extend<TestFixtures>({
  executeCode: async ({ request }, use) => {
    await use(async (code: string, language: string) => {
      const testId = test.info().testId;
      const resp = await request.post('/service/control/run', {
        headers: {
          'X-Test-ID': testId,
        },
        data: {
          code,
          language,
        },
        timeout: 30 * 1000,
      });
      await attachAggregatorLogs(testId);
      return resp;
    });
  },
});

function expectValidVersion(payload: any) {
  expect(payload.version).toMatch(/^\d+.\d+.\d+$/)
}

test.describe("JavaScript", () => {
  test("can execute basic code", async ({ executeCode }) => {
    const code = `console.log(1 + 1)`
    const resp = await executeCode(code, "javascript")
    await expect(resp).toBeOK()
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
  test("can evaluate in a Page", async ({ executeCode }) => {
    const code = `
    // @ts-check
    const playwright = require('playwright');

    (async () => {
      const browser = await playwright.webkit.launch();
      const page = await browser.newPage();
      console.log(await page.evaluate(1 + 1))
      await browser.close();
    })();`
    const resp = await executeCode(code, "javascript")
    await expect(resp).toBeOK()
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

test.describe("Python", () => {
  test("can execute basic code", async ({ executeCode }) => {
    const resp = await executeCode("print(1+1)", "python")
    await expect(resp).toBeOK()
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
  test("can evaluate in a Page", async ({ executeCode }) => {
    const code = `
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.webkit.launch()
    page = browser.new_page()
    print(page.evaluate('1 + 1'))
    browser.close()
    `
    const resp = await executeCode(code, "python")
    await expect(resp).toBeOK()
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

test.describe("Java", () => {
  test("can execute basic code", async ({ executeCode }) => {
    const code = `
package org.example;

public class Example {
  public static void main(String[] args) {
    System.out.println(1 + 1);
  }
}
    `
    const resp = await executeCode(code, "java")
    await expect(resp).toBeOK()
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
  test("can evaluate in a Page", async ({ executeCode }) => {
    const code = `
    package org.example;

    import com.microsoft.playwright.*;

    public class EvaluateInBrowserContext {
      public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
          Browser browser = playwright.webkit().launch();
          BrowserContext context = browser.newContext();
          Page page = context.newPage();
          System.out.println(page.evaluate("() => 1 + 1"));
        }
      }
    }
        `
    const resp = await executeCode(code, "java")
    await expect(resp).toBeOK()
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

test.describe(".NET", () => {
  test("can execute basic code", async ({ executeCode }) => {
    const code = `
using System;

class Program
{
    static void Main(string[] args)
    {
        Console.WriteLine(1 + 1);
    }
}
`
    const resp = await executeCode(code, "csharp")
    await expect(resp).toBeOK()
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })

  test("can evaluate in a Page", async ({ executeCode }) => {
    const code = `
    using Microsoft.Playwright;
    using System.Threading.Tasks;
    using System;

    class Program
    {
        public static async Task Main()
        {
            using var playwright = await Playwright.CreateAsync();
            await using var browser = await playwright.Chromium.LaunchAsync();
            var page = await browser.NewPageAsync();
            Console.WriteLine(await page.EvaluateAsync<int>("1 + 1"));
          }
    }`
    const resp = await executeCode(code, "csharp")
    await expect(resp).toBeOK()
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

test.describe("Live logs", () => {
  test("streams stdout over log-watch before done", async ({ request }) => {
    const testId = test.info().testId
    const code = [
      "console.log('early');",
      "const end = Date.now() + 3000;",
      "while (Date.now() < end) {}",
      "console.log('late');",
    ].join('\n')
    const started = Date.now()
    const startResp = await request.post('/service/control/run', {
      headers: {
        'Accept': 'text/event-stream',
        'X-Test-ID': testId,
      },
      data: {
        code,
        language: 'javascript',
      },
      timeout: 30 * 1000,
    })
    expect(startResp.status()).toBe(202)
    const startedBody = await startResp.json()
    const id = startedBody.id
    expect(id).toBeTruthy()
    expect(Date.now() - started).toBeLessThan(2000)

    const watch = await request.get('/service/control/run/' + id + '/log-watch', {
      timeout: 30 * 1000,
    })
    expect(watch.ok()).toBeTruthy()
    const text = await watch.text()
    expect(text).toContain(': connected')
    expect(text).toContain('event: log')
    expect(text).toContain('early')
    const doneChunk = text.split('\n\n').find(chunk => chunk.includes('event: done'))
    expect(doneChunk).toBeTruthy()
    const dataLine = doneChunk.split('\n').find(line => line.startsWith('data: '))
    const donePayload = JSON.parse(dataLine.slice(6))
    expect(donePayload).toMatchObject({
      success: true,
      error: '',
      files: [],
    })
    expect(donePayload.output).toContain('early')
    expect(donePayload.output).toContain('late')
    expectValidVersion(donePayload)
    await attachAggregatorLogs(testId)
  })
})
