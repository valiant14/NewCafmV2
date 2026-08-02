import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from './config/env.js'

let io

export const initRealtime = server => {
  io = new Server(server, {
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
    socket.emit('workspace:connected', {
      socketId: socket.id,
      userId: socket.user?.userId
    })
  })

  return io
}

export const broadcastWorkspaceChange = change => {
  if (!io) return
  io.emit('workspace:changed', {
    at: new Date().toISOString(),
    ...change
  })
}
