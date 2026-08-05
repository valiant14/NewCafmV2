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
  const same = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase()
  for (const socket of io.sockets.sockets.values()) {
    const isTargetUser = change?.targetUserId && same(change.targetUserId, socket.user?.userId)
    if (!isTargetUser && !change?.securityContextChanged && moduleNames.length && !moduleNames.some(moduleName => socket.rooms.has(`module:${moduleName}`))) continue
    const dataScope = String(socket.user?.dataScope || 'DEPARTMENT').toUpperCase()
    if (dataScope !== 'GLOBAL') {
      if (change?.siteCode && !(socket.user?.siteCodes || []).some(site => same(site, change.siteCode))) continue
      if (change?.department && !(socket.user?.departments || []).some(department => same(department, change.department))) continue
      if (dataScope === 'OWN' && change?.ownerUserId && !same(change.ownerUserId, socket.user?.userId)) continue
    }
    socket.emit('workspace:changed', payload)
  }
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
