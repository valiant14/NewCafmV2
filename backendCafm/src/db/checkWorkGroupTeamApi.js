import jwt from 'jsonwebtoken'
import { closePool, getPool } from './pool.js'
import { env } from '../config/env.js'

const apiBaseUrl = String(process.env.API_BASE_URL || 'http://127.0.0.1:4000/api').replace(/\/$/, '')
const mutationCheck = String(process.env.WORKGROUP_TEAM_MUTATION_CHECK || '').toLowerCase() === 'true'

const apiRequest = async (path, token, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  })
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

try {
  const pool = await getPool()
  const accessResult = await pool.request().query(`
    select top 1 u.user_id
    from dbo.users u
    join dbo.roles r on r.role_id = u.role_id
    where u.status = 'Active'
      and r.status = 'Active'
      and (case when u.data_scope_override in ('GLOBAL', 'DEPARTMENT', 'OWN') then u.data_scope_override else r.data_scope end) = 'GLOBAL'
      and exists (
        select 1 from dbo.role_permissions permission
        where permission.role_id = r.role_id
          and permission.module_name = 'Routing Masters'
          and permission.action_name = 'edit'
          and permission.allowed = 1
      )
      and exists (
        select 1 from dbo.role_permissions permission
        where permission.role_id = r.role_id
          and permission.module_name = 'Labor'
          and permission.action_name = 'edit'
          and permission.allowed = 1
      )
      and exists (
        select 1 from dbo.role_permissions permission
        where permission.role_id = r.role_id
          and permission.module_name = 'Routing Masters'
          and permission.action_name = 'create'
          and permission.allowed = 1
      )
      and exists (
        select 1 from dbo.role_permissions permission
        where permission.role_id = r.role_id
          and permission.module_name = 'Labor'
          and permission.action_name = 'view'
          and permission.allowed = 1
      )
    order by u.user_id;

    select top 1 labor_id, display_name, site_code, department_name, sub_department_code
    from dbo.labor
    where upper(ltrim(rtrim(status))) <> 'INACTIVE'
      and work_group_code is null
      and nullif(ltrim(rtrim(site_code)), '') is not null
      and nullif(ltrim(rtrim(department_name)), '') is not null
    order by labor_id;
  `)
  const userId = accessResult.recordsets[0]?.[0]?.user_id
  if (!userId) throw new Error('No global active user has the permissions required for the Work Group team API check.')

  const token = jwt.sign({ userId }, env.jwtSecret, { expiresIn: '5m' })
  if (!mutationCheck) {
    const { response, body } = await apiRequest('/work-groups/__WORK_GROUP_ROUTE_CHECK__/members', token, {
      method: 'PUT',
      body: JSON.stringify({ member_labor_ids: [] })
    })
    if (response.status !== 404) {
      throw new Error(`Work Group team API returned ${response.status}; expected 404: ${body.message || 'No response message'}`)
    }
    console.log(JSON.stringify({
      ready: true,
      route: '/api/work-groups/:id/members',
      authenticated: true,
      validationGuard: 'unknown Work Group rejected',
      status: response.status
    }, null, 2))
    process.exitCode = 0
  } else {
    const labor = accessResult.recordsets[1]?.[0]
    if (!labor) throw new Error('No unassigned active Labor record is available for the rollback-safe team link check.')
    const workGroupCode = `API-CHECK-${Date.now()}`
    let created = false
    try {
      const createdResult = await apiRequest('/work-groups', token, {
        method: 'POST',
        body: JSON.stringify({
          work_group_code: workGroupCode,
          work_group_name: `API Team Check ${Date.now()}`,
          site_code: labor.site_code,
          department_name: labor.department_name,
          sub_department_code: labor.sub_department_code || null,
          default_supervisor_labor_id: labor.labor_id,
          status: 'Active'
        })
      })
      if (createdResult.response.status !== 201) throw new Error(`Unable to create the check Work Group: ${createdResult.body.message || createdResult.response.status}`)
      created = true

      const linkedResult = await apiRequest(`/work-groups/${encodeURIComponent(workGroupCode)}/members`, token, {
        method: 'PUT',
        body: JSON.stringify({ member_labor_ids: [labor.labor_id] })
      })
      if (linkedResult.response.status !== 200 || !linkedResult.body.member_labor_ids?.includes(labor.labor_id)) {
        throw new Error(`Unable to link Labor to the check Work Group: ${linkedResult.body.message || linkedResult.response.status}`)
      }

      const loadedLabor = await apiRequest(`/labor/${encodeURIComponent(labor.labor_id)}`, token)
      if (loadedLabor.response.status !== 200 || loadedLabor.body.work_group_code !== workGroupCode) {
        throw new Error('The Labor API did not return the saved Work Group link.')
      }

      const unlinkedResult = await apiRequest(`/work-groups/${encodeURIComponent(workGroupCode)}/members`, token, {
        method: 'PUT',
        body: JSON.stringify({ member_labor_ids: [] })
      })
      if (unlinkedResult.response.status !== 200 || unlinkedResult.body.member_labor_ids?.length) {
        throw new Error(`Unable to unlink Labor from the check Work Group: ${unlinkedResult.body.message || unlinkedResult.response.status}`)
      }

      const reloadedLabor = await apiRequest(`/labor/${encodeURIComponent(labor.labor_id)}`, token)
      if (reloadedLabor.response.status !== 200 || reloadedLabor.body.work_group_code) {
        throw new Error('The Labor API still returns a Work Group after unlinking.')
      }

      const deletedResult = await apiRequest(`/work-groups/${encodeURIComponent(workGroupCode)}`, token, { method: 'DELETE' })
      if (deletedResult.response.status !== 200) throw new Error(`Unable to delete the check Work Group: ${deletedResult.body.message || deletedResult.response.status}`)
      created = false
      console.log(JSON.stringify({
        ready: true,
        route: '/api/work-groups/:id/members',
        create: true,
        link: true,
        reload: true,
        unlink: true,
        cleanup: true
      }, null, 2))
    } finally {
      if (created) {
        await pool.request()
          .input('workGroupCode', workGroupCode)
          .query(`
            update dbo.labor set work_group_code = null, updated_at = sysutcdatetime() where work_group_code = @workGroupCode;
            delete from dbo.work_groups where work_group_code = @workGroupCode;
          `)
      }
    }
  }
} finally {
  await closePool()
}
