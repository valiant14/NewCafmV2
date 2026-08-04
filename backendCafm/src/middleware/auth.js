import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getPool } from '../db/pool.js'

const permissionCache = new Map()
const permissionKey = (userId, moduleName, action) => `${userId}\u0000${moduleName}\u0000${action}`

const cachedPermission = key => {
  const entry = permissionCache.get(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    permissionCache.delete(key)
    return undefined
  }
  return entry.allowed
}

const cachePermission = (key, allowed) => {
  if (!env.permissionCacheTtlMs) return
  permissionCache.delete(key)
  permissionCache.set(key, { allowed, expiresAt: Date.now() + env.permissionCacheTtlMs })
  while (permissionCache.size > env.permissionCacheMaxEntries) {
    permissionCache.delete(permissionCache.keys().next().value)
  }
}

export const clearPermissionCache = userId => {
  if (!userId) return permissionCache.clear()
  const prefix = `${userId}\u0000`
  for (const key of permissionCache.keys()) {
    if (key.startsWith(prefix)) permissionCache.delete(key)
  }
}

export const getPermissionCacheStats = () => ({
  entries: permissionCache.size,
  maxEntries: env.permissionCacheMaxEntries,
  ttlMs: env.permissionCacheTtlMs
})

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
    const userId = req.user?.userId || ''
    const key = permissionKey(userId, moduleName, action)
    const cached = cachedPermission(key)
    if (cached === true) return next()
    if (cached === false) return res.status(403).json({ error: 'Forbidden', message: `Missing ${action} permission for ${moduleName}` })

    const pool = await getPool()
    const result = await pool.request()
      .input('userId', userId)
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
    const allowed = Boolean(result.recordset[0])
    cachePermission(key, allowed)
    if (allowed) return next()
    res.status(403).json({ error: 'Forbidden', message: `Missing ${action} permission for ${moduleName}` })
  } catch (error) {
    next(error)
  }
}
