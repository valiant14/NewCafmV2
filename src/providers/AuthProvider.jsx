import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { api, getAuthToken, setAuthToken } from '../services/api'

const AuthContext = createContext(null)
const storageKey = 'seder-cafm-auth-user'

const safeStoredUser = () => {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}
const sameSessionValue = (left, right) => {
  if (Object.is(left, right)) return true
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right)
  }
  return false
}

export function AuthProvider({ children }) {
  const initialToken = getAuthToken()
  if (!initialToken) localStorage.removeItem(storageKey)
  const [user, setUser] = useState(() => initialToken ? safeStoredUser() : null)
  const [token, setToken] = useState(initialToken)
  const [authError, setAuthError] = useState('')

  // An administrator editing the signed-in user's scope has to reach the live session -
  // otherwise site, department and permissions stay on the snapshot taken at login and the
  // only way to pick them up is a logout. Written through to storage so a refresh keeps them.
  const applySessionUpdate = useCallback(patch => {
    if (!patch || !Object.keys(patch).length) return
    setUser(current => {
      if (!current) return current
      // Nothing changed - bail before setting state, or this loops against the effect
      // in App that feeds it.
      const changed = Object.keys(patch).some(key => !sameSessionValue(current[key], patch[key]))
      if (!changed) return current
      const next = { ...current, ...patch }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }, [])

  const login = useCallback(async ({ username, password }) => {
    try {
      const result = await api.login({ username: username?.trim(), password })
      const sessionUser = {
        ...result.user,
        initials: String(result.user?.name || result.user?.username || '').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
      }
      setAuthToken(result.token)
      localStorage.setItem(storageKey, JSON.stringify(sessionUser))
      setToken(result.token)
      setUser(sessionUser)
      setAuthError('')
      return true
    } catch (error) {
      setAuthError(error.message || 'Invalid username or password.')
      return false
    }
  }, [])

  const refreshSession = useCallback(async () => {
    if (!getAuthToken()) return null
    const result = await api.me()
    const sessionUser = {
      ...result.user,
      initials: String(result.user?.name || result.user?.username || '').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
    }
    localStorage.setItem(storageKey, JSON.stringify(sessionUser))
    setUser(sessionUser)
    return sessionUser
  }, [])

  const logout = useCallback(() => {
    setAuthToken('')
    localStorage.removeItem(storageKey)
    setToken('')
    setUser(null)
    setAuthError('')
    window.history.pushState({}, '', '/')
  }, [])

  const value = useMemo(() => ({
    user,
    token,
    authError,
    login,
    logout,
    refreshSession,
    applySessionUpdate,
    isAuthenticated: Boolean(user && token)
  }), [user, token, authError, login, logout, refreshSession, applySessionUpdate])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
