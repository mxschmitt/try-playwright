import express from 'express';
import expressStaticGzip from "express-static-gzip";
import { runUntrustedCode } from './utils';

const compressionOptions: expressStaticGzip.ExpressStaticGzipOptions = {
  enableBrotli: true,
};

(async () => {
  const app = express()
  app.use(express.json())
  app.use(expressStaticGzip('./frontend', compressionOptions));

  app.use("/public/", expressStaticGzip('./public', compressionOptions))

  app.post("/api/v1/run", async (req: express.Request, resp: express.Response) => {
    const requestPayload = req.body
    try {
      const response = await runUntrustedCode(requestPayload?.code)
      resp.status(200).send(
        JSON.stringify(response)
      )
    } catch (error) {
      resp.status(500).send(error.toString())
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