import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getPool } from '../db/pool.js'
import { normalizeDataScope } from './scope.js'

const permissionCache = new Map()
const accessContextCache = new Map()
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

export const clearAccessContextCache = userId => {
  if (!userId) return accessContextCache.clear()
  accessContextCache.delete(String(userId))
}

const liveAccessContext = async userId => {
  const key = String(userId || '')
  const cached = accessContextCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  if (cached) accessContextCache.delete(key)

  const pool = await getPool()
  const result = await pool.request()
    .input('userId', key)
    .query(`
      select u.user_id, u.username, u.display_name, u.email, u.labor_id, u.status,
        u.data_scope_override, r.role_code, r.role_name, r.status as role_status, r.data_scope as role_data_scope
      from dbo.users u
      join dbo.roles r on r.role_id = u.role_id
      where u.user_id = @userId;

      select site_code
      from dbo.user_site_access
      where user_id = @userId;

      select department_name, sub_department_code
      from dbo.user_department_access
      where user_id = @userId;
    `)
  const account = result.recordsets[0]?.[0]
  if (!account || String(account.status).toLowerCase() !== 'active' || String(account.role_status).toLowerCase() !== 'active') return null

  const siteCodes = (result.recordsets[1] || []).map(row => row.site_code).filter(Boolean)
  const departmentNames = [...new Set((result.recordsets[2] || []).map(row => row.department_name).filter(Boolean))]
  const subDepartmentCodes = [...new Set((result.recordsets[2] || []).map(row => row.sub_department_code).filter(Boolean))]
  const override = String(account.data_scope_override || 'ROLE').toUpperCase()
  const value = {
    userId: account.user_id,
    username: account.username,
    name: account.display_name,
    email: account.email,
    laborId: account.labor_id,
    role: account.role_name,
    roleCode: account.role_code,
    dataScopeOverride: override,
    dataScope: normalizeDataScope(override === 'ROLE' ? account.role_data_scope : override),
    siteCodes,
    departmentNames,
    subDepartmentCodes,
    departments: [...new Set([...departmentNames, ...subDepartmentCodes])]
  }
  if (env.permissionCacheTtlMs) {
    accessContextCache.set(key, { value, expiresAt: Date.now() + env.permissionCacheTtlMs })
    while (accessContextCache.size > env.permissionCacheMaxEntries) {
      accessContextCache.delete(accessContextCache.keys().next().value)
    }
  }
  return value
}

export const getPermissionCacheStats = () => ({
  entries: permissionCache.size,
  maxEntries: env.permissionCacheMaxEntries,
  ttlMs: env.permissionCacheTtlMs,
  accessContexts: accessContextCache.size
})

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' })

  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    const live = await liveAccessContext(decoded.userId)
    if (!live) return res.status(401).json({ error: 'Unauthorized', message: 'User account or role is inactive' })
    req.user = { ...decoded, ...live }
    next()
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' })
    }
    next(error)
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
