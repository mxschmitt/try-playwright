import { CodeLanguage, LANGUAGES } from "./constants";
import { Example } from "./examples";

export const runCode = async (code: string): Promise<SuccessExecutionResponse> => {
  const resp = await fetch("/service/control/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code,
      language: determineLanguage()
    })
  })
  if (!resp.ok) {
    if (resp.status === 429) {
      throw new Error("You are rate limited, please try again in a few minutes.")
    }
    if (resp.headers.get("Content-Type")?.includes("application/json")) {
      const error = await resp.json()
      throw new Error(error.error)
    }
    throw new Error("Execution was not successful, please try again in a few minutes.")
  }
  return await resp.json()
}

export const trackEvent = (): void => {
  if (window.gtag && process.env.NODE_ENV === "production") {
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
    if (localStorageLanguage) {
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
