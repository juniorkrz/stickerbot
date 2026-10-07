import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const KEY = 'sbpanel-theme'

const read = (): Theme => {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

const apply = (theme: Theme) => {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

apply(read())

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(read)
  useEffect(() => {
    apply(theme)
    try {
      if (theme === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, theme)
    } catch {
      // sem storage
    }
  }, [theme])
  return [theme, setTheme] as const
}
