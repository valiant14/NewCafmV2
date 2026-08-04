import { Router } from 'express'
import sql from 'mssql'
import { getPool } from '../db/pool.js'
import { clearPermissionCache, requirePermission } from '../middleware/auth.js'
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

const readRole = async (pool, roleId) => {
  const result = await pool.request()
    .input('roleId', roleId)
    .query(`
      select r.role_id, r.role_code, r.role_name, r.scope_description, r.status,
        p.module_name, p.action_name, p.allowed
      from dbo.roles r
      left join dbo.role_permissions p on p.role_id = r.role_id
      where r.role_id = @roleId
      order by r.role_id
    `)
  return rowsToRoles(result.recordset)[0] || null
}

const saveRole = async (pool, roleId, body = {}) => {
  const result = await pool.request()
    .input('id', roleId)
    .input('role_code', body.role_code || codeFromName(body.role_name))
    .input('role_name', body.role_name)
    .input('scope_description', body.scope_description || '')
    .input('status', body.status || 'Active')
    .query(`
      update dbo.roles
      set role_code = @role_code, role_name = @role_name, scope_description = @scope_description,
        status = @status, updated_at = sysutcdatetime()
      output inserted.*
      where role_id = @id
    `)
  if (!result.recordset[0]) return null
  await syncPermissions(pool, roleId, body.permissions)
  clearPermissionCache()
  return readRole(pool, roleId)
}

const findRoleByNameOrCode = async (pool, value) => {
  const text = String(value || '').trim()
  const result = await pool.request()
    .input('value', text)
    .query(`
      select top 1 role_id
      from dbo.roles
      where role_name = @value or role_code = @value
      order by role_id
    `)
  return result.recordset[0]?.role_id || null
}

const syncPermissions = async (pool, roleId, permissions = {}) => {
  const pairs = []
  const seen = new Set()
  for (const [action, modules] of Object.entries(permissions || {})) {
    for (const moduleName of permissionList(modules)) {
      const key = `${action}::${moduleName}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({ action, moduleName })
    }
  }

  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    await new sql.Request(transaction)
      .input('roleId', roleId)
      .input('resource', `role-permissions-${roleId}`)
      .input('permissionsJson', sql.NVarChar(sql.MAX), JSON.stringify(pairs))
      .query(`
        set xact_abort on;
        declare @lockResult int;
        exec @lockResult = sp_getapplock
          @Resource = @resource,
          @LockMode = 'Exclusive',
          @LockOwner = 'Transaction',
          @LockTimeout = 10000;

        if @lockResult < 0
          throw 51000, 'Unable to lock role permissions for update.', 1;

        delete from dbo.role_permissions where role_id = @roleId;

        select distinct module_name, action_name
        into #desired_permissions
        from openjson(@permissionsJson)
        with (
          module_name nvarchar(160) '$.moduleName',
          action_name nvarchar(80) '$.action'
        )
        where nullif(module_name, '') is not null
          and nullif(action_name, '') is not null;

        insert into dbo.permission_modules(module_name)
        select desired.module_name
        from (select distinct module_name from #desired_permissions) desired
        where not exists (
          select 1 from dbo.permission_modules existing with (updlock, holdlock)
          where existing.module_name = desired.module_name
        );

        insert into dbo.permission_actions(action_name)
        select desired.action_name
        from (select distinct action_name from #desired_permissions) desired
        where not exists (
          select 1 from dbo.permission_actions existing with (updlock, holdlock)
          where existing.action_name = desired.action_name
        );

        insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
        select @roleId, module_name, action_name, 1
        from #desired_permissions;
      `)
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
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
    const saved = await saveRole(pool, req.params.id, req.body)
    emitChange(req, { action: 'edit', id: saved?.role_id })
    return res.json(saved)
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
  clearPermissionCache()
  emitChange(req, { action: 'create', id: result.recordset[0]?.role_id })
  res.status(201).json(await readRole(pool, result.recordset[0].role_id))
}))

router.put('/by-name/:roleName', requirePermission('Roles & Permissions', 'edit'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const roleId = await findRoleByNameOrCode(pool, req.params.roleName)
  if (!roleId) return res.status(404).json({ error: 'NotFound', message: 'Role not found' })
  const saved = await saveRole(pool, roleId, req.body)
  emitChange(req, { action: 'edit', id: saved?.role_id })
  res.json(saved)
}))

router.put('/:id', requirePermission('Roles & Permissions', 'edit'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const saved = await saveRole(pool, req.params.id, req.body)
  if (!saved) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
  emitChange(req, { action: 'edit', id: saved?.role_id })
  res.json(saved)
}))

export default router
