# Monaco + Playwright Firefox 153: tab SIGSEGV on reload

Upstream: https://github.com/microsoft/playwright/issues/42555

Firefox **content-process SIGSEGV** (`signal 11`) when Playwright's bundled Firefox **153** (Juggler `firefox-1538`) reloads a Vite production page that has Monaco Editor running with a language worker.

This is a **1.62 regression**. The same page does not crash on Playwright **1.61.1** (Firefox 151.0) or **1.60.0** (Firefox 150.0.2).

## Repro

```bash
npm ci
npx playwright install firefox
npm test
```

`npm test` production-builds the page and runs the Firefox test. Expect:

```
EVENT page.crash
page.reload: Page crashed
[Parent …, IPC I/O Parent] WARNING: process … exited on signal 11
```

Tighter loop (typically 5–8 crashes out of 8 sessions):

```bash
npm run build
SESSIONS=8 RELOADS=5 node crash-loop.mjs
```

## What matters

1. Vite **production** build of `monaco-editor@0.55.1`
2. `language: "javascript"` → `ts.worker`, plus `getJavaScriptWorker()` / `getSemanticDiagnostics()` started and **not awaited**
3. `page.reload()` **immediately** after `__editorReady` — while the worker is still busy

Waiting until the worker goes idle (several seconds, or `await` diagnostics) makes this flaky. The previous draft's 4s settle was the wrong direction.

Not required: `addExtraLib`, Playwright `.d.ts`, Share URL, multiple tabs.

`import * as monaco from "monaco-editor/esm/vs/editor/editor.api"` with `language: "plaintext"` never started a worker and did **not** crash.

## Version bisect (this machine, 2026-09-03)

| Playwright | Bundled Firefox | Immediate reload loop |
|---|---|---|
| 1.60.0 | 150.0.2 (`firefox-1522`) | 0/8 crash |
| 1.61.1 | 151.0 (`firefox-1532`) | 0/8 crash |
| **1.62.1** | **153.0 (`firefox-1538`)** | **5–8/8 crash** |

Firefox 153 shipped in Playwright **1.62.0**. Chromium was not re-tested in this pass; the original investigation did not crash Chromium/WebKit.

## Environment

```
@playwright/test@1.62.1
monaco-editor@0.55.1
Ubuntu 24.04, Node 22, headless Firefox
```
