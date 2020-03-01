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