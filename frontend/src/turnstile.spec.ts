import { test, expect } from '@playwright/experimental-ct-react';
import { waitForTurnstileToken } from './turnstile';

test('returns empty string when execute never invokes a callback', async () => {
  const token = await waitForTurnstileToken({
    turnstile: {
      reset() {},
      execute() {},
    },
    container: null,
    sitekey: 'test',
    timeoutMs: 50,
  })
  expect(token).toBe('')
})

test('returns empty string when execute throws', async () => {
  const token = await waitForTurnstileToken({
    turnstile: {
      reset() {},
      execute() {
        throw new Error('turnstile missing')
      },
    },
    container: null,
    sitekey: 'test',
    timeoutMs: 5_000,
  })
  expect(token).toBe('')
})

test('resolves with the callback token', async () => {
  const token = await waitForTurnstileToken({
    turnstile: {
      reset() {},
      execute(_container, options) {
        const callback = options?.callback as ((value: string) => void) | undefined
        callback?.('cf-token')
      },
    },
    container: null,
    sitekey: 'test',
    timeoutMs: 5_000,
  })
  expect(token).toBe('cf-token')
})
