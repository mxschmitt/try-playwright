import * as Sentry from '@sentry/node'
import amqp from 'amqplib';

import { runUntrustedCode } from './utils';

(async (): Promise<void> => {
  const { WORKER_NODE_SENTRY_DSN, WORKER_ID, NODE_ENV, AMQP_URL } = process.env
  const QUEUE_NAME = `rpc_queue_${WORKER_ID}`;

  if (NODE_ENV === "production" && WORKER_NODE_SENTRY_DSN) {
    Sentry.init({ dsn: WORKER_NODE_SENTRY_DSN });
  }
  const queueConnection = await amqp.connect(AMQP_URL!)
  const channel = await queueConnection.createChannel()

  await channel.prefetch(1);

  console.log(`Worker ${WORKER_ID} is consuming`)

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