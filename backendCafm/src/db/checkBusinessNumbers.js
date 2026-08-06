import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { closePool, getPool } from './pool.js'

const baseUrl = process.env.API_CHECK_BASE_URL || `http://localhost:${env.port}/api`
const pool = await getPool()
const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
const workOrderNumber = `CHECK-NUM-${suffix}`
const setup = await pool.request().query(`
  select top 1 u.user_id
  from dbo.users u
  join dbo.roles r on r.role_id = u.role_id
  where u.status = 'Active'
    and r.status = 'Active'
    and (case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end) = 'GLOBAL'
  order by case when u.user_id = 'USR-ADMIN' then 0 else 1 end, u.user_id;

  declare @siteCode nvarchar(30) = (select top 1 site_code from dbo.sites where status = 'Active' order by site_code);
  select @siteCode as site_code,
    (select top 1 department_name from dbo.departments where status = 'Active' order by department_name) as department_name;

  select top 1 item_code, description from dbo.materials where status = 'Active' order by item_code;
  select top 1 tool_code, description from dbo.tools_equipment where status <> 'Inactive' order by tool_code;
  select top 1 store_code from dbo.storerooms where status = 'Active' and site_code = @siteCode order by store_code;
`)

const globalUser = setup.recordsets[0]?.[0]
const workOrder = setup.recordsets[1]?.[0]
const material = setup.recordsets[2]?.[0]
const tool = setup.recordsets[3]?.[0]
const store = setup.recordsets[4]?.[0]
if (!globalUser || !workOrder?.site_code || !material || !tool || !store) {
  throw new Error('A global user plus active site, store, material, and tool masters are required for the business-number check.')
}

await pool.request()
  .input('workOrderNumber', workOrderNumber)
  .input('siteCode', workOrder.site_code)
  .input('departmentName', workOrder.department_name || null)
  .input('createdBy', globalUser.user_id)
  .query(`
    insert into dbo.work_orders(work_order_num, description, status, work_type, site_code, department_name, reported_at, created_by_user_id)
    values(@workOrderNumber, 'Temporary business number check', 'WAPPR', 'CM', @siteCode, @departmentName, sysutcdatetime(), @createdBy)
  `)

const token = jwt.sign({ userId: globalUser.user_id }, env.jwtSecret, { expiresIn: '2m' })
const created = { workOrder: workOrderNumber, purchaseRequests: [], purchaseOrder: '', reservation: '', incident: '' }
const request = async (path, body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Connection: 'close'
    },
    body: JSON.stringify(body)
  })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${path} failed with HTTP ${response.status}: ${result?.message || 'Unknown error'}`)
  return result
}

const year = new Date().getUTCFullYear()
const matches = (value, prefix) => new RegExp(`^${prefix}-${year}-\\d{4,}$`).test(String(value || ''))

try {
  const prPayload = suffix => ({
    pr_num: 'AUTO',
    work_order_num: workOrderNumber,
    request_type: 'Material',
    item_code: material.item_code,
    item_description: material.description,
    requested_quantity: 1,
    store_code: store.store_code,
    site_code: workOrder.site_code,
    department_name: workOrder.department_name || '',
    status: 'WAPPR'
  })
  const purchaseRequests = await Promise.all([
    request('/supply-chain/purchase-requisitions', prPayload('A')),
    request('/supply-chain/purchase-requisitions', prPayload('B'))
  ])
  created.purchaseRequests = purchaseRequests.map(result => result.purchaseRequisition?.pr_num)
  if (new Set(created.purchaseRequests).size !== 2 || created.purchaseRequests.some(value => !matches(value, 'PR'))) {
    throw new Error(`Concurrent PR allocation returned invalid references: ${created.purchaseRequests.join(', ')}`)
  }

  const purchaseOrder = await request(`/supply-chain/purchase-requisitions/${encodeURIComponent(created.purchaseRequests[0])}/approve-create-po`, {})
  created.purchaseOrder = purchaseOrder.purchaseOrder?.po_num

  const reservation = await request('/supply-chain/reservations', {
    work_order_num: workOrderNumber,
    request_type: 'Tool',
    item_code: tool.tool_code,
    item_description: tool.description,
    reserved_quantity: 1,
    arranged_quantity: 0,
    released_quantity: 0,
    delivered_quantity: 0,
    site_code: workOrder.site_code,
    department_name: workOrder.department_name || '',
    status: 'ENTERED'
  })
  created.reservation = reservation.reservation?.reservation_num

  const incident = await request('/incidents', {
    incident_num: 'AUTO',
    description: 'Business number regression check',
    site_code: workOrder.site_code,
    department_name: workOrder.department_name || '',
    severity: 'Low',
    status: 'NEW'
  })
  created.incident = incident.incident_num

  if (!matches(created.purchaseOrder, 'PO')) throw new Error(`Invalid PO reference: ${created.purchaseOrder}`)
  if (!matches(created.reservation, 'ALC')) throw new Error(`Invalid allocation reference: ${created.reservation}`)
  if (!matches(created.incident, 'INC')) throw new Error(`Invalid incident reference: ${created.incident}`)

  console.log(JSON.stringify({ ok: true, ...created }, null, 2))
} finally {
  const cleanup = pool.request()
    .input('workOrderNumber', created.workOrder)
    .input('reservation', created.reservation || null)
    .input('purchaseOrder', created.purchaseOrder || null)
    .input('purchaseRequestA', created.purchaseRequests[0] || null)
    .input('purchaseRequestB', created.purchaseRequests[1] || null)
    .input('incident', created.incident || null)
  await cleanup.query(`
    delete from dbo.inventory_reservations where reservation_num = @reservation;
    delete from dbo.purchase_orders where po_num = @purchaseOrder;
    delete from dbo.purchase_requisitions where pr_num in (@purchaseRequestA, @purchaseRequestB);
    delete from dbo.incidents where incident_num = @incident;
    delete from dbo.work_orders where work_order_num = @workOrderNumber;
  `).catch(() => {})
  await closePool()
}
