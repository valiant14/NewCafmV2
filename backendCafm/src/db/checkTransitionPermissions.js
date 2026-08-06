import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { closePool, getPool } from './pool.js'

const baseUrl = process.env.API_CHECK_BASE_URL || `http://localhost:${env.port}/api`
const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const userId = `CHECK-${suffix}`
const roleCode = `CHECK_TRANSITION_${suffix}`
const roleName = `Transition Check ${suffix}`
const workOrderNumber = `CHECK-WO-${suffix}`
const pool = await getPool()
let roleId = null

try {
  const createdRole = await pool.request()
    .input('roleCode', roleCode)
    .input('roleName', roleName)
    .query(`
      insert into dbo.roles(role_code, role_name, scope_description, data_scope, status)
      output inserted.role_id
      values(@roleCode, @roleName, 'Automated transition permission check', 'GLOBAL', 'Active')
    `)
  roleId = createdRole.recordset[0].role_id

  await pool.request()
    .input('roleId', roleId)
    .input('userId', userId)
    .input('username', userId)
    .input('workOrderNumber', workOrderNumber)
    .query(`
      insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
      values
        (@roleId, 'Work Orders', 'view', 1),
        (@roleId, 'Work Orders', 'edit', 1);

      insert into dbo.users(user_id, username, password_hash, display_name, role_id, data_scope_override, status)
      values(@userId, @username, 'not-used-by-token-check', 'Transition Permission Check', @roleId, 'ROLE', 'Active');

      declare @siteCode nvarchar(30) = (select top 1 site_code from dbo.sites order by site_code);
      if @siteCode is null throw 51020, 'A site is required for the transition permission check.', 1;

      insert into dbo.work_orders(work_order_num, description, status, work_type, site_code, reported_at, created_by_user_id)
      values(@workOrderNumber, 'Temporary transition permission check', 'COMP', 'CM', @siteCode, sysutcdatetime(), @userId);
    `)

  const token = jwt.sign({ userId }, env.jwtSecret, { expiresIn: '2m' })
  const routingFields = {
    work_group: 'CHECK-GROUP',
    system_name: 'CHECK-SYSTEM',
    supervisor: 'CHECK-SUPERVISOR',
    labor_craft_code: 'CHECK-CRAFT'
  }
  const routingResponse = await fetch(`${baseUrl}/work-orders/${encodeURIComponent(workOrderNumber)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Connection: 'close'
    },
    body: JSON.stringify(routingFields)
  })
  const routingBody = await routingResponse.json().catch(() => null)
  const routingRoundTrip = routingResponse.status === 200 && Object.entries(routingFields)
    .every(([key, value]) => routingBody?.[key] === value)
  if (!routingRoundTrip) {
    const detail = routingBody?.message ? ` ${routingBody.message}` : ''
    throw new Error(`Work-order routing fields did not round-trip through the API (HTTP ${routingResponse.status}).${detail}`)
  }

  const response = await fetch(`${baseUrl}/work-orders/${encodeURIComponent(workOrderNumber)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Connection: 'close'
    },
    body: JSON.stringify({ status: 'CLOSE' })
  })
  const body = await response.json().catch(() => null)
  if (response.status !== 403) {
    throw new Error(`A user without Work Orders close permission received HTTP ${response.status}.`)
  }

  console.log(JSON.stringify({
    ok: true,
    workOrder: workOrderNumber,
    editPermission: true,
    closePermission: false,
    routingRoundTrip,
    closeRejected: response.status === 403,
    message: body?.message || ''
  }, null, 2))
} finally {
  await pool.request()
    .input('userId', userId)
    .input('roleId', roleId)
    .input('workOrderNumber', workOrderNumber)
    .query(`
      delete from dbo.meter_readings where work_order_num = @workOrderNumber;
      delete from dbo.inventory_reservations where work_order_num = @workOrderNumber;
      delete from dbo.purchase_orders where work_order_num = @workOrderNumber;
      delete from dbo.purchase_requisitions where work_order_num = @workOrderNumber;
      delete from dbo.work_order_resource_requests where work_order_num = @workOrderNumber;
      delete from dbo.work_order_planned_labor where work_order_num = @workOrderNumber;
      delete from dbo.work_order_tasks where work_order_num = @workOrderNumber;
      delete from dbo.work_orders where work_order_num = @workOrderNumber;
      delete from dbo.users where user_id = @userId;
      if @roleId is not null
      begin
        delete from dbo.role_permissions where role_id = @roleId;
        delete from dbo.roles where role_id = @roleId;
      end;
    `)
    .catch(() => {})
  await closePool()
}
