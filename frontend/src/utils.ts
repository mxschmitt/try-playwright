import { Examples } from "./constants";

export const runCode = async (code: string): Promise<APIResponse> => {
  const resp = await fetch("/service/control/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code,
    })
  })
  if (!resp.ok) {
    if (resp.headers.get("Content-Type")?.includes("application/json")) {
      const error = await resp.json()
      throw new Error(error.error)
    }
    throw new Error("Execution was not successfull, please try again in a few minutes...")
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

export const determineCode = async (setCode: ((code: string) => void)): Promise<void> => {
  const urlParams = new URLSearchParams(window.location.search);
  const localStorageCode = window.localStorage.getItem("code")
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
    const example = Examples.find(example => example.id === id)
    if (example) {
      return setCode(example.code)
    }
  } else if (localStorageCode) {
    return setCode(localStorageCode)
  }
  // Fallback
  setCode(Examples[0].code)
}