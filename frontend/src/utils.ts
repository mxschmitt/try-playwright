import { Examples } from './constants'

export const getDropdownTitle = (code: string): string => {
  const item = Examples.find(item => item.code === code)
  if (item) {
    return item.title
  }
  return "Custom"
}