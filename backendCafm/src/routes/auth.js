import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getPool } from '../db/pool.js'
import { env } from '../config/env.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'BadRequest', message: 'Username and password are required' })

  const pool = await getPool()
  const result = await pool.request()
    .input('username', username)
    .query(`
      select u.user_id, u.username, u.password_hash, u.display_name, u.email, u.status, r.role_id, r.role_code, r.role_name
      from dbo.users u
      join dbo.roles r on r.role_id = u.role_id
      where u.username = @username
    `)
  const account = result.recordset[0]
  if (!account || account.status !== 'Active') return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, account.password_hash)
  if (!ok) return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' })

  const permissionRows = await pool.request()
    .input('roleId', account.role_id)
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
    .input('userId', account.user_id)
    .query('select site_code from dbo.user_site_access where user_id = @userId')
  const departmentRows = await pool.request()
    .input('userId', account.user_id)
    .query('select department_name, sub_department_code from dbo.user_department_access where user_id = @userId')

  const tokenPayload = {
    userId: account.user_id,
    username: account.username,
    name: account.display_name,
    email: account.email,
    role: account.role_name,
    roleCode: account.role_code,
    permissions,
    siteCodes: siteRows.recordset.map(row => row.site_code),
    departments: [...new Set(departmentRows.recordset.flatMap(row => [row.department_name, row.sub_department_code]).filter(Boolean))]
  }

  const token = jwt.sign(tokenPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
  res.json({ token, user: tokenPayload })
}))

export default router
