import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import routes from './routes/index.js'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()

app.disable('etag')
app.use(helmet())
app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

app.use('/api', routes)
app.use(notFound)
app.use(errorHandler)

export default app
