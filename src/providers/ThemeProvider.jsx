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
    tab: '10px',
    tabIndex: '7px',
    table: '10px',
    tableHeader: '8px',
    tableFooter: '9px',
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
    tab: '11px',
    tabIndex: '8px',
    table: '11px',
    tableHeader: '9px',
    tableFooter: '10px',
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
    tab: '12px',
    tabIndex: '8.5px',
    table: '12px',
    tableHeader: '10px',
    tableFooter: '11px',
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
    tab: '13px',
    tabIndex: '9px',
    table: '13px',
    tableHeader: '11px',
    tableFooter: '12px',
    pageTitle: '46px',
    pageDescription: '16px',
    pageEyebrow: '11px'
  }
}

export const themes = {
  light: {
    name: 'light',
    tokens: {
      // Base
      '--app-bg': '#F8FAFC',
      '--app-panel': '#FFFFFF',
      '--app-ink': '#0F172A',
      '--app-muted': '#64748B',
      '--app-line': '#E2E8F0',
      '--app-table-bg': '#FFFFFF',
      '--app-table-header-bg': '#F8FAFC',
      '--app-table-footer-bg': '#F8FAFC',
      '--app-table-hover-bg': '#F1F5F9',
      '--app-table-text': '#475569',
      '--app-table-heading': '#64748B',

      // Brand
      '--app-primary': '#1D4ED8',
      '--app-primary-hover': '#1E40AF',
      '--app-accent': '#60A5FA',

      // Sidebar
      '--app-sidebar-bg': '#0F172A',
      '--app-sidebar-panel': '#1E293B',
      '--app-sidebar-hover': '#334155',
      '--app-sidebar-active': '#1D4ED8',
      '--app-sidebar-text': '#F8FAFC',
      '--app-sidebar-muted': '#94A3B8',
      '--app-sidebar-accent': '#60A5FA',
      '--app-sidebar-accent-ink': '#FFFFFF',

      // Legacy Tokens
      '--ink': '#0F172A',
      '--muted': '#64748B',
      '--line': '#E2E8F0',
      '--panel': '#FFFFFF',

      // Legacy Color Aliases
      '--green': '#1D4ED8',
      '--lime': '#60A5FA',
      '--orange': '#F59E0B',

      // Optional Status Colors
      '--success': '#22C55E',
      '--warning': '#F59E0B',
      '--danger': '#EF4444',
      '--info': '#0EA5E9'
    }
  },

  dark: {
    name: 'dark',
    tokens: {
      // Base
      '--app-bg': '#020617',
      '--app-panel': '#0F172A',
      '--app-ink': '#F8FAFC',
      '--app-muted': '#94A3B8',
      '--app-line': '#1E293B',
      '--app-table-bg': '#0F172A',
      '--app-table-header-bg': '#111827',
      '--app-table-footer-bg': '#111827',
      '--app-table-hover-bg': '#1E293B',
      '--app-table-text': '#CBD5E1',
      '--app-table-heading': '#94A3B8',

      // Brand
      '--app-primary': '#3B82F6',
      '--app-primary-hover': '#2563EB',
      '--app-accent': '#93C5FD',

      // Sidebar
      '--app-sidebar-bg': '#020617',
      '--app-sidebar-panel': '#0F172A',
      '--app-sidebar-hover': '#1E293B',
      '--app-sidebar-active': '#2563EB',
      '--app-sidebar-text': '#F8FAFC',
      '--app-sidebar-muted': '#94A3B8',
      '--app-sidebar-accent': '#60A5FA',
      '--app-sidebar-accent-ink': '#FFFFFF',

      // Legacy Tokens
      '--ink': '#F8FAFC',
      '--muted': '#94A3B8',
      '--line': '#1E293B',
      '--panel': '#0F172A',

      // Legacy Color Aliases
      '--green': '#3B82F6',
      '--lime': '#93C5FD',
      '--orange': '#FBBF24',

      // Optional Status Colors
      '--success': '#4ADE80',
      '--warning': '#FBBF24',
      '--danger': '#F87171',
      '--info': '#38BDF8'
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
    document.documentElement.style.setProperty('--app-tab-font-size', fontSize.tab)
    document.documentElement.style.setProperty('--app-tab-index-font-size', fontSize.tabIndex)
    document.documentElement.style.setProperty('--app-table-font-size', fontSize.table)
    document.documentElement.style.setProperty('--app-table-header-font-size', fontSize.tableHeader)
    document.documentElement.style.setProperty('--app-table-footer-font-size', fontSize.tableFooter)
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
