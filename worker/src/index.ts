import * as fs from 'fs'
import * as os from 'os'
import * as Sentry from '@sentry/node'
import amqp from 'amqplib';

import { runUntrustedCode } from './utils';

const QUEUE_NAME = `rpc_queue_${os.hostname()}`;

(async (): Promise<void> => {
  if (process.env.NODE_ENV === "production" && process.env.WORKER_NODE_SENTRY_DSN) {
    Sentry.init({ dsn: process.env.WORKER_NODE_SENTRY_DSN });
  }
  const queueConnection = await amqp.connect(process.env.AMQP_URL as string)
  const channel = await queueConnection.createChannel()

  await channel.assertQueue(QUEUE_NAME, {
    autoDelete: true
  });
  await channel.prefetch(1);
  await fs.promises.writeFile("/tmp/worker-ready", '')
  console.log(`Worker ${os.hostname()} is consuming`)

  await channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg)
      return
    const payload = JSON.parse(msg.content.toString())
    Sentry.addBreadcrumb({
      category: "execution-code",
      message: payload?.code,
      level: Sentry.Severity.Info,
    });
    let response: ExecutionResponse
    try {
      response = await runUntrustedCode(payload?.code)
    } catch (error) {
      response = { success: false, error: String(error) }
      console.log(`Errored request: ${error}`)
      Sentry.captureException(error)
    }
    channel.sendToQueue(msg.properties.replyTo,
      Buffer.from(JSON.stringify(response)), {
      correlationId: msg.properties.correlationId
    });

    channel.ack(msg);
  });
})().catch(err => {
  console.error(err)
  process.exit(1)
})