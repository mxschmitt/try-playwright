import lzString from "lz-string";

export const encodeCode = (code: string): string => {
  return lzString.compressToEncodedURIComponent(code)
}

export const decodeCode = (code: string | null): string => {
  if (!code) {
    return ""
  }
  return lzString.decompressFromEncodedURIComponent(code)
}

export const runCode = async (code: string): Promise<APIResponse> => {
  const resp = await fetch("/api/v1/run", {
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
  // @ts-ignore
  if (window.gtag && process.env.NODE_ENV === "production") {
    // @ts-ignore
    window.gtag('event', "execute", {
      'event_category': "engagement",
    });
  }
}