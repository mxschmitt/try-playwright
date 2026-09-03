import { test, expect } from '@playwright/experimental-ct-react'
import {
  CloudflareTurnstileGate,
  NoopTurnstileGate,
  createTurnstileGate,
  resolveTurnstileMode,
  type TurnstileApi,
  type TurnstileRenderOptions,
} from './turnstile'

const container = {} as HTMLElement

function mockApi(overrides: Partial<TurnstileApi> = {}): { api: TurnstileApi; options: TurnstileRenderOptions[] } {
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

test('defaults to noop on loopback and cloudflare elsewhere', () => {
  expect(resolveTurnstileMode({ hostname: '127.0.0.1' })).toBe('noop')
  expect(resolveTurnstileMode({ hostname: 'localhost' })).toBe('noop')
  expect(resolveTurnstileMode({ hostname: 'try.playwright.tech' })).toBe('cloudflare')
})

test('window override swaps the implementation at runtime', () => {
  expect(resolveTurnstileMode({ hostname: 'try.playwright.tech', override: 'noop' })).toBe('noop')
  expect(resolveTurnstileMode({ hostname: '127.0.0.1', override: 'cloudflare' })).toBe('cloudflare')
  expect(createTurnstileGate({ hostname: 'try.playwright.tech', override: 'noop' })).toBeInstanceOf(NoopTurnstileGate)
  expect(createTurnstileGate({ hostname: '127.0.0.1', override: 'cloudflare', sitekey: 'k' })).toBeInstanceOf(CloudflareTurnstileGate)
})

test('noop gate never calls Turnstile execute', async () => {
  let executed = false
  const gate = createTurnstileGate({
    mode: 'noop',
    getApi: () => ({
      render: () => 'w',
      execute: () => {
        executed = true
      },
      reset: () => undefined,
    }),
  })
  expect(await gate.getToken(container)).toBe('')
  expect(executed).toBe(false)
})

test('cloudflare gate returns empty when the API is missing', async () => {
  const gate = new CloudflareTurnstileGate('sitekey', { getApi: () => null })
  expect(await gate.getToken(container)).toBe('')
})

test('cloudflare gate does not hang when render throws', async () => {
  const gate = new CloudflareTurnstileGate('sitekey', {
    getApi: () => ({
      render: () => {
        throw new Error('no widget')
      },
      execute: () => undefined,
      reset: () => undefined,
    }),
  })
  expect(await gate.getToken(container)).toBe('')
})

test('cloudflare gate renders then execute(widgetId) without reset on first run', async () => {
  const { api, options } = mockApi()
  let executedWith: unknown
  let resetCount = 0
  api.execute = (target) => {
    executedWith = target
    options.at(-1)?.callback?.('tok')
  }
  api.reset = () => {
    resetCount += 1
  }
  const gate = new CloudflareTurnstileGate('sitekey', { getApi: () => api })
  expect(await gate.getToken(container)).toBe('tok')
  expect(executedWith).toBe('widget-1')
  expect(resetCount).toBe(0)
  expect(options[0]).toMatchObject({
    sitekey: 'sitekey',
    execution: 'execute',
    appearance: 'interaction-only',
  })
})

test('first-run reset error-callback does not eat the execute token', async () => {
  const { api, options } = mockApi()
  api.reset = () => {
    options.at(-1)?.['error-callback']?.()
  }
  api.execute = () => {
    options.at(-1)?.callback?.('tok')
  }
  const gate = new CloudflareTurnstileGate('sitekey', { getApi: () => api })
  expect(await gate.getToken(container)).toBe('tok')
})

test('overlapping getToken shares one widget callback', async () => {
  const { api, options } = mockApi({
    execute: () => undefined,
  })
  let executeCount = 0
  api.execute = () => {
    executeCount += 1
  }
  const gate = new CloudflareTurnstileGate('sitekey', { getApi: () => api })
  const first = gate.getToken(container)
  const second = gate.getToken(container)
  await Promise.resolve()
  expect(executeCount).toBe(1)
  options[0]?.callback?.('tok')
  expect(await Promise.all([first, second])).toEqual(['tok', 'tok'])
})

test('reuses the rendered widget on a later getToken', async () => {
  let renderCount = 0
  let resetCount = 0
  const { api, options } = mockApi({
    render: (_container, renderOptions) => {
      renderCount += 1
      options.push(renderOptions)
      return 'widget-1'
    },
  })
  api.reset = () => {
    resetCount += 1
  }
  api.execute = () => {
    options.at(-1)?.callback?.(`tok-${renderCount}-${resetCount}`)
  }
  const gate = new CloudflareTurnstileGate('sitekey', { getApi: () => api })
  expect(await gate.getToken(container)).toBe('tok-1-0')
  expect(await gate.getToken(container)).toBe('tok-1-1')
  expect(renderCount).toBe(1)
  expect(resetCount).toBe(1)
})

test('waits for window.turnstile when the script loads after getToken', async () => {
  const { api, options } = mockApi()
  api.execute = () => {
    options.at(-1)?.callback?.('late-tok')
  }
  const previous = window.turnstile
  delete window.turnstile
  const gate = new CloudflareTurnstileGate('sitekey', { timeoutMs: 1000 })
  const pending = gate.getToken(container)
  await new Promise((resolve) => setTimeout(resolve, 20))
  window.turnstile = api
  expect(await pending).toBe('late-tok')
  window.turnstile = previous
})

test('cloudflare gate resolves empty on error-callback', async () => {
  const { api, options } = mockApi()
  api.execute = () => {
    options.at(-1)?.['error-callback']?.()
  }
  const gate = new CloudflareTurnstileGate('sitekey', { getApi: () => api })
  expect(await gate.getToken(container)).toBe('')
})

test('optional timeoutMs is for tests; production has no client deadline', async () => {
  const { api } = mockApi({
    execute: () => undefined,
  })
  const gate = new CloudflareTurnstileGate('sitekey', {
    timeoutMs: 50,
    getApi: () => api,
  })
  expect(await gate.getToken(container)).toBe('')
})
