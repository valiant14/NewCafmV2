import { createContext, useContext, useMemo, useState } from 'react'
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

export function AuthProvider({ children }) {
  const initialToken = getAuthToken()
  if (!initialToken) localStorage.removeItem(storageKey)
  const [user, setUser] = useState(() => initialToken ? safeStoredUser() : null)
  const [token, setToken] = useState(initialToken)
  const [authError, setAuthError] = useState('')

  const login = async ({ username, password }) => {
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
  }

  const logout = () => {
    setAuthToken('')
    localStorage.removeItem(storageKey)
    setToken('')
    setUser(null)
    setAuthError('')
    window.history.pushState({}, '', '/')
  }

  const value = useMemo(() => ({
    user,
    token,
    authError,
    login,
    logout,
    isAuthenticated: Boolean(user && token)
  }), [user, token, authError])

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
