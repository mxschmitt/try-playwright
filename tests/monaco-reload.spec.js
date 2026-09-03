import { test, expect } from "@playwright/test";

test("firefox tab does not SIGSEGV when reloading Monaco + TS worker", async ({ page }) => {
  page.on("crash", () => {
    console.log("EVENT page.crash");
  });

  await page.goto("/");
  await page.waitForFunction(() => window.__editorReady === true);

  for (let i = 1; i <= 12; i++) {
    await page.waitForTimeout(4000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__editorReady === true);
  }

  expect(page.isClosed(), "page should still be open (not crashed)").toBe(false);
});
