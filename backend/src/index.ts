import express from 'express';
import { runUntrustedCode } from './utils';

(async () => {
  const app = express()
  app.use(express.json())
  app.use(express.static('./frontend'));

  app.use("/public/", express.static('./public'))

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