import * as Sentry from '@sentry/node'
import amqp from 'amqplib';

import { runUntrustedCode } from './utils';

const QUEUE_NAME = 'rpc_queue';

(async (): Promise<void> => {
  if (process.env.NODE_ENV === "production" && process.env.BACKEND_SENTRY_DSN) {
    Sentry.init({ dsn: process.env.BACKEND_SENTRY_DSN });
  }
  const queueConnection = await amqp.connect(process.env.AMQP_URL as string)
  const channel = await queueConnection.createChannel()

  channel.assertQueue(QUEUE_NAME, {
    durable: false
  });
  channel.prefetch(1);
  console.log(' [x] Awaiting RPC requests');
  await channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg)
      return
    const payload = JSON.parse(msg.content.toString())

    const response = await runUntrustedCode(payload?.code)

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