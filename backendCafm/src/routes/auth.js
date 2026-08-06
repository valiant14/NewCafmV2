import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getPool } from '../db/pool.js'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/auth.js'
import { normalizeDataScope } from '../middleware/scope.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
const isActive = value => String(value || '').trim().toLowerCase() === 'active'
const loginAttempts = new Map()
let lastLoginAttemptPrune = 0

const loginAttemptKey = req => `${req.ip || req.socket?.remoteAddress || 'unknown'}\u0000${String(req.body?.username || '').trim().toLowerCase()}`

const pruneLoginAttempts = now => {
  if (now - lastLoginAttemptPrune < 60000 && loginAttempts.size <= env.authLoginMaxKeys) return
  lastLoginAttemptPrune = now
  for (const [key, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(key)
  }
  while (loginAttempts.size > env.authLoginMaxKeys) loginAttempts.delete(loginAttempts.keys().next().value)
}

const rateLimitLogin = (req, res, next) => {
  const now = Date.now()
  pruneLoginAttempts(now)
  const key = loginAttemptKey(req)
  const attempt = loginAttempts.get(key)
  if (attempt && attempt.resetAt > now && attempt.count >= env.authLoginMaxAttempts) {
    const retryAfter = Math.max(1, Math.ceil((attempt.resetAt - now) / 1000))
    res.set('Retry-After', String(retryAfter))
    return res.status(429).json({ error: 'TooManyRequests', message: 'Too many login attempts. Try again later.' })
  }
  req.loginAttemptKey = key
  next()
}

const recordLoginFailure = req => {
  const now = Date.now()
  const key = req.loginAttemptKey || loginAttemptKey(req)
  const current = loginAttempts.get(key)
  const attempt = current && current.resetAt > now
    ? { count: current.count + 1, resetAt: current.resetAt }
    : { count: 1, resetAt: now + env.authLoginWindowMs }
  loginAttempts.delete(key)
  loginAttempts.set(key, attempt)
  pruneLoginAttempts(now)
}

const rejectLogin = (req, res, message = 'Invalid credentials') => {
  recordLoginFailure(req)
  return res.status(401).json({ error: 'Unauthorized', message })
}

const sessionPayloadForAccount = async (pool, account) => {
  const result = await pool.request()
    .input('userId', account.user_id)
    .query(`
      select u.user_id, u.username, u.password_hash, u.display_name, u.email, u.labor_id, u.status,
        u.data_scope_override, r.role_id, r.role_code, r.role_name, r.data_scope as role_data_scope
      from dbo.users u
      left join dbo.roles r on r.role_id = u.role_id
      where u.user_id = @userId;

      select p.module_name, p.action_name
      from dbo.role_permissions p
      join dbo.users u on u.role_id = p.role_id
      where u.user_id = @userId and p.allowed = 1;

      select site_code
      from dbo.user_site_access
      where user_id = @userId;

      select department_name, sub_department_code
      from dbo.user_department_access
      where user_id = @userId;
    `)
  const liveAccount = result.recordsets[0]?.[0]
  if (!liveAccount || !isActive(liveAccount.status) || !liveAccount.role_id) return null

  const permissions = (result.recordsets[1] || []).reduce((map, row) => {
    map[row.action_name] = [...(map[row.action_name] || []), row.module_name]
    return map
  }, {})

  const siteCodes = (result.recordsets[2] || []).map(row => row.site_code)
  const departmentNames = [...new Set((result.recordsets[3] || []).map(row => row.department_name).filter(Boolean))]
  const subDepartmentCodes = [...new Set((result.recordsets[3] || []).map(row => row.sub_department_code).filter(Boolean))]
  const departments = [...new Set([...departmentNames, ...subDepartmentCodes])]
  const dataScopeOverride = String(liveAccount.data_scope_override || 'ROLE').toUpperCase()

  return {
    userId: liveAccount.user_id,
    username: liveAccount.username,
    name: liveAccount.display_name,
    email: liveAccount.email,
    laborId: liveAccount.labor_id,
    role: liveAccount.role_name,
    roleCode: liveAccount.role_code,
    dataScopeOverride,
    dataScope: normalizeDataScope(dataScopeOverride === 'ROLE' ? liveAccount.role_data_scope : dataScopeOverride),
    permissions,
    siteCodes,
    departmentNames,
    subDepartmentCodes,
    departments,
    site: siteCodes.length ? siteCodes.join(', ') : 'All Sites',
    siteScope: siteCodes.length ? siteCodes.join(', ') : 'All Sites',
    department: departments.length ? departments.join(', ') : 'All Departments',
    departmentScope: departments.length ? departments.join(', ') : 'All Departments'
  }
}

router.post('/login', rateLimitLogin, asyncHandler(async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'BadRequest', message: 'Username and password are required' })

  const pool = await getPool()
  const result = await pool.request()
    .input('username', username)
    .query(`
      select u.user_id, u.username, u.password_hash, u.display_name, u.email, u.status, r.role_id
      from dbo.users u
      left join dbo.roles r on r.role_id = u.role_id
      where u.username = ltrim(rtrim(@username))
    `)
  const account = result.recordset[0]
  if (!account) return rejectLogin(req, res)
  if (!isActive(account.status)) return rejectLogin(req, res, 'User account is inactive')
  if (!account.role_id) return rejectLogin(req, res, 'User account has no role')

  const ok = await bcrypt.compare(password, account.password_hash)
  if (!ok) return rejectLogin(req, res)

  const tokenPayload = await sessionPayloadForAccount(pool, account)
  if (!tokenPayload) return rejectLogin(req, res, 'User account has no active role')

  const token = jwt.sign(tokenPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
  loginAttempts.delete(req.loginAttemptKey)
  res.json({ token, user: tokenPayload })
}))

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const pool = await getPool()
  const user = await sessionPayloadForAccount(pool, { user_id: req.user?.userId })
  if (!user) return res.status(401).json({ error: 'Unauthorized', message: 'User account is inactive or missing an active role' })
  res.json({ user })
}))

export default router
