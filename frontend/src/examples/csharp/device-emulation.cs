using System;
using System.Threading.Tasks;
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync();
var page = await browser.NewPageAsync();
var pixel2 = playwright.Devices["Pixel 2"];
await using var context = await browser.NewContextAsync(pixel2);
await page.GotoAsync("https://playwright.dev/dotnet");
await page.ScreenshotAsync(new PageScreenshotOptions { Path = "Pixel-2.png" });
