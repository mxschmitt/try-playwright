import { CodeLanguage, LANGUAGES } from "./constants";
import { Example } from "./examples";

export interface FileWrapper {
  publicURL: string;
  fileName?: string;
  extension: string;
}

export type ExecutionResponse = Partial<{
  success: boolean
  error: string
  version: string;
  duration?: number;
  files: FileWrapper[];
  output: string;
}>

export const runCode = async (
  code: string,
  codeLanguage: CodeLanguage,
  turnstileToken: string,
  onUpdate?: (resp: ExecutionResponse) => void,
): Promise<ExecutionResponse> => {
  if (codeLanguage === CodeLanguage.PLAYWRIGHT_TEST)
    codeLanguage = CodeLanguage.JAVASCRIPT
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
  }
  if (window.__TRY_PLAYWRIGHT_TEST_ID__) {
    headers["X-Test-ID"] = window.__TRY_PLAYWRIGHT_TEST_ID__
  }
  const resp = await fetch("/service/control/run", {
    method: "POST",
    headers,
    body: JSON.stringify({
      code,
      language: codeLanguage,
      token: turnstileToken,
    })
  })

  if (resp.status === 429) {
    return { error: "You are rate limited, please try again in a few minutes." }
  }
  if (resp.status === 202) {
    const body = await resp.json() as { id?: string }
    if (!body.id) {
      return { error: "Execution was not successful, please try again in a few minutes." }
    }
    return watchRunLogs(body.id, onUpdate)
  }
  if (!resp.ok) {
    if (resp.headers.get("Content-Type")?.includes("application/json")) {
      return await resp.json()
    }
    return { error: "Execution was not successful, please try again in a few minutes." }
  }
  return await resp.json()
}

const watchRunLogs = (id: string, onUpdate?: (resp: ExecutionResponse) => void): Promise<ExecutionResponse> => {
  return new Promise((resolve, reject) => {
    const es = new EventSource(`/service/control/run/${encodeURIComponent(id)}/log-watch`)
    let output = ""
    let settled = false
    const finish = (value: ExecutionResponse) => {
      if (settled) {
        return
      }
      settled = true
      es.close()
      resolve(value)
    }
    es.addEventListener("log", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { line?: string }
      const line = data.line ?? ""
      output = output ? `${output}\n${line}` : line
      onUpdate?.({ output })
    })
    es.addEventListener("done", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as ExecutionResponse
      if (data.output === undefined || data.output === "") {
        data.output = output
      }
      finish(data)
    })
    es.onerror = () => {
      if (settled) {
        return
      }
      settled = true
      es.close()
      reject(new Error("log watch failed"))
    }
  })
}

declare global {
  interface Window {
    gtag?: (kind: string, event: string, metaData: Record<string, string>) => void
    __TRY_PLAYWRIGHT_TEST_ID__?: string
  }
}

export const trackEvent = (): void => {
  if (window.gtag && process.env.NODE_ENV === "production" && !window.navigator.webdriver) {
    window.gtag('event', "execute", {
      'event_category': "engagement",
    });
  }
}

const fetchSharedCode = async (code: string): Promise<string | null> => {
  const resp = await fetch(`/service/control/share/get/${code}`)
  if (!resp.ok) {
    return null
  }
  return await resp.text()
}

export const determineCode = async (setCode: ((code: string) => void), examples: Example[]): Promise<void> => {
  const urlParams = new URLSearchParams(window.location.search);
  const localStorageCode = window.localStorage && window.localStorage.getItem("code")
  if (urlParams.has("s")) {
    const key = urlParams.get("s")
    if (key) {
      const sharedCode = await fetchSharedCode(key)
      if (sharedCode) {
        return setCode(sharedCode)
      }
    }
  } else if (urlParams.has("e")) {
    const id = urlParams.get("e")
    const example = examples.find(example => example.id === id)
    if (example) {
      return setCode(example.code)
    }
  } else if (localStorageCode) {
    return setCode(localStorageCode)
  }
  // Fallback
  setCode(examples?.[0]?.code)
}

export const determineLanguage = (): CodeLanguage => {
  const params = new URLSearchParams(window.location.search)
  const paramsLanguage = params.get("l") as CodeLanguage
  if (paramsLanguage && LANGUAGES.includes(paramsLanguage)) {
    return paramsLanguage
  }
  if (window.localStorage) {
    const localStorageLanguage = window.localStorage.getItem("language") as CodeLanguage
    if (localStorageLanguage && LANGUAGES.includes(localStorageLanguage)) {
      return localStorageLanguage
    }
  }
  return CodeLanguage.JAVASCRIPT
}

export const pushNewURL = (params: URLSearchParams): string => {
  const newURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`
  window.history.pushState(null, "Try Playwright", newURL)
  return newURL
}
