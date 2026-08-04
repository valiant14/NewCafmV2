import app from './app.js'
import http from 'node:http'
import { env } from './config/env.js'
import { broadcastWorkspaceChange, closeRealtime, initRealtime } from './realtime.js'
import { startPmScheduler, stopPmScheduler } from './services/pmScheduler.js'
import { closePool } from './db/pool.js'
import { stopRuntimeMetrics } from './services/runtimeMetrics.js'

const server = http.createServer(app)
const io = initRealtime(server)
app.locals.io = io
app.locals.broadcastWorkspaceChange = broadcastWorkspaceChange
server.keepAliveTimeout = env.serverKeepAliveTimeoutMs
server.headersTimeout = Math.max(env.serverHeadersTimeoutMs, server.keepAliveTimeout + 1000)
server.requestTimeout = env.serverRequestTimeoutMs
server.maxRequestsPerSocket = 1000

server.listen(env.port, () => {
  console.log(`backendCafm API running on http://localhost:${env.port}`)
  console.log('Socket.IO realtime enabled at /socket.io')
  startPmScheduler()
})

let shuttingDown = false
const shutdown = async signal => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received. Closing backendCafm cleanly.`)
  stopPmScheduler()
  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out.')
    process.exit(1)
  }, env.shutdownTimeoutMs)
  forceExit.unref()

  try {
    await closeRealtime()
    await new Promise(resolve => server.close(() => resolve()))
    await closePool()
    stopRuntimeMetrics()
    clearTimeout(forceExit)
    process.exit(0)
  } catch (error) {
    console.error('Graceful shutdown failed:', error)
    process.exit(1)
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error))
