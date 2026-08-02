import app from './app.js'
import http from 'node:http'
import { env } from './config/env.js'
import { broadcastWorkspaceChange, initRealtime } from './realtime.js'

const server = http.createServer(app)
const io = initRealtime(server)
app.locals.io = io
app.locals.broadcastWorkspaceChange = broadcastWorkspaceChange

server.listen(env.port, () => {
  console.log(`backendCafm API running on http://localhost:${env.port}`)
})
