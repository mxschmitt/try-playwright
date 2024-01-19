using System;
using System.Threading.Tasks;
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync();
var page = await browser.NewPageAsync();
await page.GotoAsync("https://github.com/microsoft/playwright");
await page.PdfAsync(new() { Path = "page.pdf" });
