import { getPool } from './pool.js'

const pool = await getPool()
const result = await pool.request().query(`
  select r.role_code, r.role_name, r.data_scope, r.status
  from dbo.roles r
  order by r.role_id;

  select u.user_id, u.username, r.role_code,
    case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end as effective_data_scope,
    (select count_big(1) from dbo.user_site_access site_access where site_access.user_id = u.user_id) as site_count,
    (select count_big(1) from dbo.user_department_access department_access where department_access.user_id = u.user_id) as department_count,
    u.status
  from dbo.users u
  join dbo.roles r on r.role_id = u.role_id
  order by u.user_id;

  select 'service_requests' as entity, count_big(1) as total,
    sum(case when created_by_user_id is null then 1 else 0 end) as missing_owner,
    sum(case when created_by_user_id = 'USR-LEGACY' then 1 else 0 end) as legacy_custodian from dbo.service_requests
  union all select 'work_orders', count_big(1), sum(case when created_by_user_id is null then 1 else 0 end), sum(case when created_by_user_id = 'USR-LEGACY' then 1 else 0 end) from dbo.work_orders
  union all select 'purchase_requisitions', count_big(1), sum(case when created_by_user_id is null then 1 else 0 end), sum(case when created_by_user_id = 'USR-LEGACY' then 1 else 0 end) from dbo.purchase_requisitions
  union all select 'purchase_orders', count_big(1), sum(case when created_by_user_id is null then 1 else 0 end), sum(case when created_by_user_id = 'USR-LEGACY' then 1 else 0 end) from dbo.purchase_orders
  union all select 'inventory_reservations', count_big(1), sum(case when created_by_user_id is null then 1 else 0 end), sum(case when created_by_user_id = 'USR-LEGACY' then 1 else 0 end) from dbo.inventory_reservations
  union all select 'incidents', count_big(1), sum(case when created_by_user_id is null then 1 else 0 end), sum(case when created_by_user_id = 'USR-LEGACY' then 1 else 0 end) from dbo.incidents
  union all select 'meter_readings', count_big(1), sum(case when created_by_user_id is null then 1 else 0 end), sum(case when created_by_user_id = 'USR-LEGACY' then 1 else 0 end) from dbo.meter_readings;

  select 'service_requests' as entity, site_code, department_name, nullif(reported_by, '') as reported_by, count_big(1) as record_count
  from dbo.service_requests
  group by site_code, department_name, nullif(reported_by, '')
  union all
  select 'work_orders', site_code, department_name, null, count_big(1)
  from dbo.work_orders
  group by site_code, department_name
  order by entity, site_code, department_name;
`)

const roles = result.recordsets[0] || []
const users = result.recordsets[1] || []
const ownership = result.recordsets[2] || []
const transactionScopes = result.recordsets[3] || []
const invalidUsers = users.filter(user => (
  user.status === 'Active' &&
  user.effective_data_scope !== 'GLOBAL' &&
  (!Number(user.site_count) || !Number(user.department_count))
))

console.log('Role data scopes')
console.table(roles)
console.log('User access scopes')
console.table(users)
console.log('Transaction ownership')
console.table(ownership)
console.log('Transaction scope distribution')
console.table(transactionScopes)

if (invalidUsers.length) {
  throw new Error(`${invalidUsers.length} active scoped user(s) have no site or department assignment.`)
}

const missingOwners = ownership.reduce((sum, row) => sum + Number(row.missing_owner || 0), 0)
if (missingOwners) throw new Error(`${missingOwners} transaction record(s) still have no ownership custodian.`)

console.log('Scope check passed.')
process.exit(0)
