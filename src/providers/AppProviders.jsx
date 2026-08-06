import { AuthProvider } from './AuthProvider'
import { ThemeProvider } from './ThemeProvider'
import { ToastProvider } from './ToastProvider'

export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
