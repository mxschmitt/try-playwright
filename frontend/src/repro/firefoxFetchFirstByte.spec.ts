import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/experimental-ct-react'

/**
 * Firefox does not resolve fetch() until it has seen a response body byte,
 * even when Content-Type and status are already flushed. Chromium and WebKit
 * resolve on headers alone.
 *
 * Upstream: https://bugzilla.mozilla.org/show_bug.cgi?id=1544313
 * (nsUnknownDecoder; dup https://bugzilla.mozilla.org/show_bug.cgi?id=1759996)
 *
 * No Caddy — Playwright talks to this Node server over HTTP/1.1.
 */

const DELAY_MS = 1500

function startServer(): Promise<{ server: http.Server; origin: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      if (url.pathname === '/') {
        res.setHeader('content-type', 'text/html; charset=utf-8')
        res.end('<!doctype html><title>fetch-first-byte</title>')
        return
      }
      if (url.pathname !== '/run') {
        res.writeHead(404)
        res.end()
        return
      }
      const mode = url.searchParams.get('mode')
      const finish = () => {
        res.end(JSON.stringify({ ok: true }))
      }
      res.setHeader('content-type', 'application/json')
      res.writeHead(200)
      res.flushHeaders()
      if (mode === 'dummy') {
        res.write('\n')
      }
      setTimeout(finish, DELAY_MS)
    })
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ server, origin: `http://127.0.0.1:${port}` })
    })
  })
}

let origin = ''
let server: http.Server

test.beforeAll(async () => {
  const started = await startServer()
  server = started.server
  origin = started.origin
})

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

async function timeFetch(page: Page, mode: string) {
  await page.goto(origin + '/')
  return await page.evaluate(async ({ url }) => {
    const started = performance.now()
    const resp = await fetch(url, { method: 'POST', cache: 'no-store' })
    const headerMs = Math.round(performance.now() - started)
    await resp.text()
    return { headerMs, status: resp.status }
  }, { url: `${origin}/run?mode=${mode}` })
}

test('headers-only: Firefox waits for the JSON body; Chromium/WebKit do not', async ({ page, browserName }) => {
  test.setTimeout(20_000)
  const { headerMs, status } = await timeFetch(page, 'headers-ct')
  expect(status).toBe(200)
  if (browserName === 'firefox') {
    expect(headerMs).toBeGreaterThan(DELAY_MS - 200)
  } else {
    expect(headerMs).toBeLessThan(400)
  }
})

test('a dummy newline lets Firefox resolve fetch() immediately', async ({ page }) => {
  test.setTimeout(20_000)
  const { headerMs, status } = await timeFetch(page, 'dummy')
  expect(status).toBe(200)
  expect(headerMs).toBeLessThan(400)
})
