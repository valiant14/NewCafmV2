import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
const parseList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean)
const siteCode = value => String(value || '').includes('/') ? String(value).split('/').pop().trim() : String(value || '').trim()

const resolveRoleId = async (pool, value) => {
  if (Number(value)) return Number(value)
  const result = await pool.request()
    .input('role', value || 'Facility Manager')
    .query('select top 1 role_id from dbo.roles where role_name = @role or role_code = @role order by role_id')
  return result.recordset[0]?.role_id
}

const syncScopes = async (pool, userId, sites, departments) => {
  await pool.request().input('userId', userId).query('delete from dbo.user_site_access where user_id = @userId')
  await pool.request().input('userId', userId).query('delete from dbo.user_department_access where user_id = @userId')

  for (const item of parseList(sites).filter(value => value !== 'All Sites')) {
    const code = siteCode(item)
    if (!code) continue
    await pool.request()
      .input('userId', userId)
      .input('siteCode', code)
      .query('insert into dbo.user_site_access(user_id, site_code) values(@userId, @siteCode)')
  }

  for (const department of parseList(departments).filter(value => value !== 'All Departments')) {
    await pool.request()
      .input('userId', userId)
      .input('department', department)
      .query('insert into dbo.user_department_access(user_id, department_name, sub_department_code) values(@userId, @department, null)')
  }
}

router.get('/', requirePermission('Users', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const result = await pool.request().query(`
    select u.user_id, u.username, u.display_name, u.email, u.role_id, u.labor_id, u.status, u.last_login_at,
      r.role_name,
      isnull((select string_agg(s.site_code, ', ') from dbo.user_site_access s where s.user_id = u.user_id), 'All Sites') as site_scope,
      isnull((select string_agg(coalesce(d.sub_department_code, d.department_name), ', ') from dbo.user_department_access d where d.user_id = u.user_id), 'All Departments') as department_scope
    from dbo.users u
    join dbo.roles r on r.role_id = u.role_id
    order by u.user_id
  `)
  res.json(result.recordset)
}))

router.post('/', requirePermission('Users', 'create'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const roleId = await resolveRoleId(pool, req.body.role_id || req.body.role)
  if (!roleId) return res.status(400).json({ error: 'BadRequest', message: 'Role not found' })
  const passwordHash = await bcrypt.hash(req.body.password || '1234', 10)
  const result = await pool.request()
    .input('user_id', req.body.user_id)
    .input('username', req.body.username)
    .input('password_hash', passwordHash)
    .input('display_name', req.body.display_name)
    .input('email', req.body.email || '')
    .input('role_id', roleId)
    .input('labor_id', req.body.labor_id || null)
    .input('status', req.body.status || 'Active')
    .query(`
      insert into dbo.users(user_id, username, password_hash, display_name, email, role_id, labor_id, status)
      output inserted.*
      values(@user_id, @username, @password_hash, @display_name, @email, @role_id, @labor_id, @status)
    `)
  await syncScopes(pool, req.body.user_id, req.body.site, req.body.department)
  res.status(201).json(result.recordset[0])
}))

router.put('/:id', requirePermission('Users', 'edit'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const current = await pool.request().input('id', req.params.id).query('select * from dbo.users where user_id = @id')
  if (!current.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
  const roleId = await resolveRoleId(pool, req.body.role_id || req.body.role || current.recordset[0].role_id)
  const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 10) : current.recordset[0].password_hash
  const result = await pool.request()
    .input('id', req.params.id)
    .input('username', req.body.username ?? current.recordset[0].username)
    .input('password_hash', passwordHash)
    .input('display_name', req.body.display_name ?? current.recordset[0].display_name)
    .input('email', req.body.email ?? current.recordset[0].email)
    .input('role_id', roleId)
    .input('labor_id', req.body.labor_id ?? current.recordset[0].labor_id)
    .input('status', req.body.status ?? current.recordset[0].status)
    .query(`
      update dbo.users
      set username = @username, password_hash = @password_hash, display_name = @display_name,
        email = @email, role_id = @role_id, labor_id = @labor_id, status = @status, updated_at = sysutcdatetime()
      output inserted.*
      where user_id = @id
    `)
  if (req.body.site !== undefined || req.body.department !== undefined) {
    await syncScopes(pool, req.params.id, req.body.site, req.body.department)
  }
  res.json(result.recordset[0])
}))

export default router
