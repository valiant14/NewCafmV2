import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from './config/env.js'

let io

export const initRealtime = server => {
  io = new Server(server, {
    serveClient: false,
    maxHttpBufferSize: env.socketMaxBufferBytes,
    perMessageDeflate: false,
    pingInterval: 25000,
    pingTimeout: 20000,
    cors: {
      origin: env.corsOrigin,
      credentials: true
    }
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || ''
    if (!token) return next(new Error('Missing bearer token'))

    try {
      socket.user = jwt.verify(token, env.jwtSecret)
      next()
    } catch {
      next(new Error('Invalid or expired token'))
    }
  })

  io.on('connection', socket => {
    socket.join(`user:${socket.user?.userId || socket.id}`)
    const modules = new Set(Object.values(socket.user?.permissions || {}).flat().filter(Boolean))
    modules.forEach(moduleName => socket.join(`module:${moduleName}`))
    ;(socket.user?.siteCodes || []).forEach(siteCode => socket.join(`site:${siteCode}`))
    ;(socket.user?.departments || []).forEach(department => socket.join(`department:${department}`))

    socket.emit('workspace:connected', {
      socketId: socket.id,
      userId: socket.user?.userId
    })
  })

  return io
}

export const broadcastWorkspaceChange = change => {
  if (!io) return
  const payload = {
    at: new Date().toISOString(),
    ...change
  }
  const moduleNames = [change?.moduleName, ...(change?.relatedModules || [])]
    .map(value => String(value || '').trim())
    .filter(Boolean)
  if (moduleNames.length) io.to(moduleNames.map(moduleName => `module:${moduleName}`)).emit('workspace:changed', payload)
  else io.emit('workspace:changed', payload)
}

export const getRealtimeStats = () => ({
  enabled: Boolean(io),
  connectedSockets: io?.engine?.clientsCount || 0
})

export const closeRealtime = async () => {
  if (!io) return
  const active = io
  io = undefined
  await new Promise(resolve => active.close(resolve))
}
