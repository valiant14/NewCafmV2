import { io } from 'socket.io-client'
import { getAuthToken } from './api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (API_BASE_URL.startsWith('http')
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : window.location.origin)

export const subscribeWorkspaceChanges = onChange => {
  const token = getAuthToken()
  if (!token) return () => {}

  const socket = io(SOCKET_URL, {
    auth: { token },
    path: '/socket.io',
    transports: ['websocket', 'polling']
  })

  socket.on('workspace:changed', change => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cafm:workspace-change', { detail: change }))
    onChange?.(change)
  })

  return () => {
    socket.off('workspace:changed')
    socket.disconnect()
  }
}
