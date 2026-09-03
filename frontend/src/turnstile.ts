export type TurnstileRenderOptions = {
  sitekey: string
  execution?: 'render' | 'execute'
  appearance?: 'always' | 'execute' | 'interaction-only'
  callback?: (token: string) => void
  'error-callback'?: (err?: unknown) => void
  'timeout-callback'?: () => void
  'expired-callback'?: () => void
}

export type TurnstileApi = {
  ready?: (callback: () => void) => void
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string
  execute: (widgetIdOrContainer: HTMLElement | string) => void
  reset: (widgetIdOrContainer?: HTMLElement | string) => void
  remove?: (widgetIdOrContainer: HTMLElement | string) => void
}

export type WidgetIdRef = { current: string | null }

export type WaitForTurnstileTokenOptions = {
  turnstile?: TurnstileApi | null
  container: HTMLElement | null
  sitekey: string
  widgetIdRef?: WidgetIdRef
  timeoutMs?: number
  hostname?: string
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

export function shouldSkipTurnstile(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname)
}

function whenReady(turnstile: TurnstileApi): Promise<void> {
  return new Promise((resolve) => {
    if (typeof turnstile.ready === 'function') {
      turnstile.ready(() => resolve())
      return
    }
    resolve()
  })
}

const pendingByWidget = new WeakMap<WidgetIdRef, (token: string, reason: string, extra?: Record<string, unknown>) => void>()
const inFlightByWidget = new WeakMap<WidgetIdRef, Promise<string>>()

function ensureWidget(options: {
  turnstile: TurnstileApi
  container: HTMLElement
  sitekey: string
  widgetIdRef: WidgetIdRef
  onToken: (token: string, reason: string, extra?: Record<string, unknown>) => void
}): string {
  pendingByWidget.set(options.widgetIdRef, options.onToken)
  if (options.widgetIdRef.current) {
    return options.widgetIdRef.current
  }
  const deliver = (token: string, reason: string, extra?: Record<string, unknown>) => {
    pendingByWidget.get(options.widgetIdRef)?.(token, reason, extra)
  }
  const widgetId = options.turnstile.render(options.container, {
    sitekey: options.sitekey,
    execution: 'execute',
    appearance: 'interaction-only',
    callback: (token: string) => {
      deliver(token || '', 'callback')
    },
    'error-callback': (err?: unknown) => {
      deliver('', 'error-callback', { err: String(err ?? '') })
    },
    'timeout-callback': () => {
      deliver('', 'timeout-callback')
    },
    'expired-callback': () => {
      deliver('', 'expired-callback')
    },
  })
  options.widgetIdRef.current = widgetId
  return widgetId
}

export function removeTurnstileWidget(turnstile: TurnstileApi | null | undefined, widgetIdRef: WidgetIdRef): void {
  const widgetId = widgetIdRef.current
  if (!widgetId || typeof turnstile?.remove !== 'function') {
    widgetIdRef.current = null
    return
  }
  try {
    turnstile.remove(widgetId)
  } catch {
    // Widget may already be gone.
  }
  widgetIdRef.current = null
}

export async function waitForTurnstileToken(options: WaitForTurnstileTokenOptions): Promise<string> {
  const hostname = options.hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  const widgetIdRef = options.widgetIdRef ?? { current: null }
  const hasRender = typeof options.turnstile?.render === 'function'
  const hasExecute = typeof options.turnstile?.execute === 'function'
  if (shouldSkipTurnstile(hostname)) {
    return ''
  }
  if (!options.turnstile || !hasRender || !hasExecute || !options.container) {
    return ''
  }

  const existing = inFlightByWidget.get(widgetIdRef)
  if (existing) {
    return existing
  }

  const timeoutMs = options.timeoutMs ?? 8_000
  const turnstile = options.turnstile
  const container = options.container

  const pending = new Promise<string>((resolve) => {
    let settled = false
    const done = (token: string) => {
      if (settled) {
        return
      }
      settled = true
      resolve(token)
    }

    const timer = setTimeout(() => done(''), timeoutMs)
    const onToken = (token: string) => {
      clearTimeout(timer)
      done(token)
    }

    void (async () => {
      try {
        await whenReady(turnstile)
        if (settled) {
          return
        }
        const widgetId = ensureWidget({
          turnstile,
          container,
          sitekey: options.sitekey,
          widgetIdRef,
          onToken: (token) => onToken(token),
        })
        try {
          turnstile.reset(widgetId)
        } catch {
          // First run has nothing to reset.
        }
        turnstile.execute(widgetId)
      } catch {
        clearTimeout(timer)
        done('')
      }
    })()
  })
  inFlightByWidget.set(widgetIdRef, pending)
  try {
    return await pending
  } finally {
    if (inFlightByWidget.get(widgetIdRef) === pending) {
      inFlightByWidget.delete(widgetIdRef)
    }
  }
}
