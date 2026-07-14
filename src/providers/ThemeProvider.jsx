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
      '--app-bg': '#F5F7FA',
      '--app-panel': '#FFFFFF',
      '--app-ink': '#1F2937',
      '--app-muted': '#6B7280',
      '--app-line': '#E5E7EB',

      // Tables
      '--app-table-bg': '#FFFFFF',
      '--app-table-header-bg': '#F8FAFC',
      '--app-table-footer-bg': '#F8FAFC',
      '--app-table-hover-bg': '#F1F5F9',
      '--app-table-text': '#374151',
      '--app-table-heading': '#6B7280',
      '--app-soft-bg': '#F8FAFC',
      '--app-soft-bg-hover': '#F1F5F9',
      '--app-field-border': '#D1D5DB',
      '--app-field-focus': '#2563EB',
      '--app-field-focus-ring': 'rgba(37, 99, 235, .14)',
      '--app-required': '#D97706',
      '--app-badge-neutral-bg': '#F3F4F6',
      '--app-badge-neutral-text': '#4B5563',
      '--app-badge-green-bg': '#DCFCE7',
      '--app-badge-green-text': '#166534',
      '--app-badge-orange-bg': '#FFEDD5',
      '--app-badge-orange-text': '#9A3412',
      '--app-badge-blue-bg': '#DBEAFE',
      '--app-badge-blue-text': '#1D4ED8',
      '--app-badge-purple-bg': '#EDE9FE',
      '--app-badge-purple-text': '#6D28D9',

      // Brand
      '--app-primary': '#2563EB',
      '--app-primary-hover': '#1D4ED8',
      '--app-accent': '#60A5FA',

      // Sidebar
      '--app-sidebar-bg': '#1F2937',
      '--app-sidebar-panel': '#273549',
      '--app-sidebar-hover': '#374151',
      '--app-sidebar-active': '#2563EB',
      '--app-sidebar-text': '#F9FAFB',
      '--app-sidebar-muted': '#9CA3AF',
      '--app-sidebar-accent': '#93C5FD',
      '--app-sidebar-accent-ink': '#111827',

      // Legacy
      '--ink': '#1F2937',
      '--muted': '#6B7280',
      '--line': '#E5E7EB',
      '--panel': '#FFFFFF',

      '--green': '#2563EB',
      '--lime': '#93C5FD',
      '--orange': '#F59E0B',

      // Status
      '--success': '#16A34A',
      '--warning': '#D97706',
      '--danger': '#DC2626',
      '--info': '#0284C7'
    }
  },

  dark: {
    name: 'dark',
    tokens: {
      // Base
      '--app-bg': '#111827',
      '--app-panel': '#1F2937',
      '--app-ink': '#F9FAFB',
      '--app-muted': '#9CA3AF',
      '--app-line': '#374151',

      // Tables
      '--app-table-bg': '#1F2937',
      '--app-table-header-bg': '#273549',
      '--app-table-footer-bg': '#273549',
      '--app-table-hover-bg': '#374151',
      '--app-table-text': '#E5E7EB',
      '--app-table-heading': '#9CA3AF',
      '--app-soft-bg': '#273549',
      '--app-soft-bg-hover': '#374151',
      '--app-field-border': '#4B5563',
      '--app-field-focus': '#60A5FA',
      '--app-field-focus-ring': 'rgba(96, 165, 250, .18)',
      '--app-required': '#FBBF24',
      '--app-badge-neutral-bg': '#374151',
      '--app-badge-neutral-text': '#D1D5DB',
      '--app-badge-green-bg': '#14532D',
      '--app-badge-green-text': '#BBF7D0',
      '--app-badge-orange-bg': '#7C2D12',
      '--app-badge-orange-text': '#FED7AA',
      '--app-badge-blue-bg': '#1E3A8A',
      '--app-badge-blue-text': '#BFDBFE',
      '--app-badge-purple-bg': '#4C1D95',
      '--app-badge-purple-text': '#DDD6FE',

      // Brand
      '--app-primary': '#60A5FA',
      '--app-primary-hover': '#3B82F6',
      '--app-accent': '#93C5FD',

      // Sidebar
      '--app-sidebar-bg': '#0F172A',
      '--app-sidebar-panel': '#1E293B',
      '--app-sidebar-hover': '#334155',
      '--app-sidebar-active': '#3B82F6',
      '--app-sidebar-text': '#F9FAFB',
      '--app-sidebar-muted': '#94A3B8',
      '--app-sidebar-accent': '#60A5FA',
      '--app-sidebar-accent-ink': '#FFFFFF',

      // Legacy
      '--ink': '#F9FAFB',
      '--muted': '#9CA3AF',
      '--line': '#374151',
      '--panel': '#1F2937',

      '--green': '#60A5FA',
      '--lime': '#93C5FD',
      '--orange': '#FBBF24',

      // Status
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
