using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless: False
        });
        var pixel2 = playwright.Devices["Pixel 2"];
        await using var context = await browser.NewContextAsync(pixel2);
        await page.GotoAsync("https://playwright.dev/dotnet");
        await page.ScreenshotAsync("Pixel-2.png");
    }
}