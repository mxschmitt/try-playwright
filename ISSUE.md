See https://github.com/microsoft/playwright/issues/42555

Repro clone:

```bash
git clone --branch cursor/monaco-firefox-reload-crash-4443 --single-branch https://github.com/mxschmitt/try-playwright.git monaco-firefox-reload-crash
cd monaco-firefox-reload-crash
npm ci
npx playwright install firefox
npm test
```
