import { AuthProvider } from './AuthProvider'
import { CafmDataProvider } from './CafmDataProvider'
import { ThemeProvider } from './ThemeProvider'

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CafmDataProvider>
          {children}
        </CafmDataProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
