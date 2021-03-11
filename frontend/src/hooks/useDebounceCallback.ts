import { useEffect, useRef } from "react"

type DebouncedHookReturn = [Function, Function, boolean]

const useDebounceCallback = (callback: Function, timeout: number): DebouncedHookReturn => {
  const timeoutRef = useRef<number | null>(null)

  const cancelDebounce = () => {
    if (timeoutRef.current !== null)
      clearTimeout(timeoutRef.current)
  }
  const debouncedCallback = () => {
    cancelDebounce()
    timeoutRef.current = setTimeout(callback, timeout)
  }
  const isDebouncePending = timeoutRef.current !== null

  useEffect(() => {
    return () => cancelDebounce()
  }, [])

  return [
    debouncedCallback,
    cancelDebounce,
    isDebouncePending
  ]
}

export default useDebounceCallback
