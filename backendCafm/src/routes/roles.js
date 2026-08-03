import { Router } from 'express'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
const emitChange = (req, payload) => req.app.locals.broadcastWorkspaceChange?.({
  actor: req.user?.userId || req.user?.username || '',
  moduleName: 'Roles & Permissions',
  table: 'dbo.roles',
  ...payload
})
const codeFromName = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'ROLE'
const permissionList = value => [
  ...new Set((Array.isArray(value) ? value : String(value || '').split(/[,;|]+/))
    .map(item => String(item || '').trim())
    .filter(Boolean))
]

const rowsToRoles = rows => {
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.role_id)) {
      map.set(row.role_id, {
        role_id: row.role_id,
        role_code: row.role_code,
        role_name: row.role_name,
        scope_description: row.scope_description,
        status: row.status,
        permissions: {}
      })
    }
    if (row.allowed) {
      const role = map.get(row.role_id)
      role.permissions[row.action_name] = [...(role.permissions[row.action_name] || []), row.module_name]
    }
  }
  return [...map.values()]
}

const syncPermissions = async (pool, roleId, permissions = {}) => {
  await pool.request().input('roleId', roleId).query('delete from dbo.role_permissions where role_id = @roleId')
  for (const [action, modules] of Object.entries(permissions || {})) {
    for (const moduleName of permissionList(modules)) {
      await pool.request()
        .input('roleId', roleId)
        .input('moduleName', moduleName)
        .input('actionName', action)
        .query(`
          if exists(select 1 from dbo.permission_modules where module_name = @moduleName)
             and exists(select 1 from dbo.permission_actions where action_name = @actionName)
             and not exists(
               select 1
               from dbo.role_permissions
               where role_id = @roleId
                 and module_name = @moduleName
                 and action_name = @actionName
             )
          insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
          values(@roleId, @moduleName, @actionName, 1)
        `)
    }
  }
}

router.get('/', requirePermission('Roles & Permissions', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const result = await pool.request().query(`
    select r.role_id, r.role_code, r.role_name, r.scope_description, r.status,
      p.module_name, p.action_name, p.allowed
    from dbo.roles r
    left join dbo.role_permissions p on p.role_id = r.role_id
    order by r.role_id
  `)
  res.json(rowsToRoles(result.recordset))
}))

router.post('/', requirePermission('Roles & Permissions', 'create'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const existing = await pool.request()
    .input('role_name', req.body.role_name)
    .query('select role_id from dbo.roles where role_name = @role_name')
  if (existing.recordset[0]) {
    req.params.id = existing.recordset[0].role_id
    const result = await pool.request()
      .input('id', req.params.id)
      .input('role_code', req.body.role_code || codeFromName(req.body.role_name))
      .input('role_name', req.body.role_name)
      .input('scope_description', req.body.scope_description || '')
      .input('status', req.body.status || 'Active')
      .query(`
        update dbo.roles
        set role_code = @role_code, role_name = @role_name, scope_description = @scope_description,
          status = @status, updated_at = sysutcdatetime()
        output inserted.*
        where role_id = @id
    `)
    await syncPermissions(pool, req.params.id, req.body.permissions)
    emitChange(req, { action: 'edit', id: result.recordset[0]?.role_id })
    return res.json(result.recordset[0])
  }
  const result = await pool.request()
    .input('role_code', req.body.role_code || codeFromName(req.body.role_name))
    .input('role_name', req.body.role_name)
    .input('scope_description', req.body.scope_description || '')
    .input('status', req.body.status || 'Active')
    .query(`
      insert into dbo.roles(role_code, role_name, scope_description, status)
      output inserted.*
      values(@role_code, @role_name, @scope_description, @status)
  `)
  await syncPermissions(pool, result.recordset[0].role_id, req.body.permissions)
  emitChange(req, { action: 'create', id: result.recordset[0]?.role_id })
  res.status(201).json(result.recordset[0])
}))

router.put('/:id', requirePermission('Roles & Permissions', 'edit'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const result = await pool.request()
    .input('id', req.params.id)
    .input('role_code', req.body.role_code || codeFromName(req.body.role_name))
    .input('role_name', req.body.role_name)
    .input('scope_description', req.body.scope_description || '')
    .input('status', req.body.status || 'Active')
    .query(`
      update dbo.roles
      set role_code = @role_code, role_name = @role_name, scope_description = @scope_description,
        status = @status, updated_at = sysutcdatetime()
      output inserted.*
      where role_id = @id
    `)
  if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
  if (req.body.permissions) await syncPermissions(pool, req.params.id, req.body.permissions)
  emitChange(req, { action: 'edit', id: result.recordset[0]?.role_id })
  res.json(result.recordset[0])
}))

export default router
