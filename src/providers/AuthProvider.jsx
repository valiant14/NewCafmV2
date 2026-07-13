import { createContext, useContext } from 'react'

const AuthContext = createContext(null)

const defaultUser = {
  name: 'Ahmed Faisal',
  role: 'Facility Manager',
  initials: 'AF',
  permissions: ['cafm:read', 'cafm:write', 'work-orders:approve']
}

export function AuthProvider({ children, user = defaultUser }) {
  return (
    <AuthContext.Provider value={{ user, isAuthenticated: true }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
