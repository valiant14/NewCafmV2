import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getPool } from './pool.js'

const baseUrl = process.env.API_CHECK_BASE_URL || `http://localhost:${env.port}/api`
const pool = await getPool()
const result = await pool.request().query(`
  select top 1 u.user_id, u.username,
    case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end as data_scope
  from dbo.users u
  join dbo.roles r on r.role_id = u.role_id
  where u.status = 'Active'
    and r.status = 'Active'
    and (case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end) <> 'GLOBAL'
    and exists (select 1 from dbo.user_site_access site_access where site_access.user_id = u.user_id)
    and exists (select 1 from dbo.user_department_access department_access where department_access.user_id = u.user_id)
    and exists (
      select 1 from dbo.role_permissions permission
      where permission.role_id = u.role_id and permission.module_name = 'Work Orders'
        and permission.action_name = 'view' and permission.allowed = 1
    )
  order by u.user_id;

  select top 1 u.user_id
  from dbo.users u
  join dbo.roles r on r.role_id = u.role_id
  where u.status = 'Active' and r.status = 'Active'
    and (case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end) = 'GLOBAL'
  order by case when u.user_id = 'USR-ADMIN' then 0 else 1 end, u.user_id;

  select top 1 u.user_id
  from dbo.users u
  join dbo.roles r on r.role_id = u.role_id
  where u.status = 'Active' and r.status = 'Active'
    and (case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end) <> 'GLOBAL'
    and (
      not exists (select 1 from dbo.user_site_access site_access where site_access.user_id = u.user_id)
      or not exists (select 1 from dbo.user_department_access department_access where department_access.user_id = u.user_id)
    )
  order by u.user_id;
`)

const scopedUser = result.recordsets[0]?.[0]
const globalUser = result.recordsets[1]?.[0]
const unconfiguredUser = result.recordsets[2]?.[0]
if (!scopedUser || !globalUser) throw new Error('A scoped Work Orders user and a global administrator are required for the API scope check.')

const scopeResult = await pool.request().input('userId', scopedUser.user_id).query(`
  select site_code from dbo.user_site_access where user_id = @userId;
  select department_name, sub_department_code from dbo.user_department_access where user_id = @userId;
`)
const allowedSites = new Set((scopeResult.recordsets[0] || []).map(row => String(row.site_code).toLowerCase()))
const allowedDepartments = new Set((scopeResult.recordsets[1] || []).flatMap(row => [row.department_name, row.sub_department_code]).filter(Boolean).map(value => String(value).toLowerCase()))

const tokenFor = userId => jwt.sign({ userId }, env.jwtSecret, { expiresIn: '2m' })
const request = async (path, userId, { method = 'GET', body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${tokenFor(userId)}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const responseBody = await response.json().catch(() => null)
  return { status: response.status, body: responseBody }
}
const isAllowedDepartment = row => [row.department_name, row.assigned_department_name, row.sub_department_code]
  .filter(Boolean)
  .some(value => allowedDepartments.has(String(value).toLowerCase()))
const isAllowedWorkOrder = row => (
  allowedSites.has(String(row.site_code || '').toLowerCase()) &&
  (scopedUser.data_scope === 'OWN'
    ? row.created_by_user_id === scopedUser.user_id
    : isAllowedDepartment(row) || row.created_by_user_id === scopedUser.user_id)
)

const adminOrders = await request('/work-orders', globalUser.user_id)
const scopedOrders = await request('/work-orders', scopedUser.user_id)
const scopedSession = await request('/auth/me', scopedUser.user_id)
if (scopedSession.status !== 200 || scopedSession.body?.user?.dataScope !== scopedUser.data_scope) {
  throw new Error('The live auth session does not contain the effective data scope.')
}
if (adminOrders.status !== 200) throw new Error(`Global Work Orders request failed with HTTP ${adminOrders.status}.`)
if (scopedOrders.status !== 200) throw new Error(`Scoped Work Orders request failed with HTTP ${scopedOrders.status}.`)
if (!scopedOrders.body.every(isAllowedWorkOrder)) throw new Error('Scoped Work Orders response contains a row outside the assigned user scope.')

const inaccessibleOrder = adminOrders.body.find(row => !isAllowedWorkOrder(row))
if (inaccessibleOrder) {
  const direct = await request(`/work-orders/${encodeURIComponent(inaccessibleOrder.work_order_num)}`, scopedUser.user_id)
  if (direct.status !== 404) throw new Error(`Direct Work Order scope check expected HTTP 404, received ${direct.status}.`)
}

const scopedSites = await request('/sites', scopedUser.user_id)
if (scopedSites.status === 200 && !scopedSites.body.every(row => allowedSites.has(String(row.site_code).toLowerCase()))) {
  throw new Error('Sites response contains a site outside the assigned user scope.')
}

const scopedDepartments = await request('/departments', scopedUser.user_id)
if (scopedDepartments.status === 200 && !scopedDepartments.body.every(row => (
  allowedDepartments.has(String(row.department_name || '').toLowerCase()) ||
  allowedDepartments.has(String(row.sub_department_code || '').toLowerCase())
))) {
  throw new Error('Departments response contains a department outside the assigned user scope.')
}

const outsideSite = adminOrders.body.find(row => !allowedSites.has(String(row.site_code || '').toLowerCase()))?.site_code
if (outsideSite) {
  const rejectedCreate = await request('/service-requests', scopedUser.user_id, {
    method: 'POST',
    body: {
      sr_num: 'AUTO',
      description: 'Access scope verification',
      site_code: outsideSite,
      department_name: [...allowedDepartments][0],
      reported_at: new Date().toISOString(),
      status: 'NEW'
    }
  })
  if (rejectedCreate.status !== 403) throw new Error(`Out-of-scope create expected HTTP 403, received ${rejectedCreate.status}.`)
}

const adminUsers = await request('/users', globalUser.user_id)
if (adminUsers.status !== 200 || !adminUsers.body.every(row => row.effective_data_scope && row.data_scope_override)) {
  throw new Error('Users API did not return the configured data scope fields.')
}

const scopedEndpoints = [
  '/service-requests',
  '/work-order-resource-requests',
  '/work-order-planned-labor',
  '/work-order-tasks',
  '/purchase-requisitions',
  '/purchase-orders',
  '/reservations',
  '/preventive-maintenance',
  '/incidents',
  '/meter-readings',
  '/assets',
  '/labor',
  '/locations'
]
const endpointsChecked = []
for (const endpoint of scopedEndpoints) {
  const response = await request(endpoint, scopedUser.user_id)
  if (response.status === 403) continue
  if (response.status !== 200) throw new Error(`${endpoint} scope check failed with HTTP ${response.status}.`)
  const outside = response.body.find(row => {
    const siteAllowed = allowedSites.has(String(row.site_code || '').toLowerCase())
    const hasOwner = Object.hasOwn(row, 'created_by_user_id')
    const ownsRow = hasOwner && row.created_by_user_id === scopedUser.user_id
    const dataAllowed = scopedUser.data_scope === 'OWN' && hasOwner
      ? ownsRow
      : ownsRow || isAllowedDepartment(row)
    return !siteAllowed || !dataAllowed
  })
  if (outside) throw new Error(`${endpoint} returned a record outside the assigned user scope.`)
  endpointsChecked.push(endpoint)
}

const denyByDefaultChecked = []
if (unconfiguredUser) {
  for (const endpoint of ['/work-orders', '/service-requests', '/purchase-requisitions', '/purchase-orders', '/reservations', '/storerooms', '/inventory-stock']) {
    const response = await request(endpoint, unconfiguredUser.user_id)
    if (response.status === 403) continue
    if (response.status !== 200 || !Array.isArray(response.body) || response.body.length) {
      throw new Error(`Unconfigured user ${unconfiguredUser.user_id} received data from ${endpoint}.`)
    }
    denyByDefaultChecked.push(endpoint)
  }
}

console.log(JSON.stringify({
  ok: true,
  scopedUser: scopedUser.user_id,
  dataScope: scopedUser.data_scope,
  allowedSites: [...allowedSites],
  allowedDepartments: [...allowedDepartments],
  globalWorkOrders: adminOrders.body.length,
  scopedWorkOrders: scopedOrders.body.length,
  usersChecked: adminUsers.body.length,
  directOutsideRecordHidden: Boolean(inaccessibleOrder),
  outsideCreateRejected: Boolean(outsideSite),
  sitesChecked: scopedSites.status === 200,
  departmentsChecked: scopedDepartments.status === 200,
  endpointsChecked,
  denyByDefaultUser: unconfiguredUser?.user_id || null,
  denyByDefaultChecked
}, null, 2))
process.exit(0)
