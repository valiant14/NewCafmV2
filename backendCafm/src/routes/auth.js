import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getPool } from '../db/pool.js'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
const isActive = value => String(value || '').trim().toLowerCase() === 'active'

const sessionPayloadForAccount = async (pool, account) => {
  const result = await pool.request()
    .input('userId', account.user_id)
    .query(`
      select u.user_id, u.username, u.password_hash, u.display_name, u.email, u.status, r.role_id, r.role_code, r.role_name
      from dbo.users u
      left join dbo.roles r on r.role_id = u.role_id
      where u.user_id = @userId
    `)
  const liveAccount = result.recordset[0]
  if (!liveAccount || !isActive(liveAccount.status) || !liveAccount.role_id) return null

  const permissionRows = await pool.request()
    .input('roleId', liveAccount.role_id)
    .query(`
      select module_name, action_name
      from dbo.role_permissions
      where role_id = @roleId and allowed = 1
    `)

  const permissions = permissionRows.recordset.reduce((map, row) => {
    map[row.action_name] = [...(map[row.action_name] || []), row.module_name]
    return map
  }, {})

  const siteRows = await pool.request()
    .input('userId', liveAccount.user_id)
    .query('select site_code from dbo.user_site_access where user_id = @userId')
  const departmentRows = await pool.request()
    .input('userId', liveAccount.user_id)
    .query('select department_name, sub_department_code from dbo.user_department_access where user_id = @userId')
  const siteCodes = siteRows.recordset.map(row => row.site_code)
  const departments = [...new Set(departmentRows.recordset.flatMap(row => [row.department_name, row.sub_department_code]).filter(Boolean))]

  return {
    userId: liveAccount.user_id,
    username: liveAccount.username,
    name: liveAccount.display_name,
    email: liveAccount.email,
    role: liveAccount.role_name,
    roleCode: liveAccount.role_code,
    permissions,
    siteCodes,
    departments,
    site: siteCodes.length ? siteCodes.join(', ') : 'All Sites',
    siteScope: siteCodes.length ? siteCodes.join(', ') : 'All Sites',
    department: departments.length ? departments.join(', ') : 'All Departments',
    departmentScope: departments.length ? departments.join(', ') : 'All Departments'
  }
}

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'BadRequest', message: 'Username and password are required' })

  const pool = await getPool()
  const result = await pool.request()
    .input('username', username)
    .query(`
      select u.user_id, u.username, u.password_hash, u.display_name, u.email, u.status, r.role_id
      from dbo.users u
      left join dbo.roles r on r.role_id = u.role_id
      where lower(ltrim(rtrim(u.username))) = lower(ltrim(rtrim(@username)))
    `)
  const account = result.recordset[0]
  if (!account) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' })
  if (!isActive(account.status)) return res.status(401).json({ error: 'Unauthorized', message: 'User account is inactive' })
  if (!account.role_id) return res.status(401).json({ error: 'Unauthorized', message: 'User account has no role' })

  const ok = await bcrypt.compare(password, account.password_hash)
  if (!ok) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' })

  const tokenPayload = await sessionPayloadForAccount(pool, account)
  if (!tokenPayload) return res.status(401).json({ error: 'Unauthorized', message: 'User account has no active role' })

  const token = jwt.sign(tokenPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
  res.json({ token, user: tokenPayload })
}))

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const pool = await getPool()
  const user = await sessionPayloadForAccount(pool, { user_id: req.user?.userId })
  if (!user) return res.status(401).json({ error: 'Unauthorized', message: 'User account is inactive or missing an active role' })
  res.json({ user })
}))

export default router
