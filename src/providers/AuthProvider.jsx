import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const storageKey = 'seder-cafm-auth-user'

export const demoUsers = [
  {
    username: 'demo',
    password: '1234',
    name: 'Ahmed Faisal',
    role: 'Facility Manager',
    department: 'Facilities',
    site: 'All Sites',
    initials: 'AF',
    permissions: ['cafm:read', 'cafm:write', 'work-orders:approve', 'admin:permissions']
  }
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
