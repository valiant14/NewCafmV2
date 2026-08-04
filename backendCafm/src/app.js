import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import routes from './routes/index.js'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { requestMetrics } from './services/runtimeMetrics.js'

const app = express()

app.set('etag', 'weak')
app.use(helmet())
app.use(cors({
  origin: env.corsOrigin,
  credentials: true,
  exposedHeaders: ['ETag', 'X-Page-Size', 'X-Page-Offset', 'X-Total-Count', 'Accept-Ranges']
}))
app.use((req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'private, max-age=0, must-revalidate')
  next()
})
app.use(express.json({ limit: env.jsonBodyLimit }))
app.use(requestMetrics)
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', {
  skip: req => req.path === '/api/health'
}))

app.use('/api', routes)
app.use(notFound)
app.use(errorHandler)

export default app
