# [Bug]: Firefox 153 content process SIGSEGV on `page.reload()` with Monaco Editor

## Version

Playwright **1.62.1** (also the 1.62.0 browser roll). Bundled Firefox **153.0** (`firefox-1538`).

Does **not** reproduce on Playwright **1.61.1** (Firefox 151.0) or **1.60.0** (Firefox 150.0.2).

## Steps to reproduce

```bash
git clone --branch cursor/refine-monaco-firefox-repro-a9e6 --single-branch https://github.com/mxschmitt/try-playwright.git monaco-firefox-reload-crash
cd monaco-firefox-reload-crash
npm ci
npx playwright install firefox
npm test
```

Or the tighter loop:

```bash
npm run build
SESSIONS=8 RELOADS=5 node crash-loop.mjs
```

The page is a Vite production build of `monaco-editor@0.55.1` with `language: "javascript"` and Monaco's `ts.worker`. After `__editorReady`, the test calls `page.reload()` **immediately** (no settle timeout).

## Expected behavior

The tab stays alive, as on Playwright 1.61 / Firefox 151 and on Chromium/WebKit.

## Actual behavior

Firefox content process dies with SIGSEGV:

```
EVENT page.crash
page.reload: Page crashed
[Parent …, IPC I/O Parent] WARNING: process … exited on signal 11
```

With the immediate-reload loop this is typically **5–8 failures out of 8 sessions** on Linux x64 headless.

## What is / is not required

Required:

- Playwright-bundled Firefox 153 (Juggler)
- Monaco `language: "javascript"` so `ts.worker` starts
- Kick `getJavaScriptWorker()` / `getSemanticDiagnostics()` and **do not wait** for it
- `page.reload()` immediately (while that worker is still starting)

Not required:

- `addExtraLib` / a 2.3MB Playwright `.d.ts`
- a 4s settle delay (that delay made the previous draft flaky)
- Share URL, multiple tabs, or the full Try Playwright app

A plaintext Monaco instance that never called `MonacoEnvironment.getWorker()` did not crash.

## Environment

```
OS: Linux 6.12 Ubuntu 24.04 (container)
Node: 22.14.0
@playwright/test: 1.62.1
monaco-editor: 0.55.1
```
