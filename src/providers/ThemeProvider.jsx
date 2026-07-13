import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export const themes = {
  light: {
    name: 'light',
    tokens: {
      '--app-bg': '#f4f5f0',
      '--app-panel': '#ffffff',
      '--app-ink': '#1e2823',
      '--app-muted': '#727a75',
      '--app-line': '#e3e6df',
      '--app-primary': '#315a47',
      '--app-accent': '#cfe775'
    }
  },
  dark: {
    name: 'dark',
    tokens: {
      '--app-bg': '#111a15',
      '--app-panel': '#17231d',
      '--app-ink': '#eef5f0',
      '--app-muted': '#a8b6ae',
      '--app-line': '#2d3c34',
      '--app-primary': '#7fb596',
      '--app-accent': '#d7ed82'
    }
  }
}

export function ThemeProvider({ children, defaultTheme = 'light' }) {
  const [themeName, setThemeName] = useState(defaultTheme)
  const theme = themes[themeName] || themes.light

  useEffect(() => {
    document.documentElement.dataset.theme = theme.name
    Object.entries(theme.tokens).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value)
    })
  }, [theme])

  const value = useMemo(() => ({
    theme,
    themeName,
    setThemeName,
    toggleTheme: () => setThemeName(current => current === 'light' ? 'dark' : 'light')
  }), [theme, themeName])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
