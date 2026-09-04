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

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])
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

function isUsableApi(api: TurnstileApi | null | undefined): api is TurnstileApi {
  return typeof api?.render === 'function' && typeof api?.execute === 'function'
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

  private waitForApi(): Promise<TurnstileApi | null> {
    const immediate = this.api()
    if (isUsableApi(immediate)) {
      return Promise.resolve(immediate)
    }
    // Injected getApi without a wait budget is the source of truth for tests.
    const pollMs = this.options.getApi
      ? this.options.timeoutMs
      : (this.options.timeoutMs ?? 15_000)
    if (pollMs === undefined) {
      return Promise.resolve(null)
    }
    return new Promise((resolve) => {
      const started = Date.now()
      const poll = () => {
        const api = this.api()
        if (isUsableApi(api)) {
          resolve(api)
          return
        }
        if (Date.now() - started >= pollMs) {
          resolve(null)
          return
        }
        setTimeout(poll, 50)
      }
      poll()
    })
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
    if (!container) {
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
          const api = await this.waitForApi()
          if (settled) {
            return
          }
          if (!isUsableApi(api)) {
            done('')
            return
          }
          // Do not call turnstile.ready(): with async/defer api.js it throws
          // "Remove async/defer ... before using turnstile.ready()", which
          // used to settle this promise with an empty token on production.
          const alreadyRendered = Boolean(this.widgetId)
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
          // Reset only on later runs. reset() on a widget that has never
          // executed can fire error-callback and settle with an empty token
          // before execute() produces a real one.
          if (alreadyRendered) {
            try {
              api.reset(this.widgetId)
            } catch {
              // Widget may already be idle.
            }
          }
          api.execute(this.widgetId ?? container)
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
  hostname?: string
}): TurnstileMode {
  const override = input?.override !== undefined
    ? input.override
    : (typeof window !== 'undefined' ? window[WINDOW_OVERRIDE_KEY] : undefined) ?? null
  if (override === 'noop' || override === 'cloudflare') {
    return override
  }
  const hostname = input?.hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  if (LOCAL_HOSTS.has(hostname)) {
    return 'noop'
  }
  return 'cloudflare'
}

export function createTurnstileGate(input?: {
  mode?: TurnstileMode
  override?: string | null
  hostname?: string
  sitekey?: string
  timeoutMs?: number
  getApi?: () => TurnstileApi | null | undefined
}): TurnstileGate {
  const mode = input?.mode ?? resolveTurnstileMode({
    override: input?.override,
    hostname: input?.hostname,
  })
  if (mode === 'noop') {
    return new NoopTurnstileGate()
  }
  return new CloudflareTurnstileGate(input?.sitekey ?? '', {
    timeoutMs: input?.timeoutMs,
    getApi: input?.getApi,
  })
}
