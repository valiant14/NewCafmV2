import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Toast from '../components/ui/Toast'
import { emitToast, subscribeToast } from '../services/toastBus'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, tone = 'info') => {
    const normalized = message instanceof Error ? message.message : String(message || '').trim()
    if (!normalized) return
    setToast({ id: Date.now(), message: normalized, tone })
  }, [])

  useEffect(() => subscribeToast(({ message, tone }) => notify(message, tone)), [notify])
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const value = useMemo(() => ({
    notify,
    success: message => notify(message, 'success'),
    error: message => notify(message, 'error'),
    info: message => notify(message, 'info'),
    dismiss: () => setToast(null)
  }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast message={toast?.message} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    return {
      notify: emitToast,
      success: message => emitToast(message, 'success'),
      error: message => emitToast(message, 'error'),
      info: message => emitToast(message, 'info'),
      dismiss: () => {}
    }
  }
  return context
}

export const useToastError = message => {
  const { error } = useToast()
  useEffect(() => {
    if (message) error(message)
  }, [error, message])
}
