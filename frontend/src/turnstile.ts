export type TurnstileMode = 'noop' | 'cloudflare'

export interface TurnstileGate {
  readonly mode: TurnstileMode
  getToken(container: HTMLElement | null): Promise<string>
  remove(): void
}

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

const WINDOW_OVERRIDE_KEY = '__TRY_PLAYWRIGHT_TURNSTILE__'

declare global {
  interface Window {
    __TRY_PLAYWRIGHT_TURNSTILE__?: TurnstileMode
    turnstile?: TurnstileApi
  }
}

export class NoopTurnstileGate implements TurnstileGate {
  readonly mode = 'noop' as const

  getToken(_container: HTMLElement | null): Promise<string> {
    return Promise.resolve('')
  }

  remove(): void {}
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

export class CloudflareTurnstileGate implements TurnstileGate {
  readonly mode = 'cloudflare' as const
  private widgetId: string | null = null
  private inFlight: Promise<string> | null = null
  private pending: ((token: string) => void) | null = null

  constructor(
    private readonly sitekey: string,
    private readonly options: {
      timeoutMs?: number
      getApi?: () => TurnstileApi | null | undefined
    } = {},
  ) {}

  private api(): TurnstileApi | null | undefined {
    return this.options.getApi?.() ?? (typeof window !== 'undefined' ? window.turnstile : undefined)
  }

  async getToken(container: HTMLElement | null): Promise<string> {
    if (this.inFlight) {
      return this.inFlight
    }
    this.inFlight = this.requestToken(container)
    try {
      return await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  remove(): void {
    const api = this.api()
    const widgetId = this.widgetId
    this.widgetId = null
    this.pending = null
    if (!widgetId || typeof api?.remove !== 'function') {
      return
    }
    try {
      api.remove(widgetId)
    } catch {
      // Widget may already be gone.
    }
  }

  private requestToken(container: HTMLElement | null): Promise<string> {
    const api = this.api()
    const hasRender = typeof api?.render === 'function'
    const hasExecute = typeof api?.execute === 'function'
    if (!api || !hasRender || !hasExecute || !container) {
      return Promise.resolve('')
    }

    const timeoutMs = this.options.timeoutMs

    return new Promise<string>((resolve) => {
      let settled = false
      const done = (token: string) => {
        if (settled) {
          return
        }
        settled = true
        this.pending = null
        resolve(token)
      }

      this.pending = (token) => done(token)
      const timer = timeoutMs === undefined
        ? undefined
        : setTimeout(() => done(''), timeoutMs)

      void (async () => {
        try {
          await whenReady(api)
          if (settled) {
            return
          }
          if (!this.widgetId) {
            this.widgetId = api.render(container, {
              sitekey: this.sitekey,
              execution: 'execute',
              appearance: 'interaction-only',
              callback: (token: string) => {
                if (timer) {
                  clearTimeout(timer)
                }
                this.pending?.(token || '')
              },
              'error-callback': () => {
                if (timer) {
                  clearTimeout(timer)
                }
                this.pending?.('')
              },
              'timeout-callback': () => {
                if (timer) {
                  clearTimeout(timer)
                }
                this.pending?.('')
              },
              'expired-callback': () => {
                if (timer) {
                  clearTimeout(timer)
                }
                this.pending?.('')
              },
            })
          }
          try {
            api.reset(this.widgetId)
          } catch {
            // First run has nothing to reset.
          }
          api.execute(this.widgetId)
        } catch {
          if (timer) {
            clearTimeout(timer)
          }
          done('')
        }
      })()
    })
  }
}

export function resolveTurnstileMode(input?: {
  override?: string | null
  automated?: boolean
}): TurnstileMode {
  const override = input?.override !== undefined
    ? input.override
    : (typeof window !== 'undefined' ? window[WINDOW_OVERRIDE_KEY] : undefined) ?? null
  if (override === 'noop' || override === 'cloudflare') {
    return override
  }
  const automated = input?.automated ?? (typeof navigator !== 'undefined' && navigator.webdriver === true)
  if (automated) {
    return 'noop'
  }
  return 'cloudflare'
}

export function createTurnstileGate(input?: {
  mode?: TurnstileMode
  override?: string | null
  automated?: boolean
  sitekey?: string
  timeoutMs?: number
  getApi?: () => TurnstileApi | null | undefined
}): TurnstileGate {
  const mode = input?.mode ?? resolveTurnstileMode({
    override: input?.override,
    automated: input?.automated,
  })
  if (mode === 'noop') {
    return new NoopTurnstileGate()
  }
  return new CloudflareTurnstileGate(input?.sitekey ?? '', {
    timeoutMs: input?.timeoutMs,
    getApi: input?.getApi,
  })
}
