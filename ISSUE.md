# Issue draft for microsoft/playwright

**Title:** [Bug]: Firefox 153 (Playwright 1.62) content process SIGSEGV when reloading Monaco Editor with the TypeScript worker

## Version

1.62.1 (npm `latest` on 2026-09-03). Bundled Firefox 153.0 (`firefox-1538`).

## Steps to reproduce

1. Clone/unzip the repro: `monaco-firefox-reload-crash`
2. `npm ci && npx playwright install firefox && npm test`
3. If it passes, re-run: `DEBUG=pw:browser npx playwright test --repeat-each=5 --workers=2`

## Expected behavior

`page.reload()` after Monaco's TS language worker has started should keep the tab alive, as on Chromium/WebKit.

## Actual behavior

Flaky Firefox tab crash:

```
page.reload: Page crashed
[Parent …, IPC I/O Parent] WARNING: process … exited on signal 11
```

Sometimes the SIGSEGV is only logged while the browser is closing and the test still passes.

Did **not** reproduce with stock Mozilla Firefox 153/155 over raw WebDriver BiDi (no Juggler).

## Additional context

Vite production build of `monaco-editor@0.55.1`, `ts.worker?worker` (~6.9MB), `language: "javascript"`, plus `javascriptDefaults.addExtraLib` (~2.3MB of Playwright `.d.ts`). Waiting ~4s after the editor is ready, then reload, is important; an immediate reload often survives.

A worker-only `new Worker(ts.worker, { type: "module" })` page did not crash.

## Environment

```
System:
  OS: Linux 6.12 Ubuntu 24.04.4 LTS
  CPU: (4) x64
  Container: Yes
Binaries:
  Node: 22.14.0
  npm: 10.9.7
npmPackages:
  @playwright/test: 1.62.1
```
