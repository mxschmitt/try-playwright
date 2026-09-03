# Monaco + Firefox: tab SIGSEGV on reload (Playwright 1.62.1)

Upstream: https://github.com/microsoft/playwright/issues/42555

Minimal reproduction of a Firefox **content-process SIGSEGV** when Playwright's bundled Firefox 153 (Juggler) reloads a page that has Monaco Editor's ~7MB TypeScript language worker running.

## Repro

```bash
npm ci
npx playwright install firefox
npm test
```

`npm test` production-builds the page (`vite build`) and runs the Firefox test. The failure is **flaky**. If the first run passes, re-run a few times, or:

```bash
DEBUG=pw:browser npx playwright test --repeat-each=5 --workers=2
```

Passing is not success — look for:

```
page.reload: Page crashed
[Parent …, IPC I/O Parent] WARNING: process … exited on signal 11
```

Chromium / WebKit and stock Mozilla Firefox (WebDriver BiDi, no Juggler) have not reproduced this.

## What the page does

1. Vite production bundle of `monaco-editor@0.55.1`
2. `ts.worker?worker` (~6.9MB) for `language: "javascript"`
3. `javascriptDefaults.addExtraLib` with a ~2.3MB `.d.ts` (Playwright's public types)
4. Wait 4s so the worker is live, then `page.reload()`, repeat

## Environment (where this was observed)

- `@playwright/test@1.62.1` (npm `latest` as of 2026-09-03)
- Bundled Firefox `153.0` (`firefox-1538`)
- Ubuntu 24.04, Node 22, headless
