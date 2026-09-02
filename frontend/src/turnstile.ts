export type TurnstileApi = {
  reset: (container?: HTMLElement | null) => void
  execute: (container: HTMLElement | null, options?: Record<string, unknown>) => void
}

const DEFAULT_TIMEOUT_MS = 8_000

/**
 * Wait for a Turnstile token without hanging the Run action forever.
 *
 * The previous implementation awaited `turnstile.execute()` with no timeout and
 * no try/catch. If the widget never invoked callback/error-callback (common
 * when the container is `display: none` — Chromium throttles timers in hidden
 * iframes), `/service/control/run` was never sent and e2e tests hit the 120s
 * test timeout while the UI stayed on "loading".
 */
export async function waitForTurnstileToken(params: {
  turnstile?: TurnstileApi
  container: HTMLElement | null
  sitekey: string
  timeoutMs?: number
}): Promise<string> {
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const turnstile = params.turnstile
  if (!turnstile || typeof turnstile.execute !== 'function') {
    console.warn('[try-playwright] turnstile API not available')
    return ''
  }

  return await new Promise<string>((resolve) => {
    let settled = false
    const done = (token: string, reason: string) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      console.info('[try-playwright] turnstile finished', { reason, tokenLength: token.length })
      resolve(token)
    }

    const timer = setTimeout(() => done('', 'timeout'), timeoutMs)

    try {
      turnstile.reset(params.container)
    } catch {
      // Widget may not have been rendered yet.
    }

    try {
      turnstile.execute(params.container, {
        sitekey: params.sitekey,
        callback: (token: string) => done(token ?? '', 'callback'),
        'error-callback': () => done('', 'error-callback'),
        'timeout-callback': () => done('', 'timeout-callback'),
      })
    } catch (error) {
      console.warn('[try-playwright] turnstile.execute threw', error)
      done('', 'throw')
    }
  })
}
