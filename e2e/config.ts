import path from 'path'

import * as folio from 'folio';
import { ChromiumEnv, FirefoxEnv, WebKitEnv, test, setConfig, PlaywrightOptions, Config } from "@playwright/test";

const config: Config = {
  testDir: path.join(__dirname, "tests"),
  timeout: 120 * 1000,
}

if (process.env.CI) {
  config.forbidOnly = true
  config.retries = 2

  folio.setReporters([
    new folio.reporters.list(),
  ]);
}

setConfig(config);

const options: PlaywrightOptions = {
  ignoreHTTPSErrors: true,
  viewport: {
    width: 1920,
    height: 1080
  }
};

// Run tests in three browsers.
test.runWith(new ChromiumEnv(options), { tag: 'chromium' });
test.runWith(new FirefoxEnv(options), { tag: 'firefox' });
test.runWith(new WebKitEnv(options), { tag: 'webkit' });