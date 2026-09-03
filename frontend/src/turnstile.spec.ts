import { test, expect } from '@playwright/experimental-ct-react'
import { shouldSkipTurnstile, waitForTurnstileToken, type TurnstileApi, type TurnstileRenderOptions } from './turnstile'

const container = {} as HTMLElement

function mockTurnstile(overrides: Partial<TurnstileApi> = {}): { api: TurnstileApi; options: TurnstileRenderOptions[] } {
  const rendered: TurnstileRenderOptions[] = []
  const api: TurnstileApi = {
    ready: (callback) => callback(),
    render: (_container, options) => {
      rendered.push(options)
      return 'widget-1'
    },
    execute: () => {
      rendered.at(-1)?.callback?.('tok')
    },
    reset: () => undefined,
    remove: () => undefined,
    ...overrides,
  }
  return { api, options: rendered }
}

test('skips Turnstile on CI-style loopback hosts', () => {
  expect(shouldSkipTurnstile('127.0.0.1')).toBe(true)
  expect(shouldSkipTurnstile('localhost')).toBe(true)
  expect(shouldSkipTurnstile('try.playwright.tech')).toBe(false)
})

test('returns empty when the Turnstile API is missing', async () => {
  const token = await waitForTurnstileToken({
    turnstile: null,
    container,
    sitekey: 'sitekey',
    hostname: 'try.playwright.tech',
  })
  expect(token).toBe('')
})

test('does not hang when render throws', async () => {
  const { api } = mockTurnstile({
    render: () => {
      throw new Error('no widget')
    },
  })
  const token = await waitForTurnstileToken({
    turnstile: api,
    container,
    sitekey: 'sitekey',
    hostname: 'try.playwright.tech',
  })
  expect(token).toBe('')
})

test('renders with execution=execute then execute(widgetId)', async () => {
  const { api, options } = mockTurnstile()
  let executedWith: unknown
  let resetWith: unknown
  api.execute = (target) => {
    executedWith = target
    options.at(-1)?.callback?.('tok')
  }
  api.reset = (target) => {
    resetWith = target
  }

  const widgetIdRef = { current: null as string | null }
  const token = await waitForTurnstileToken({
    turnstile: api,
    container,
    sitekey: 'sitekey',
    hostname: 'try.playwright.tech',
    widgetIdRef,
  })

  expect(token).toBe('tok')
  expect(widgetIdRef.current).toBe('widget-1')
  expect(executedWith).toBe('widget-1')
  expect(resetWith).toBe('widget-1')
  expect(options[0]).toMatchObject({
    sitekey: 'sitekey',
    execution: 'execute',
    appearance: 'interaction-only',
  })
})

test('reuses the rendered widget on a later execute', async () => {
  let renderCount = 0
  const { api, options } = mockTurnstile({
    render: (_container, renderOptions) => {
      renderCount += 1
      options.push(renderOptions)
      return 'widget-1'
    },
  })
  api.execute = () => {
    options.at(-1)?.callback?.(`tok-${renderCount}`)
  }
  const widgetIdRef = { current: null as string | null }

  await waitForTurnstileToken({
    turnstile: api,
    container,
    sitekey: 'sitekey',
    hostname: 'try.playwright.tech',
    widgetIdRef,
  })
  const token = await waitForTurnstileToken({
    turnstile: api,
    container,
    sitekey: 'sitekey',
    hostname: 'try.playwright.tech',
    widgetIdRef,
  })

  expect(renderCount).toBe(1)
  expect(token).toBe('tok-1')
})

test('resolves empty on error-callback', async () => {
  const { api, options } = mockTurnstile()
  api.execute = () => {
    options.at(-1)?.['error-callback']?.()
  }
  const token = await waitForTurnstileToken({
    turnstile: api,
    container,
    sitekey: 'sitekey',
    hostname: 'try.playwright.tech',
  })
  expect(token).toBe('')
})

test('times out when neither callback fires (interactive / bot challenge)', async () => {
  const { api } = mockTurnstile({
    execute: () => undefined,
  })
  const token = await waitForTurnstileToken({
    turnstile: api,
    container,
    sitekey: 'sitekey',
    hostname: 'try.playwright.tech',
    timeoutMs: 50,
  })
  expect(token).toBe('')
})

test('skips render and execute entirely on 127.0.0.1', async () => {
  let rendered = false
  let executed = false
  const { api } = mockTurnstile({
    render: () => {
      rendered = true
      return 'widget-1'
    },
    execute: () => {
      executed = true
    },
  })
  const token = await waitForTurnstileToken({
    turnstile: api,
    container,
    sitekey: 'sitekey',
    hostname: '127.0.0.1',
    timeoutMs: 50,
  })
  expect(rendered).toBe(false)
  expect(executed).toBe(false)
  expect(token).toBe('')
})
