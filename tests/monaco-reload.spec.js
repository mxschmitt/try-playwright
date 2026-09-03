import { test, expect } from "@playwright/test";

test("Firefox tab stays alive across immediate Monaco reloads", async ({ page }) => {
  page.on("crash", () => {
    console.log("EVENT page.crash");
  });

  await page.goto("/");
  await page.waitForFunction(() => window.__editorReady === true);

  for (let i = 1; i <= 8; i++) {
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.__editorReady === true);
  }

  expect(page.isClosed(), "page should still be open (not crashed)").toBe(false);
});
