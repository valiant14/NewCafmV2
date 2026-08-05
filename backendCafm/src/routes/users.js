import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getPool, sql } from '../db/pool.js'
import { clearAccessContextCache, clearPermissionCache, requirePermission } from '../middleware/auth.js'
import { normalizeDataScope, scopeFromUser } from '../middleware/scope.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { bindParams } from '../utils/sqlParams.js'

const router = Router()
const emitChange = (req, payload) => req.app.locals.broadcastWorkspaceChange?.({
  actor: req.user?.userId || req.user?.username || '',
  moduleName: 'Users',
  table: 'dbo.users',
  ...payload
})
const parseList = value => (Array.isArray(value) ? value : String(value || '').split(','))
  .map(item => String(item || '').trim())
  .filter(Boolean)
const siteCode = value => String(value || '').includes('/') ? String(value).split('/').pop().trim() : String(value || '').trim()
const scopeError = message => {
  const error = new Error(message)
  error.status = 403
  error.code = 'ScopeViolation'
  return error
}
const normalizeOverride = value => {
  const scope = String(value || 'ROLE').trim().toUpperCase()
  return ['ROLE', 'OWN', 'DEPARTMENT', 'GLOBAL'].includes(scope) ? scope : 'ROLE'
}

const resolveRole = async (pool, value) => {
  const result = await pool.request()
    .input('roleId', Number(value) || null)
    .input('role', value || 'Facility Manager')
    .query(`
      select top 1 role_id, role_code, role_name, data_scope
      from dbo.roles
      where role_id = @roleId or role_name = @role or role_code = @role
      order by case when role_id = @roleId then 0 else 1 end, role_id
    `)
  return result.recordset[0] || null
}

const normalizeDepartmentScopes = async (pool, departments) => {
  const values = [...new Set(parseList(departments).filter(value => !/^all departments$/i.test(value)))]
  if (!values.length) return []
  const result = await pool.request()
    .input('departmentsJson', sql.NVarChar(sql.MAX), JSON.stringify(values))
    .query(`
      select distinct
        coalesce(matched.department_name, requested.value) as department_name,
        case
          when exists (select 1 from dbo.departments parent where parent.department_name = requested.value) then null
          else matched.sub_department_code
        end as sub_department_code
      from openjson(@departmentsJson) requested
      outer apply (
        select top 1 department_name, sub_department_code
        from dbo.departments
        where sub_department_code = requested.value
          or description = requested.value
          or department_name = requested.value
        order by case
          when sub_department_code = requested.value then 0
          when description = requested.value then 1
          else 2
        end, sub_department_code
      ) matched
      where nullif(ltrim(rtrim(requested.value)), '') is not null
    `)
  return result.recordset
}

const assertAssignableScope = async (pool, actor, { sites, departments, dataScopeOverride, targetUserId, creating = false }) => {
  const actorScope = scopeFromUser(actor)
  if (actorScope.dataScope === 'GLOBAL') return
  if (actorScope.dataScope === 'OWN' && (creating || String(targetUserId) !== actorScope.userId)) {
    throw scopeError('Own-record access cannot manage another user account.')
  }
  if (creating && (sites === undefined || departments === undefined)) {
    throw scopeError('A scoped administrator must assign both site and department access.')
  }

  if (sites !== undefined) {
    const requestedSites = [...new Set(parseList(sites).filter(value => !/^all sites$/i.test(value)).map(siteCode).filter(Boolean))]
    if (!requestedSites.length || requestedSites.some(site => !actorScope.siteCodes.includes(site))) {
      throw scopeError('A user cannot be assigned outside your site scope.')
    }
  }

  if (departments !== undefined) {
    const requestedDepartments = await normalizeDepartmentScopes(pool, departments)
    const outsideScope = requestedDepartments.some(row => (
      !actorScope.departmentNames.includes(row.department_name) &&
      !(row.sub_department_code && actorScope.subDepartmentCodes.includes(row.sub_department_code))
    ))
    if (!requestedDepartments.length || outsideScope) {
      throw scopeError('A user cannot be assigned outside your department scope.')
    }
  }

  if (normalizeOverride(dataScopeOverride) === 'GLOBAL') {
    throw scopeError('Only a global administrator can grant global data access.')
  }
}

const syncScopes = async (pool, userId, sites, departments) => {
  const siteCodes = [...new Set(parseList(sites).filter(value => !/^all sites$/i.test(value)).map(siteCode).filter(Boolean))]
  const departmentScopes = await normalizeDepartmentScopes(pool, departments)
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    await new sql.Request(transaction)
      .input('userId', sql.NVarChar(50), userId)
      .input('sitesJson', sql.NVarChar(sql.MAX), JSON.stringify(siteCodes))
      .input('departmentsJson', sql.NVarChar(sql.MAX), JSON.stringify(departmentScopes))
      .query(`
        set xact_abort on;

        delete from dbo.user_site_access where user_id = @userId;
        delete from dbo.user_department_access where user_id = @userId;

        insert into dbo.user_site_access(user_id, site_code)
        select @userId, value
        from openjson(@sitesJson)
        where nullif(ltrim(rtrim(value)), '') is not null;

        insert into dbo.user_department_access(user_id, department_name, sub_department_code)
        select @userId, department_name, sub_department_code
        from openjson(@departmentsJson)
        with (
          department_name nvarchar(160) '$.department_name',
          sub_department_code nvarchar(50) '$.sub_department_code'
        )
        where nullif(ltrim(rtrim(department_name)), '') is not null;
      `)
    await transaction.commit()
  } catch (error) {
    await transaction.rollback().catch(() => {})
    throw error
  }
  clearPermissionCache(userId)
  clearAccessContextCache(userId)
}

const userVisibility = user => {
  const scope = scopeFromUser(user)
  if (scope.dataScope === 'GLOBAL') return { where: '', params: {} }
  const params = { viewerUserId: scope.userId }
  if (scope.dataScope === 'OWN' || !scope.siteCodes.length || !scope.departmentNames.length) {
    return { where: ' and u.user_id = @viewerUserId', params }
  }

  const siteParams = scope.siteCodes.map((_, index) => `@viewerSite${index}`)
  const departmentParams = scope.departmentNames.map((_, index) => `@viewerDepartment${index}`)
  const subDepartmentParams = scope.subDepartmentCodes.map((_, index) => `@viewerSubDepartment${index}`)
  scope.siteCodes.forEach((value, index) => { params[`viewerSite${index}`] = value })
  scope.departmentNames.forEach((value, index) => { params[`viewerDepartment${index}`] = value })
  scope.subDepartmentCodes.forEach((value, index) => { params[`viewerSubDepartment${index}`] = value })
  const departmentMatch = [
    `target_department.department_name in (${departmentParams.join(', ')})`,
    ...(subDepartmentParams.length ? [`target_department.sub_department_code in (${subDepartmentParams.join(', ')})`] : [])
  ].join(' or ')

  return {
    params,
    where: ` and (
      u.user_id = @viewerUserId
      or (
        exists (select 1 from dbo.user_site_access target_site where target_site.user_id = u.user_id)
        and not exists (
          select 1 from dbo.user_site_access target_site
          where target_site.user_id = u.user_id and target_site.site_code not in (${siteParams.join(', ')})
        )
        and exists (
          select 1 from dbo.user_department_access target_department
          where target_department.user_id = u.user_id and (${departmentMatch})
        )
        and not exists (
          select 1 from dbo.user_department_access target_department
          where target_department.user_id = u.user_id and not (${departmentMatch})
        )
      )
    )`
  }
}

const userSelectSql = `
  select u.user_id, u.username, u.display_name, u.email, u.role_id, u.labor_id, u.data_scope_override,
    u.status, u.last_login_at, r.role_name, r.data_scope as role_data_scope,
    case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end as effective_data_scope,
    isnull((select string_agg(s.site_code, ', ') from dbo.user_site_access s where s.user_id = u.user_id), 'All Sites') as site_scope,
    isnull((select string_agg(coalesce(d.sub_department_code, d.department_name), ', ') from dbo.user_department_access d where d.user_id = u.user_id), 'All Departments') as department_scope
  from dbo.users u
  join dbo.roles r on r.role_id = u.role_id
  where 1 = 1`

router.get('/', requirePermission('Users', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const visible = userVisibility(req.user)
  const result = await bindParams(pool.request(), visible.params).query(`${userSelectSql}${visible.where} order by u.user_id`)
  res.json(result.recordset)
}))

router.get('/:id', requirePermission('Users', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const visible = userVisibility(req.user)
  const request = bindParams(pool.request(), visible.params)
  const result = await request.input('targetUserId', req.params.id).query(`${userSelectSql} and u.user_id = @targetUserId${visible.where}`)
  if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
  res.json(result.recordset[0])
}))

router.post('/', requirePermission('Users', 'create'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const role = await resolveRole(pool, req.body.role_id || req.body.role)
  if (!role) return res.status(400).json({ error: 'BadRequest', message: 'Role not found' })
  if (scopeFromUser(req.user).dataScope !== 'GLOBAL' && normalizeDataScope(role.data_scope) === 'GLOBAL') {
    throw scopeError('Only a global administrator can assign a global role.')
  }
  const override = normalizeOverride(req.body.data_scope_override)
  const targetDataScope = normalizeDataScope(override === 'ROLE' ? role.data_scope : override)
  if (targetDataScope !== 'GLOBAL') {
    const requestedSites = parseList(req.body.site).filter(value => !/^all sites$/i.test(value)).map(siteCode).filter(Boolean)
    const requestedDepartments = await normalizeDepartmentScopes(pool, req.body.department)
    if (!requestedSites.length || !requestedDepartments.length) {
      return res.status(400).json({ error: 'BadRequest', message: 'Scoped users require at least one site and department.' })
    }
  }
  await assertAssignableScope(pool, req.user, {
    sites: req.body.site,
    departments: req.body.department,
    dataScopeOverride: req.body.data_scope_override,
    targetUserId: req.body.user_id,
    creating: true
  })
  const passwordHash = await bcrypt.hash(req.body.password || '1234', 10)
  const result = await pool.request()
    .input('user_id', req.body.user_id)
    .input('username', req.body.username)
    .input('password_hash', passwordHash)
    .input('display_name', req.body.display_name)
    .input('email', req.body.email || '')
    .input('role_id', role.role_id)
    .input('labor_id', req.body.labor_id || null)
    .input('data_scope_override', override)
    .input('status', req.body.status || 'Active')
    .query(`
      insert into dbo.users(user_id, username, password_hash, display_name, email, role_id, labor_id, data_scope_override, status)
      output inserted.*
      values(@user_id, @username, @password_hash, @display_name, @email, @role_id, @labor_id, @data_scope_override, @status)
  `)
  await syncScopes(pool, req.body.user_id, req.body.site, req.body.department)
  emitChange(req, { action: 'create', id: result.recordset[0]?.user_id, targetUserId: result.recordset[0]?.user_id })
  res.status(201).json(result.recordset[0])
}))

router.put('/:id', requirePermission('Users', 'edit'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const visible = userVisibility(req.user)
  const currentRequest = bindParams(pool.request(), visible.params)
  const currentResult = await currentRequest.input('targetUserId', req.params.id).query(`
    select u.* from dbo.users u where u.user_id = @targetUserId${visible.where}
  `)
  const current = currentResult.recordset[0]
  if (!current) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })

  const actorScope = scopeFromUser(req.user)
  const role = await resolveRole(pool, req.body.role_id || req.body.role || current.role_id)
  if (!role) return res.status(400).json({ error: 'BadRequest', message: 'Role not found' })
  if (actorScope.dataScope !== 'GLOBAL' && Number(role.role_id) !== Number(current.role_id)) {
    throw scopeError('Only a global administrator can change another user role.')
  }
  if (actorScope.dataScope !== 'GLOBAL' && normalizeDataScope(role.data_scope) === 'GLOBAL') {
    throw scopeError('Only a global administrator can assign a global role.')
  }
  if (actorScope.dataScope !== 'GLOBAL' && req.params.id === actorScope.userId && req.body.data_scope_override !== undefined && normalizeOverride(req.body.data_scope_override) !== current.data_scope_override) {
    throw scopeError('A user cannot broaden their own data scope.')
  }
  await assertAssignableScope(pool, req.user, {
    sites: req.body.site,
    departments: req.body.department,
    dataScopeOverride: req.body.data_scope_override ?? current.data_scope_override,
    targetUserId: req.params.id
  })

  const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 10) : current.password_hash
  const result = await pool.request()
    .input('id', req.params.id)
    .input('username', req.body.username ?? current.username)
    .input('password_hash', passwordHash)
    .input('display_name', req.body.display_name ?? current.display_name)
    .input('email', req.body.email ?? current.email)
    .input('role_id', role.role_id)
    .input('labor_id', req.body.labor_id ?? current.labor_id)
    .input('data_scope_override', normalizeOverride(req.body.data_scope_override ?? current.data_scope_override))
    .input('status', req.body.status ?? current.status)
    .query(`
      update dbo.users
      set username = @username, password_hash = @password_hash, display_name = @display_name,
        email = @email, role_id = @role_id, labor_id = @labor_id,
        data_scope_override = @data_scope_override, status = @status, updated_at = sysutcdatetime()
      output inserted.*
      where user_id = @id
    `)
  if (req.body.site !== undefined || req.body.department !== undefined) {
    const currentScopes = await pool.request().input('id', req.params.id).query(`
      select isnull((select string_agg(site_code, ', ') from dbo.user_site_access where user_id = @id), 'All Sites') as sites,
        isnull((select string_agg(coalesce(sub_department_code, department_name), ', ') from dbo.user_department_access where user_id = @id), 'All Departments') as departments
    `)
    await syncScopes(
      pool,
      req.params.id,
      req.body.site ?? currentScopes.recordset[0].sites,
      req.body.department ?? currentScopes.recordset[0].departments
    )
  } else {
    clearPermissionCache(req.params.id)
    clearAccessContextCache(req.params.id)
  }
  emitChange(req, { action: 'edit', id: result.recordset[0]?.user_id, targetUserId: result.recordset[0]?.user_id })
  res.json(result.recordset[0])
}))

export default router
