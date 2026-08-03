import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getPool } from '../db/pool.js'

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

export const requirePermission = (moduleName, action = 'view') => async (req, res, next) => {
  try {
    const pool = await getPool()
    const result = await pool.request()
      .input('userId', req.user?.userId || '')
      .input('moduleName', moduleName)
      .input('actionName', action)
      .query(`
        select top 1 p.module_name, p.action_name
        from dbo.users u
        join dbo.roles r on r.role_id = u.role_id
        join dbo.role_permissions p on p.role_id = r.role_id and p.allowed = 1
        where u.user_id = @userId
          and u.status = 'Active'
          and r.status = 'Active'
          and p.module_name = @moduleName
          and p.action_name = @actionName
      `)
    if (result.recordset[0]) return next()
    res.status(403).json({ error: 'Forbidden', message: `Missing ${action} permission for ${moduleName}` })
  } catch (error) {
    next(error)
  }
}
