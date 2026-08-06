const listeners = new Set()

const normalizeMessage = message => {
  if (message instanceof Error) return message.message
  return String(message || '').trim()
}

export const emitToast = (message, tone = 'info') => {
  const normalized = normalizeMessage(message)
  if (!normalized) return
  listeners.forEach(listener => listener({ message: normalized, tone }))
}

export const subscribeToast = listener => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
