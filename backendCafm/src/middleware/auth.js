import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' })

  try {
    req.user = jwt.verify(token, env.jwtSecret)
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' })
  }
}

export const requirePermission = (moduleName, action = 'view') => (req, res, next) => {
  const permissions = req.user?.permissions?.[action] || []
  if (permissions.includes(moduleName)) return next()
  res.status(403).json({ error: 'Forbidden', message: `Missing ${action} permission for ${moduleName}` })
}
