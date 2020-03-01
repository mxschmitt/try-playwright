import lzString from "lz-string";

import { Examples } from './constants'

export const getDropdownTitle = (code: string): string => {
  const item = Examples.find(item => item.code === code)
  if (item) {
    return item.title
  }
  return "Custom"
}

export const encodeCode = (code: string): string => {
  return lzString.compressToEncodedURIComponent(code)
}

export const decodeCode = (code: string | null): string => {
  if (!code) {
    return ""
  }
  return lzString.decompressFromEncodedURIComponent(code)
}

export const runCode = async (code: string, browser: BrowserType): Promise<APIResponse> => {
  const resp = await fetch("/api/v1/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code,
      browser
    })
  })
  if (!resp.ok) {
    throw new Error("Execution was not successfull, please try again in a few minutes...")
  }
  return await resp.json()
}