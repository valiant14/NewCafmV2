import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { closePool, getPool } from './pool.js'

const baseUrl = process.env.API_CHECK_BASE_URL || `http://localhost:${env.port}/api`
const pool = await getPool()
const setup = await pool.request().query(`
  select top 1 u.user_id
  from dbo.users u
  join dbo.roles r on r.role_id = u.role_id
  where u.status = 'Active'
    and r.status = 'Active'
    and (case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end) = 'GLOBAL'
  order by case when u.user_id = 'USR-ADMIN' then 0 else 1 end, u.user_id;

  select top 1 work_order_num, site_code, department_name
  from dbo.work_orders
  where site_code is not null
  order by reported_at desc, work_order_num desc;
`)

const globalUser = setup.recordsets[0]?.[0]
const workOrder = setup.recordsets[1]?.[0]
if (!globalUser || !workOrder) throw new Error('A global user and a scoped work order are required for the business-number check.')

const token = jwt.sign({ userId: globalUser.user_id }, env.jwtSecret, { expiresIn: '2m' })
const created = { purchaseRequests: [], purchaseOrder: '', reservation: '', incident: '' }
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
    work_order_num: workOrder.work_order_num,
    request_type: 'Material',
    item_code: `NUMBER-CHECK-${suffix}`,
    item_description: `Business number check ${suffix}`,
    requested_quantity: 1,
    site_code: workOrder.site_code,
    department_name: workOrder.department_name || '',
    status: 'WAPPR'
  })
  const purchaseRequests = await Promise.all([
    request('/purchase-requisitions', prPayload('A')),
    request('/purchase-requisitions', prPayload('B'))
  ])
  created.purchaseRequests = purchaseRequests.map(row => row.pr_num)
  if (new Set(created.purchaseRequests).size !== 2 || created.purchaseRequests.some(value => !matches(value, 'PR'))) {
    throw new Error(`Concurrent PR allocation returned invalid references: ${created.purchaseRequests.join(', ')}`)
  }

  const purchaseOrder = await request('/purchase-orders', {
    po_num: 'AUTO',
    pr_num: created.purchaseRequests[0],
    work_order_num: workOrder.work_order_num,
    request_type: 'Material',
    item_code: 'NUMBER-CHECK-A',
    item_description: 'Business number check PO',
    ordered_quantity: 1,
    site_code: workOrder.site_code,
    department_name: workOrder.department_name || '',
    status: 'WAPPR'
  })
  created.purchaseOrder = purchaseOrder.po_num

  const reservation = await request('/reservations', {
    reservation_num: 'AUTO',
    work_order_num: workOrder.work_order_num,
    request_type: 'Tool',
    item_code: 'NUMBER-CHECK-TOOL',
    item_description: 'Business number check allocation',
    reserved_quantity: 1,
    arranged_quantity: 0,
    released_quantity: 0,
    delivered_quantity: 0,
    site_code: workOrder.site_code,
    department_name: workOrder.department_name || '',
    status: 'ENTERED'
  })
  created.reservation = reservation.reservation_num

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
  `).catch(() => {})
  await closePool()
}
