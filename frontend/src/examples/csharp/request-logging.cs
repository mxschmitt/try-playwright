using System;
using System.Threading.Tasks;
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync();
var page = await browser.NewPageAsync();
page.Request += (_, request) => Console.WriteLine(">> " + request.Method + " " + request.Url);
page.Response += (_, response) => Console.WriteLine("<<" + response.Status + " " + response.Url);
await page.GotoAsync("https://example.com");
