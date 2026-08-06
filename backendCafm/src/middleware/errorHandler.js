import { env } from '../config/env.js'

export function notFound(req, res) {
  res.status(404).json({ error: 'NotFound', message: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(error, req, res, next) {
  const status = error.status || 500
  if (status >= 500) console.error(error)
  const hideDetails = status >= 500 && env.nodeEnv === 'production'
  res.status(status).json({
    error: hideDetails ? 'ServerError' : error.name || 'ServerError',
    message: hideDetails ? 'Unexpected server error' : error.message || 'Unexpected server error'
  })
}
