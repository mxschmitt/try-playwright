import { expect, test as base, type APIResponse } from '@playwright/test';

type TestFixtures = {
  executeCode: (code: string, language: string) => Promise<APIResponse>
};

const test = base.extend<TestFixtures>({
  executeCode: async ({ request }, use) => {
    await use(async (code: string, language: string) => {
      return await request.post('/service/control/run', {
        data: {
          code,
          language
        },
        timeout: 30 * 1000,
      })
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
    await expect(resp).toBeOK();
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
    await expect(resp).toBeOK();
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
    await expect(resp).toBeOK();
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
    await expect(resp).toBeOK();
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
    await expect(resp).toBeOK();
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
    await expect(resp).toBeOK();
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
    await expect(resp).toBeOK();
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
    await expect(resp).toBeOK();
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})