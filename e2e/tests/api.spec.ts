import { expect, it, describe } from '@playwright/test';
import fetch, { Response } from 'node-fetch'
import { ROOT_URL } from './utils';

function executeCode(code: string, language: string): Promise<Response> {
  return fetch(`${ROOT_URL}/service/control/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code,
      language
    })
  })
}

function expectValidVersion(payload: any) {
  expect(payload.version).toMatch(/^\d+.\d+.\d+$/)
}

describe("JavaScript", () => {
  it("can execute basic code", async () => {
    const code = `console.log(1 + 1)`
    const resp = await executeCode(code, "javascript")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
  it("can evaluate in a Page", async () => {
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
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

describe("Python", () => {
  it("can execute basic code", async () => {
    const resp = await executeCode("print(1+1)", "python")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
  it("can evaluate in a Page", async () => {
    const code = `
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.webkit.launch()
    page = browser.new_page()
    print(page.evaluate('1 + 1'))
    browser.close()
    `
    const resp = await executeCode(code, "python")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

describe("Java", () => {
  it("can execute basic code", async () => {
    const code = `
package org.example;

public class Example {
  public static void main(String[] args) {
    System.out.println(1 + 1);
  }
}
    `
    const resp = await executeCode(code, "java")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
  it("can evaluate in a Page", async () => {
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
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})

describe("C#", () => {
  it("can execute basic code", async () => {
    const code = `
    using System;
    using System.Threading.Tasks;

    using PlaywrightSharp;

    namespace TestCase
    {
        class Program
        {
            static async Task Main(string[] args)
            {
                using var playwright = await Playwright.CreateAsync();
                await using var browser = await playwright.Chromium.LaunchAsync();

                var page = await browser.NewPageAsync();

                Console.WriteLine(await page.EvaluateAsync<int>("1 + 1"));
            }
        }
    }`
    const resp = await executeCode(code, "csharp")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
  it("can evaluate in a Page", async () => {
    const code = `
using System;

namespace e2e
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine(1 + 1);
        }
    }
}`
    const resp = await executeCode(code, "csharp")
    expect(resp.ok).toBe(true)
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('error', '')
    expectValidVersion(body)
    expect(body).toHaveProperty('files', [])
    expect(body).toHaveProperty('output', '2')
  })
})