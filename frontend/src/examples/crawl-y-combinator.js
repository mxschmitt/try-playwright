const playwright = require("playwright");

(async () => {
  const browser = await playwright.webkit.launch();
  const page = await browser.newPage();
  await page.goto("https://news.ycombinator.com");

  // $$eval is doing basically the same as 'document.querySelectorAll' which will
  // pass the returned data as a callback to the passed function.
  const topEntries = await page.$$eval(".athing",
    elements => [...elements].map(el => {
      const linkElement = el.children[2].children[0]
      return {
        title: linkElement.innerHTML,
      }
    })
  )
  // Write the crawled data entries to the console
  topEntries.forEach(({ title }, index) => console.log(`${index + 1}. ${title}`))

  await page.screenshot({ path: "Y-Combinator.png" });
  await browser.close();
})();