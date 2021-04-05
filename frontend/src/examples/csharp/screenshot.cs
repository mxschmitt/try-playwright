using System;
using System.IO;
using System.Threading.Tasks;

using PlaywrightSharp;

namespace ScreenshotDemo
{
    class Program
    {
        static async Task Main(string[] args)
        {
            using var playwright = await Playwright.CreateAsync();
            await using var browser = await playwright.Webkit.LaunchAsync();

            Console.WriteLine("Navigating microsoft");
            var page = await browser.NewPageAsync();
            await page.GoToAsync("https://github.com/microsoft/playwright");

            Console.WriteLine("Taking Screenshot");
            await File.WriteAllBytesAsync(Path.Combine(Directory.GetCurrentDirectory(), "microsoft.png"), await page.ScreenshotAsync());

            Console.WriteLine("Export completed");
        }
    }
}