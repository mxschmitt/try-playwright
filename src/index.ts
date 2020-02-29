import express from 'express'
import playwright from 'playwright-core'
import { runUntrustedCode } from './utils'

(async () => {
  console.log("Checking if all browsers are installed")
  playwright.chromium.downloadBrowserIfNeeded();
  playwright.firefox.downloadBrowserIfNeeded();
  playwright.webkit.downloadBrowserIfNeeded();
  console.log("Installed all browsers successfully")

  const app = express()
  app.use(express.json())

  app.post("/api/v1/run", async (req: express.Request, resp: express.Response) => {
    const requestPayload = req.body
    const response = await runUntrustedCode(requestPayload?.code)
    resp.status(200).send(JSON.stringify(response))
  })

  const port = process.env.PORT || 8080;

  app.listen(port, () => {
    // tslint:disable-next-line:no-console
    console.log(`Server started at http://localhost:${port}`);
  });
})();