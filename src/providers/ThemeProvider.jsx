import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const storageKeys = {
  theme: 'facility-command-theme',
  fontSize: 'facility-command-font-size'
}

export const fontSizes = {
  compact: {
    name: 'compact',
    label: 'Compact',
    root: '14px',
    scale: '0.92',
    nav: '12px',
    navLabel: '9px',
    brand: '13px',
    topbar: '11px',
    pageTitle: '30px',
    pageDescription: '13px',
    pageEyebrow: '8.5px'
  },
  normal: {
    name: 'normal',
    label: 'Normal',
    root: '16px',
    scale: '1',
    nav: '13px',
    navLabel: '10px',
    brand: '14px',
    topbar: '12px',
    pageTitle: '38px',
    pageDescription: '14px',
    pageEyebrow: '9px'
  },
  comfortable: {
    name: 'comfortable',
    label: 'Comfortable',
    root: '17px',
    scale: '1.06',
    nav: '14px',
    navLabel: '10.5px',
    brand: '15px',
    topbar: '13px',
    pageTitle: '42px',
    pageDescription: '15px',
    pageEyebrow: '10px'
  },
  large: {
    name: 'large',
    label: 'Large',
    root: '18px',
    scale: '1.12',
    nav: '15px',
    navLabel: '11px',
    brand: '16px',
    topbar: '14px',
    pageTitle: '46px',
    pageDescription: '16px',
    pageEyebrow: '11px'
  }
}

export const themes = {
  light: {
    name: 'light',
    tokens: {
      '--app-bg': '#f4f5f0',
      '--app-panel': '#ffffff',
      '--app-ink': '#1e2823',
      '--app-muted': '#727a75',
      '--app-line': '#e3e6df',
      '--app-primary': '#4f46e5',
      '--app-accent': '#818cf8',

      '--ink': '#1e2823',
      '--muted': '#727a75',
      '--line': '#e3e6df',
      '--panel': '#ffffff',

      '--green': '#4f46e5',
      '--lime': '#818cf8',
      '--orange': '#f59e0b'
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
      '--app-primary': '#4f46e5',
      '--app-accent': '#818cf8',

      '--ink': '#eef5f0',
      '--muted': '#a8b6ae',
      '--line': '#2d3c34',
      '--panel': '#17231d',

      '--green': '#6366f1',
      '--lime': '#a5b4fc',
      '--orange': '#fbbf24'
    }
  }
}

const readStoredValue = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  return window.localStorage.getItem(key) || fallback
}

export function ThemeProvider({ children, defaultTheme = 'light', defaultFontSize = 'normal' }) {
  const [themeName, setThemeName] = useState(() => readStoredValue(storageKeys.theme, defaultTheme))
  const [fontSizeName, setFontSizeName] = useState(() => readStoredValue(storageKeys.fontSize, defaultFontSize))
  const theme = themes[themeName] || themes.light
  const fontSize = fontSizes[fontSizeName] || fontSizes.normal

  useEffect(() => {
    document.documentElement.dataset.theme = theme.name
    Object.entries(theme.tokens).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value)
    })
    document.body.style.background = theme.tokens['--app-bg']
    window.localStorage.setItem(storageKeys.theme, theme.name)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize.name
    document.documentElement.style.fontSize = fontSize.root
    document.documentElement.style.setProperty('--app-font-scale', fontSize.scale)
    document.documentElement.style.setProperty('--app-nav-font-size', fontSize.nav)
    document.documentElement.style.setProperty('--app-nav-label-font-size', fontSize.navLabel)
    document.documentElement.style.setProperty('--app-brand-font-size', fontSize.brand)
    document.documentElement.style.setProperty('--app-topbar-font-size', fontSize.topbar)
    document.documentElement.style.setProperty('--app-page-title-font-size', fontSize.pageTitle)
    document.documentElement.style.setProperty('--app-page-description-font-size', fontSize.pageDescription)
    document.documentElement.style.setProperty('--app-page-eyebrow-font-size', fontSize.pageEyebrow)
    window.localStorage.setItem(storageKeys.fontSize, fontSize.name)
  }, [fontSize])

  const value = useMemo(() => ({
    theme,
    themeName,
    themes,
    setThemeName,
    toggleTheme: () => setThemeName(current => current === 'light' ? 'dark' : 'light'),
    fontSize,
    fontSizeName,
    fontSizes,
    setFontSizeName
  }), [theme, themeName, fontSize, fontSizeName])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
