export function notFound(req, res) {
  res.status(404).json({ error: 'NotFound', message: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(error, req, res, next) {
  const status = error.status || 500
  if (status >= 500) console.error(error)
  res.status(status).json({
    error: error.name || 'ServerError',
    message: error.message || 'Unexpected server error'
  })
}
