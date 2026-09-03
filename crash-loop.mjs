import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const pwRoot = resolve(process.env.PW_ROOT || process.cwd());
const require = createRequire(join(pwRoot, "package.json"));
const { firefox, chromium } = require("@playwright/test");
const launcher = process.env.BROWSER === "chromium" ? chromium : firefox;

const dist = resolve(process.env.DIST || join(process.cwd(), "dist"));
const sessions = Number(process.env.SESSIONS || 8);
const reloads = Number(process.env.RELOADS || 5);
const settleMs = Number(process.env.SETTLE_MS || 0);
const label = process.env.LABEL || "run";

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const body = await readFile(join(dist, file));
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/`;

let crashes = 0;
for (let s = 1; s <= sessions; s++) {
  const browser = await launcher.launch({ headless: true });
  if (s === 1) console.log(`[${label}] ${browser.version()} ${url}`);
  const page = await browser.newPage();
  let crashed = false;
  page.on("crash", () => {
    crashed = true;
  });
  try {
    await page.goto(url + (process.env.PAGE_QUERY || ""), { waitUntil: "load" });
    await page.waitForFunction(() => window.__editorReady === true, null, { timeout: 30_000 });
    await page.evaluate(() => {
      window.monacoEditorModel.setValue(`console.log("FolioAssert")\n`);
    });
    for (let i = 1; i <= reloads; i++) {
      if (settleMs) await page.waitForTimeout(settleMs);
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => window.__editorReady === true, null, { timeout: 30_000 });
    }
    console.log(`[${label}] session ${s} survived`);
  } catch (error) {
    crashes++;
    console.log(
      `[${label}] session ${s} FAILED crashed=${crashed} ${error.message.split("\n")[0]}`,
    );
  } finally {
    await browser.close().catch(() => {});
  }
}
console.log(`[${label}] DONE crashes=${crashes}/${sessions}`);
server.close();
process.exitCode = crashes ? 1 : 0;
