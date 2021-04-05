using System;
using System.IO;
using System.Threading.Tasks;

using PlaywrightSharp;

namespace PdfDemo
{
    class Program
    {
        static async Task Main(string[] args)
        {
            using var playwright = await Playwright.CreateAsync();
            await using var browser = await playwright.Chromium.LaunchAsync();

            var page = await browser.NewPageAsync();
            Console.WriteLine("Navigating google");
            await page.GoToAsync("https://github.com/microsoft/playwright");

            Console.WriteLine("Generating PDF");
            await page.GetPdfAsync(Path.Combine(Directory.GetCurrentDirectory(), "playwright.pdf"));

            Console.WriteLine("Export completed");
        }
    }
}