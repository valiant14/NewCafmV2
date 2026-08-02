import { createContext, useContext, useMemo, useState } from 'react'
import { rolePermissionRows, users as userAccounts } from '../data/workspaceData'

const AuthContext = createContext(null)
const storageKey = 'seder-cafm-auth-user'

export const demoUsers = [
  ...userAccounts.map(account => {
    const role = rolePermissionRows.find(row => row.role === account.role)
    return {
      ...account,
      initials: account.name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
      permissions: role?.permissions || {}
    }
  })
]

const safeStoredUser = () => {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(safeStoredUser)
  const [authError, setAuthError] = useState('')

  const login = ({ username, password }) => {
    const match = demoUsers.find(account => account.username === username?.trim() && account.password === password)
    if (!match) {
      setAuthError('Invalid username or password. Use demo / 1234.')
      return false
    }

    const { password: _password, ...sessionUser } = match
    localStorage.setItem(storageKey, JSON.stringify(sessionUser))
    setUser(sessionUser)
    setAuthError('')
    return true
  }

  const logout = () => {
    localStorage.removeItem(storageKey)
    setUser(null)
    setAuthError('')
    window.history.pushState({}, '', '/')
  }

  const value = useMemo(() => ({
    user,
    authError,
    login,
    logout,
    isAuthenticated: Boolean(user),
    demoCredentials: { username: 'demo', password: '1234' }
  }), [user, authError])

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
