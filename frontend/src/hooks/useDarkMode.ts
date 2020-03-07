import { useState, useEffect } from 'react'

const useDarkMode = (): [boolean] => {
  const [darkMode, setDarkMode] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mql.matches)
    const handler = (ev: MediaQueryListEvent): void => {
      setDarkMode(ev.matches)
    }
    mql.addListener(handler)
    return (): void => mql.removeListener(handler)
  }, [])
  return [darkMode]
}

export default useDarkMode