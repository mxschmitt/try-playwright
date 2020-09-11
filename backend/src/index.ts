import express from 'express';
import * as Sentry from '@sentry/node'

import { runUntrustedCode } from './utils';
import { ShareStore } from './store'

(async (): Promise<void> => {
  const app = express()
  const store = new ShareStore()
  await store.init("data/db.sqlite")

  app.use(express.json())
  app.use("/public/", express.static('./public'))

  app.get("/api/v1/health", async (req: express.Request, resp: express.Response) => {
    resp.status(200).send("OK")
  })

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

  app.get("/api/v1/share/get/:id", async (req: express.Request, resp: express.Response) => {
    try {
      const code = await store.get(req.params.id)
      resp.send({ code })
    } catch (err) {
      console.error("Could not get share key", err)
      resp.status(404).send({})
    }
  })

  app.post("/api/v1/share/create", async (req: express.Request, resp: express.Response) => {
    try {
      const key = await store.set(req.body?.code)
      resp.send({ key })
    } catch (err) {
      console.error("Could not create share key", err)
      resp.status(500).send({})
    }
  })

  const port = process.env.PORT || 8080;

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

  signals.forEach(signal => process.on(signal, () => {
    console.info('SIGINT signal received.');
    console.log('Closing http server.');
    server.close(async () => {
      console.log('Http server closed.');
      console.log("Closing database")
      await store.close()
      process.exit(0)
    });
  }));

  const server = app.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
  });
})().catch(console.error)