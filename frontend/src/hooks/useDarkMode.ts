import { useState, useEffect } from 'react'

const useDarkMode = (): [boolean] => {
  const [darkMode, setDarkMode] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mql.matches)
    const handler = (ev: MediaQueryListEvent): void => {
      setDarkMode(ev.matches)
    }
    if (mql.addListener){
      mql.addListener(handler);
    } else {
      mql.addEventListener("change", handler);
    }
    return (): void => {
      if (mql.removeListener) {
        mql.removeListener(handler)
      } else {
        mql.removeEventListener("change", handler)
      }
    }
  }, [])
  return [darkMode]
}

export default useDarkMode