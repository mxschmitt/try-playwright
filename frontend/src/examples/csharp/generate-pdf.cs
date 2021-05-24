using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync();
        var page = await browser.NewPageAsync();
        await page.GotoAsync("https://github.com/microsoft/playwright");
        await page.PdfAsync(new PagePdfOptions { Path = "page.pdf" });
    }
}
