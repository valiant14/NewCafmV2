import { io } from 'socket.io-client'
import { getAuthToken } from './api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/?$/, '')

export const subscribeWorkspaceChanges = onChange => {
  const token = getAuthToken()
  if (!token) return () => {}

  const socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling']
  })

  socket.on('workspace:changed', change => onChange?.(change))

  return () => {
    socket.off('workspace:changed')
    socket.disconnect()
  }
}
