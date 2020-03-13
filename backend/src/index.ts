import express from 'express';
import { runUntrustedCode } from './utils';
import * as Sentry from '@sentry/node'

(async (): Promise<void> => {
  const app = express()

  app.use(express.json())
  app.use("/public/", express.static('./public'))

  if (process.env.NODE_ENV === "production" && process.env.BACKEND_SENTRY_DSN) {
    Sentry.init({ dsn: process.env.BACKEND_SENTRY_DSN });
    app.use(Sentry.Handlers.requestHandler());
  }

  app.post("/api/v1/run", async (req: express.Request, resp: express.Response) => {
    const requestPayload = req.body
    try {
      const response = await runUntrustedCode(requestPayload?.code)
      resp.status(200).send(
        JSON.stringify(response)
      )
    } catch (error) {
      console.log("Errored request", error)
      resp.status(500).send({ error: error.toString() })
    }
  })

  const port = process.env.PORT || 8080;

  const server = app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
  });

  process.on('SIGINT', async () => {
    console.info('SIGINT signal received.');
    console.log('Closing http server.');
    server.close(() => {
      console.log('Http server closed.');
      process.exit(0)
    });
  });
})();