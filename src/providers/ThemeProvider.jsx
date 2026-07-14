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
      // Base — soft neutral with a subtle blue undertone
      '--app-bg': '#F5F7FA',
      '--app-panel': '#FFFFFF',
      '--app-ink': '#172033',
      '--app-muted': '#667085',
      '--app-line': '#E2E7EE',

      // Soft surfaces
      '--app-soft-bg': '#F8FAFC',
      '--app-soft-bg-hover': '#F0F4F8',

      // Tables
      '--app-table-bg': '#FFFFFF',
      '--app-table-header-bg': '#F7F9FC',
      '--app-table-footer-bg': '#F7F9FC',
      '--app-table-hover-bg': '#F0F5FA',
      '--app-table-selected-bg': '#E8F1FA',
      '--app-table-text': '#344054',
      '--app-table-heading': '#5D6B82',
      '--app-table-border': '#E2E7EE',

      // Brand — restrained mineral blue
      '--app-primary': '#185A8D',
      '--app-primary-hover': '#124A76',
      '--app-primary-active': '#0E3D63',
      '--app-primary-soft': '#E3F0F8',
      '--app-primary-soft-hover': '#D6E9F5',
      '--app-primary-ink': '#FFFFFF',
      '--app-accent': '#58A6CF',

      // Forms
      '--app-field-bg': '#FFFFFF',
      '--app-field-text': '#172033',
      '--app-field-placeholder': '#98A2B3',
      '--app-field-border': '#C9D2DE',
      '--app-field-border-hover': '#98A8BB',
      '--app-field-focus': '#2377A9',
      '--app-field-focus-ring': 'rgba(35, 119, 169, 0.16)',
      '--app-field-disabled-bg': '#F2F4F7',
      '--app-field-disabled-text': '#98A2B3',
      '--app-required': '#B45309',

      // Sidebar — deep navy, not purple
      '--app-sidebar-bg': '#15243A',
      '--app-sidebar-panel': '#1B2D47',
      '--app-sidebar-hover': '#243A57',
      '--app-sidebar-active': '#2377A9',
      '--app-sidebar-active-soft': '#1D4F73',
      '--app-sidebar-text': '#F7FAFC',
      '--app-sidebar-muted': '#AAB8CA',
      '--app-sidebar-line': '#2A405E',
      '--app-sidebar-accent': '#72B7D8',
      '--app-sidebar-accent-ink': '#10263A',

      // Neutral badge
      '--app-badge-neutral-bg': '#EEF1F5',
      '--app-badge-neutral-text': '#475467',

      // Success badge
      '--app-badge-green-bg': '#E5F5EC',
      '--app-badge-green-text': '#24704A',

      // Warning badge
      '--app-badge-orange-bg': '#FFF1DC',
      '--app-badge-orange-text': '#9A5411',

      // Information badge
      '--app-badge-blue-bg': '#E3F0F8',
      '--app-badge-blue-text': '#185A8D',

      // Secondary badge
      '--app-badge-purple-bg': '#ECECF6',
      '--app-badge-purple-text': '#50547A',

      // Status
      '--success': '#2E7D55',
      '--success-soft': '#E5F5EC',
      '--warning': '#B86A16',
      '--warning-soft': '#FFF1DC',
      '--danger': '#C33D4A',
      '--danger-soft': '#FBEAEC',
      '--info': '#2377A9',
      '--info-soft': '#E3F0F8',

      // Legacy compatibility
      '--ink': '#172033',
      '--muted': '#667085',
      '--line': '#E2E7EE',
      '--panel': '#FFFFFF',

      '--green': '#185A8D',
      '--lime': '#72B7D8',
      '--orange': '#B86A16'
    }
  },

  dark: {
    name: 'dark',
    tokens: {
      // Base — neutral charcoal navy
      '--app-bg': '#0E1622',
      '--app-panel': '#15202F',
      '--app-ink': '#EDF2F7',
      '--app-muted': '#9DAABD',
      '--app-line': '#29384B',

      // Soft surfaces
      '--app-soft-bg': '#192638',
      '--app-soft-bg-hover': '#213147',

      // Tables
      '--app-table-bg': '#15202F',
      '--app-table-header-bg': '#192638',
      '--app-table-footer-bg': '#192638',
      '--app-table-hover-bg': '#1E2E42',
      '--app-table-selected-bg': '#193B55',
      '--app-table-text': '#D4DCE7',
      '--app-table-heading': '#9DAABD',
      '--app-table-border': '#29384B',

      // Brand — brighter only where interaction requires it
      '--app-primary': '#5AA9D1',
      '--app-primary-hover': '#72B7D8',
      '--app-primary-active': '#86C3DF',
      '--app-primary-soft': '#193B55',
      '--app-primary-soft-hover': '#204A68',
      '--app-primary-ink': '#0B1A26',
      '--app-accent': '#86C3DF',

      // Forms
      '--app-field-bg': '#111C2A',
      '--app-field-text': '#EDF2F7',
      '--app-field-placeholder': '#758398',
      '--app-field-border': '#34465C',
      '--app-field-border-hover': '#536981',
      '--app-field-focus': '#72B7D8',
      '--app-field-focus-ring': 'rgba(114, 183, 216, 0.20)',
      '--app-field-disabled-bg': '#192432',
      '--app-field-disabled-text': '#758398',
      '--app-required': '#F0B35A',

      // Sidebar
      '--app-sidebar-bg': '#0B1420',
      '--app-sidebar-panel': '#111E2E',
      '--app-sidebar-hover': '#1B2C41',
      '--app-sidebar-active': '#276F9B',
      '--app-sidebar-active-soft': '#193B55',
      '--app-sidebar-text': '#F5F8FC',
      '--app-sidebar-muted': '#94A4B8',
      '--app-sidebar-line': '#26384D',
      '--app-sidebar-accent': '#72B7D8',
      '--app-sidebar-accent-ink': '#091722',

      // Neutral badge
      '--app-badge-neutral-bg': '#293545',
      '--app-badge-neutral-text': '#D1D9E4',

      // Success badge
      '--app-badge-green-bg': '#173D2C',
      '--app-badge-green-text': '#93D7B1',

      // Warning badge
      '--app-badge-orange-bg': '#4B3218',
      '--app-badge-orange-text': '#F2C47B',

      // Information badge
      '--app-badge-blue-bg': '#193B55',
      '--app-badge-blue-text': '#9DD5EE',

      // Secondary badge
      '--app-badge-purple-bg': '#303149',
      '--app-badge-purple-text': '#C9CAE5',

      // Status
      '--success': '#6FC394',
      '--success-soft': '#173D2C',
      '--warning': '#E5AD58',
      '--warning-soft': '#4B3218',
      '--danger': '#E77C86',
      '--danger-soft': '#4A252B',
      '--info': '#72B7D8',
      '--info-soft': '#193B55',

      // Legacy compatibility
      '--ink': '#EDF2F7',
      '--muted': '#9DAABD',
      '--line': '#29384B',
      '--panel': '#15202F',

      '--green': '#5AA9D1',
      '--lime': '#86C3DF',
      '--orange': '#E5AD58'
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
