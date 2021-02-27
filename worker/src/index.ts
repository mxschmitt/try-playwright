import * as Sentry from '@sentry/node'
import fetch from 'node-fetch'

import { runUntrustedCode } from './utils';

(async (): Promise<void> => {
  const { WORKER_NODE_SENTRY_DSN, JOB_ID } = process.env
  if (process.env.NODE_ENV === "production" && WORKER_NODE_SENTRY_DSN) {
    Sentry.init({ dsn: WORKER_NODE_SENTRY_DSN });
  }
  if (!JOB_ID) {
    throw new Error("No JobId defined")
  }
  const jobUrl = `http://control:8080/service/control/worker/payload/${JOB_ID}`

  let resp = await fetch(jobUrl)
  if (!resp.ok) {
    throw new Error(`Could not fetch job details: ${await resp.text()}`)
  }
  const payload = await resp.json()

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

  resp = await fetch(jobUrl, {
    method: "POST",
    body: JSON.stringify(response)
  })
  if (!resp.ok) {
    throw new Error(`Could not save job results: ${await resp.text()}`)
  }

})().catch(err => {
  console.error(err)
  process.exit(1)
})