import { test, type Page } from '@playwright/test'

export async function installE2ETestId(page: Page): Promise<void> {
  await page.addInitScript((id: string) => {
    ;(window as Window & { __TRY_PLAYWRIGHT_TEST_ID__?: string }).__TRY_PLAYWRIGHT_TEST_ID__ = id
  }, test.info().testId)
}

export async function attachAggregatorLogs(testId?: string): Promise<void> {
  const testInfo = test.info()
  const effectiveTestId = testId || testInfo.testId
  const base = (process.env.LOG_AGGREGATOR_URL || '').replace(/\/$/, '')
  if (!base) return
  try {
    const res = await fetch(`${base}/logs/${encodeURIComponent(effectiveTestId)}`)
    if (!res.ok) return
    const body = await res.text()
    if (body.trim().length === 0) return
    await testInfo.attach(`logs-${effectiveTestId}`, {
      body,
      contentType: 'text/plain',
    })
  } catch {
    // best-effort; ignore
  }
}
