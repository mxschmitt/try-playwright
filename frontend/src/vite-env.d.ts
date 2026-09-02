/// <reference types="vite/client" />

interface TryPlaywrightRuntimeConfig {
  skipTurnstile?: boolean
}

interface Window {
  __TRY_PLAYWRIGHT__?: TryPlaywrightRuntimeConfig
  monacoEditorModel?: {
    getValue?: () => string
    setValue?: (value: string) => void
  }
  turnstile?: {
    reset: (container?: HTMLElement | null) => void
    execute: (container: HTMLElement | null, options?: Record<string, unknown>) => void
  }
}

