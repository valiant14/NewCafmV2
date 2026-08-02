import { AuthProvider } from './AuthProvider'
import { ThemeProvider } from './ThemeProvider'

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </AuthProvider>
  )
}
