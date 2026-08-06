import { Router } from 'express'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import authRouter from './auth.js'
import rolesRouter from './roles.js'
import usersRouter from './users.js'
import workOrderWorkflowRouter from './workOrderWorkflow.js'
import applicationWorkflowsRouter from './applicationWorkflows.js'
import serviceRequestCommandsRouter from './serviceRequestCommands.js'
import workGroupTeamsRouter from './workGroupTeams.js'
import { crudRouter } from './crudFactory.js'
import inventoryStockRouter from './inventoryStock.js'
import attachmentsRouter from './attachments.js'
import supplyChainRouter from './supplyChain.js'
import overviewRouter from './overview.js'
import { getPermissionCacheStats, requireAuth, requirePermission } from '../middleware/auth.js'
import { getPool, getPoolStats } from '../db/pool.js'
import { getPmSchedulerRuntime, getPmSchedulerStatus, runPmSchedulerOnce } from '../services/pmScheduler.js'
import { importPreventiveMaintenanceMasters, preparePmScheduleRuleCreate, preparePmScheduleRuleUpdate, preparePreventiveMaintenanceCreate, preparePreventiveMaintenanceUpdate } from '../services/pmMaster.js'
import { sendEmailNotification } from '../services/emailSender.js'
import { encryptSecret } from '../services/secretVault.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getRealtimeStats } from '../realtime.js'
import { getRuntimeMetrics } from '../services/runtimeMetrics.js'
import { prepareWorkOrderCreate, validateWorkOrderUpdate } from '../services/workOrderWorkflow.js'
import { prepareServiceRequestCreate, validateServiceRequestUpdate } from '../services/applicationWorkflows.js'
import { validateAssetSystem, validateLaborRouting, validatePlannedLaborAssignment, validateWorkGroupMaster, validateWorkOrderRouting } from '../services/routingMasters.js'
import { addScopeWhere, applyScopeDefaults, assertPayloadWithinScope } from '../middleware/scope.js'
import { bindParams } from '../utils/sqlParams.js'

const router = Router()
const ownerColumn = 'created_by_user_id'
const departmentScope = { siteColumn: 'site_code', departmentColumn: 'department_name' }
const workOrderScope = {
  ...departmentScope,
  departmentColumns: ['assigned_department_name'],
  subDepartmentColumn: 'sub_department_code'
}
const preventiveMaintenanceScope = { ...departmentScope, subDepartmentColumn: 'sub_department_code' }

const validateWorkOrderCommandUpdate = async context => {
  const currentStatus = String(context.current?.status || '').trim().toUpperCase()
  const nextStatus = String(context.payload?.status || '').trim().toUpperCase()
  if (nextStatus === 'CAN' && currentStatus !== 'CAN') {
    const error = new Error('Use the work-order cancellation command so linked reservations, requisitions, and orders are cancelled atomically.')
    error.status = 409
    error.code = 'CommandRequired'
    throw error
  }
  const workflowPayload = await validateWorkOrderUpdate(context)
  return validateWorkOrderRouting({ ...context, payload: workflowPayload })
}
const prepareWorkOrderCreateWithRouting = async context => {
  const workflowPayload = await prepareWorkOrderCreate(context)
  return validateWorkOrderRouting({ ...context, payload: workflowPayload })
}
const ownedSource = ({ table, key, payloadKey, scope = departmentScope }) => ({
  table,
  key,
  payloadKey,
  ownerColumn,
  scope: { ...scope, ownerColumn }
})
const workOrderOwnerSource = ownedSource({
  table: 'dbo.work_orders',
  key: 'work_order_num',
  payloadKey: 'work_order_num',
  scope: workOrderScope
})
const normalizedStatus = value => String(value || '').trim().toUpperCase()
const statusTransitionPermission = ({ approve = [], close = [] } = {}) => ({ payload, current }) => {
  if (!Object.hasOwn(payload, 'status')) return null
  const previous = normalizedStatus(current?.status)
  const next = normalizedStatus(payload.status)
  if (!next || next === previous) return null
  if (close.includes(next)) return 'close'
  if (approve.includes(next)) return 'approve'
  return null
}
const workOrderUpdatePermission = context => {
  const holds = ['HOLD', 'ON_HOLD_MATERIAL', 'ON_HOLD_PERMIT']
  const action = statusTransitionPermission({ approve: holds, close: ['CLOSE', 'CAN'] })(context)
  if (action) return action
  const previous = normalizedStatus(context.current?.status)
  const next = normalizedStatus(context.payload?.status)
  return holds.includes(previous) && next && next !== previous ? 'approve' : null
}
const purchaseRequestUpdatePermission = statusTransitionPermission({ approve: ['APPR'], close: ['CLOSE'] })
const purchaseOrderUpdatePermission = statusTransitionPermission({ approve: ['APPR'], close: ['CLOSE'] })
const serviceRequestUpdatePermission = ({ payload, current }) => {
  const converted = payload.converted_work_order_num && payload.converted_work_order_num !== current?.converted_work_order_num
  const closed = normalizedStatus(payload.status) === 'CLOSED' && normalizedStatus(current?.status) !== 'CLOSED'
  if (closed) return 'close'
  return converted ? 'approve' : null
}

const testTcpConnection = ({ host, port, secure }) => new Promise((resolve, reject) => {
  const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port })
  const done = (error, result) => {
    socket.removeAllListeners()
    socket.destroy()
    error ? reject(error) : resolve(result)
  }
  socket.setTimeout(8000)
  if (secure) {
    socket.once('secureConnect', () => done(null, { ok: true, message: `TLS connected to ${host}:${port}.` }))
  } else {
    socket.once('connect', () => done(null, { ok: true, message: `Connected to ${host}:${port}.` }))
  }
  socket.once('timeout', () => done(new Error(`Connection to ${host}:${port} timed out.`)))
  socket.once('error', error => done(error))
})

const testHttpEndpoint = endpoint => new Promise((resolve, reject) => {
  const target = new URL(/^https?:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`)
  const client = target.protocol === 'http:' ? http : https
  const request = client.request(target, { method: 'GET', timeout: 8000 }, response => {
    response.resume()
    resolve({ ok: response.statusCode < 500, message: `Endpoint responded with HTTP ${response.statusCode}.` })
  })
  request.once('timeout', () => {
    request.destroy(new Error(`Connection to ${target.host} timed out.`))
  })
  request.once('error', reject)
  request.end()
})

const normalizeSmtpHost = value => {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return new URL(text).hostname
  return text.split('/')[0].split(':')[0].trim()
}

router.get('/health', asyncHandler(async (req, res) => {
  let database = getPoolStats()
  let databaseError = ''
  if (String(req.query.deep || '') === '1') {
    try {
      const pool = await getPool()
      await pool.request().query('select 1 as healthy')
      database = getPoolStats()
    } catch (error) {
      databaseError = error.message
    }
  }
  const ok = !databaseError
  res.status(ok ? 200 : 503).json({
    ok,
    service: 'backendCafm',
    database: { ...database, ...(databaseError ? { error: databaseError } : {}) },
    realtime: getRealtimeStats(),
    scheduler: getPmSchedulerRuntime(),
    permissionCache: getPermissionCacheStats(),
    runtime: getRuntimeMetrics()
  })
}))
router.use('/auth', authRouter)
router.use(requireAuth)

router.use('/attachments', attachmentsRouter)
router.use('/supply-chain', supplyChainRouter)
router.use('/overview-snapshot', overviewRouter)

router.get('/pm-scheduler/status', requirePermission('Preventive Maintenance', 'edit'), async (req, res, next) => {
  try {
    res.json(await getPmSchedulerStatus())
  } catch (error) {
    next(error)
  }
})

router.post('/pm-scheduler/run', requirePermission('Preventive Maintenance', 'edit'), async (req, res, next) => {
  try {
    const generated = await runPmSchedulerOnce()
    res.json({ generatedCount: generated.length, generated })
  } catch (error) {
    next(error)
  }
})

router.post('/notifications/send-email', requirePermission('Work Orders', 'edit'), asyncHandler(async (req, res) => {
  const result = await sendEmailNotification({
    connectorName: req.body.connectorName,
    recipients: req.body.recipients,
    subject: req.body.subject,
    text: req.body.text
  })
  res.json({ ok: true, ...result })
}))

router.use('/sites', crudRouter({
  moduleName: 'Sites',
  table: 'dbo.sites',
  key: 'site_code',
  columns: ['site_code', 'site_name', 'region', 'city', 'status', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: null }
}))

router.use('/departments', crudRouter({
  moduleName: 'Departments',
  table: 'dbo.departments',
  key: 'sub_department_code',
  columns: ['sub_department_code', 'department_name', 'description', 'status', 'created_at', 'updated_at'],
  scope: { siteColumn: null, departmentColumn: 'department_name', subDepartmentColumn: 'sub_department_code' }
}))

router.use('/systems', crudRouter({
  moduleName: 'Routing Masters',
  relatedModules: ['Assets', 'Work Orders'],
  table: 'dbo.systems',
  key: 'system_code',
  columns: ['system_code', 'system_name', 'description', 'site_code', 'department_name', 'sub_department_code', 'status', 'created_at', 'updated_at'],
  defaultOrder: 'system_name, system_code',
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name', subDepartmentColumn: 'sub_department_code' }
}))

router.use('/users', usersRouter)

router.use('/roles', rolesRouter)

router.use('/assets', crudRouter({
  moduleName: 'Assets',
  table: 'dbo.assets',
  key: 'asset_num',
  columns: ['asset_num', 'description', 'location_code', 'parent_asset_num', 'department_name', 'sub_department_code', 'system_name', 'priority', 'site_code', 'status', 'model_num', 'serial_num', 'install_date', 'quantity', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' },
  beforeCreate: validateAssetSystem,
  beforeUpdate: validateAssetSystem
}))

router.use('/labor', crudRouter({
  moduleName: 'Labor',
  table: 'dbo.labor',
  key: 'labor_id',
  columns: ['labor_id', 'display_name', 'craft_code', 'craft_name', 'department_name', 'sub_department_code', 'site_code', 'work_group_code', 'availability', 'status', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' },
  beforeCreate: validateLaborRouting,
  beforeUpdate: validateLaborRouting
}))

router.use('/work-groups', workGroupTeamsRouter)

router.use('/work-groups', crudRouter({
  moduleName: 'Routing Masters',
  relatedModules: ['Work Orders', 'Labor'],
  table: 'dbo.work_groups',
  key: 'work_group_code',
  columns: ['work_group_code', 'work_group_name', 'site_code', 'department_name', 'sub_department_code', 'default_supervisor_labor_id', 'status', 'created_at', 'updated_at'],
  defaultOrder: 'work_group_name, work_group_code',
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name', subDepartmentColumn: 'sub_department_code' },
  beforeCreate: validateWorkGroupMaster,
  beforeUpdate: validateWorkGroupMaster
}))

router.use('/locations', crudRouter({
  moduleName: 'Locations',
  table: 'dbo.locations',
  key: 'location_code',
  columns: ['location_code', 'description', 'location_type', 'status', 'priority', 'priority_description', 'site_code', 'building', 'building_category', 'department_name', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: 'department_name' }
}))

router.use('/materials', crudRouter({
  moduleName: 'Materials',
  table: 'dbo.materials',
  key: 'item_code',
  columns: ['item_code', 'description', 'category', 'unit_of_measure', 'status', 'created_at', 'updated_at']
}))

router.use('/tools-equipment', crudRouter({
  moduleName: 'Tools & Equipment',
  table: 'dbo.tools_equipment',
  key: 'tool_code',
  columns: ['tool_code', 'description', 'category', 'location_code', 'site_code', 'quantity', 'low_level', 'status', 'inspection_due', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: null }
}))

router.use('/failure-library', crudRouter({
  moduleName: 'Failure Library',
  table: 'dbo.failure_library',
  key: 'failure_library_id',
  columns: ['failure_library_id', 'failure_class_id', 'description', 'problem_code', 'problem_description', 'cause_code', 'cause_description', 'remedy_code', 'remedy_description', 'created_at', 'updated_at'],
  defaultOrder: 'failure_class_id, problem_code, cause_code, remedy_code'
}))

router.use('/storerooms', crudRouter({
  moduleName: 'Stores',
  table: 'dbo.storerooms',
  key: 'store_code',
  columns: ['store_code', 'store_name', 'site_code', 'status', 'created_at', 'updated_at'],
  scope: { siteColumn: 'site_code', departmentColumn: null }
}))

router.use('/inventory-stock', inventoryStockRouter)

router.use('/work-order-workflow', workOrderWorkflowRouter)
router.use('/application-workflows', applicationWorkflowsRouter)

router.get('/work-order-summary', requirePermission('Work Orders', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const scoped = addScopeWhere({ user: req.user, ...workOrderScope, ownerColumn })
  const result = await bindParams(pool.request(), scoped.params).query(`
    select coalesce(nullif(work_type, ''), 'Other') as work_type, count_big(1) as total
    from dbo.work_orders
    where 1 = 1${scoped.where}
    group by coalesce(nullif(work_type, ''), 'Other')
  `)
  const byType = Object.fromEntries(result.recordset.map(row => [row.work_type, Number(row.total)]))
  res.json({ total: Object.values(byType).reduce((sum, count) => sum + count, 0), byType })
}))

router.use('/work-orders', crudRouter({
  moduleName: 'Work Orders',
  relatedModules: ['Overview', 'Job Requests', 'Preventive Maintenance', 'Meters'],
  table: 'dbo.work_orders',
  key: 'work_order_num',
  columns: ['work_order_num', 'description', 'long_description', 'location_code', 'asset_num', 'status', 'work_type', 'priority', 'site_code', 'department_name', 'sub_department_code', 'assigned_department_name', 'work_group', 'system_name', 'supervisor', 'labor_craft_code', 'target_start_at', 'target_finish_at', 'actual_start_at', 'actual_finish_at', 'completed_at', 'closed_at', 'closed_by_user_id', 'closed_by_name', 'reported_at', 'source_sr_num', 'pm_num', 'pm_cycle', 'job_plan_num', 'schedule_rule_name', 'failure_code', 'problem_code', 'cause_code', 'remedy_code', 'ptw_required', 'technician_remarks', 'completion_notes', 'actual_labor', 'actual_hours', 'actual_materials_json', 'actual_tools_json', 'held_from_status', 'hold_periods_json', 'estimated_duration_minutes', 'safety_instructions', 'checklist_json', 'created_by_user_id', 'created_at', 'updated_at'],
  defaultOrder: 'reported_at desc, work_order_num desc',
  defaultPageSize: 100,
  scope: workOrderScope,
  ownerColumn,
  ownerSources: [ownedSource({ table: 'dbo.service_requests', key: 'sr_num', payloadKey: 'source_sr_num', scope: workOrderScope })],
  beforeCreate: prepareWorkOrderCreateWithRouting,
  beforeUpdate: validateWorkOrderCommandUpdate,
  additionalUpdatePermission: workOrderUpdatePermission,
  hasTriggers: true,
  searchColumns: ['work_order_num', 'description', 'long_description', 'location_code', 'asset_num', 'status', 'work_type', 'site_code', 'department_name', 'assigned_department_name', 'sub_department_code', 'source_sr_num', 'failure_code', 'problem_code'],
  filterGroups: { department: ['department_name', 'assigned_department_name', 'sub_department_code'] },
  prefixFilters: { locationPrefix: 'location_code' },
  dateFilterColumn: 'reported_at'
}))

router.use('/work-order-resource-requests', crudRouter({
  moduleName: 'Work Orders',
  relatedModules: ['Stores', 'Materials', 'Tools & Equipment', 'Purchase Requisitions', 'Reservations'],
  table: 'dbo.work_order_resource_requests',
  key: 'resource_request_id',
  columns: ['resource_request_id', 'work_order_num', 'resource_type', 'item_code', 'item_description', 'requested_quantity', 'available_quantity', 'store_code', 'site_code', 'department_name', 'source_type', 'availability_status', 'request_status', 'transaction_ref', 'purchase_request_num', 'purchase_order_num', 'reservation_num', 'supply_chain_status', 'created_by_user_id', 'created_at', 'updated_at'],
  scope: departmentScope,
  ownerColumn,
  ownerSources: [workOrderOwnerSource]
}))

router.use('/work-order-planned-labor', crudRouter({
  moduleName: 'Work Order Planning',
  relatedModules: ['Work Orders', 'Labor'],
  table: 'dbo.work_order_planned_labor',
  key: 'planned_labor_id',
  columns: ['planned_labor_id', 'work_order_num', 'line_order', 'craft_name', 'estimated_hours', 'assigned_crew', 'site_code', 'department_name', 'created_by_user_id', 'created_at', 'updated_at'],
  scope: departmentScope,
  ownerColumn,
  ownerSources: [workOrderOwnerSource],
  beforeCreate: validatePlannedLaborAssignment,
  beforeUpdate: validatePlannedLaborAssignment
}))

router.use('/work-order-tasks', crudRouter({
  moduleName: 'Work Orders',
  table: 'dbo.work_order_tasks',
  key: 'work_order_task_id',
  columns: ['work_order_task_id', 'work_order_num', 'task_sequence', 'task_description', 'duration_minutes', 'site_code', 'department_name', 'created_by_user_id', 'created_at', 'updated_at'],
  scope: departmentScope,
  ownerColumn,
  ownerSources: [workOrderOwnerSource]
}))

router.use('/service-requests', serviceRequestCommandsRouter)
router.use('/service-requests', crudRouter({
  moduleName: 'Job Requests',
  relatedModules: ['Overview', 'Work Orders'],
  table: 'dbo.service_requests',
  key: 'sr_num',
  columns: ['sr_num', 'description', 'long_description', 'site_code', 'location_code', 'asset_num', 'department_name', 'sub_department_code', 'assigned_department_name', 'reported_by', 'reported_at', 'priority', 'request_type', 'failure_code', 'problem_code', 'status', 'converted_work_order_num', 'created_by_user_id', 'created_at', 'updated_at'],
  defaultOrder: 'reported_at desc, sr_num desc',
  scope: workOrderScope,
  ownerColumn,
  additionalUpdatePermission: serviceRequestUpdatePermission,
  beforeCreate: prepareServiceRequestCreate,
  beforeUpdate: validateServiceRequestUpdate
}))

router.use('/purchase-requisitions', crudRouter({
  moduleName: 'Purchase Requisitions',
  relatedModules: ['Work Orders', 'Stores', 'Materials', 'Tools & Equipment', 'Purchase Orders'],
  table: 'dbo.purchase_requisitions',
  key: 'pr_num',
  columns: ['pr_num', 'work_order_num', 'resource_request_id', 'request_type', 'item_code', 'item_description', 'requested_quantity', 'planned_quantity', 'available_quantity', 'store_code', 'site_code', 'department_name', 'status', 'po_num', 'created_by_user_id', 'created_at', 'approved_at', 'closed_at', 'cancelled_at', 'updated_at'],
  defaultOrder: 'created_at desc, pr_num desc',
  scope: departmentScope,
  ownerColumn,
  ownerSources: [workOrderOwnerSource, ownedSource({ table: 'dbo.work_order_resource_requests', key: 'resource_request_id', payloadKey: 'resource_request_id' })],
  additionalUpdatePermission: purchaseRequestUpdatePermission,
  readOnly: true
}))

router.use('/purchase-orders', crudRouter({
  moduleName: 'Purchase Orders',
  relatedModules: ['Work Orders', 'Stores', 'Materials', 'Tools & Equipment', 'Purchase Requisitions', 'Reservations'],
  table: 'dbo.purchase_orders',
  key: 'po_num',
  columns: ['po_num', 'pr_num', 'work_order_num', 'resource_request_id', 'request_type', 'item_code', 'item_description', 'ordered_quantity', 'store_code', 'site_code', 'department_name', 'status', 'created_by_user_id', 'created_at', 'approved_at', 'received_at', 'closed_at', 'cancelled_at', 'updated_at'],
  defaultOrder: 'created_at desc, po_num desc',
  scope: departmentScope,
  ownerColumn,
  ownerSources: [workOrderOwnerSource, ownedSource({ table: 'dbo.purchase_requisitions', key: 'pr_num', payloadKey: 'pr_num' })],
  additionalUpdatePermission: purchaseOrderUpdatePermission,
  readOnly: true
}))

router.use('/reservations', crudRouter({
  moduleName: 'Reservations',
  relatedModules: ['Work Orders', 'Stores', 'Materials', 'Tools & Equipment'],
  table: 'dbo.inventory_reservations',
  key: 'reservation_num',
  columns: ['reservation_num', 'work_order_num', 'resource_request_id', 'pr_num', 'po_num', 'request_type', 'item_code', 'item_description', 'reserved_quantity', 'arranged_quantity', 'released_quantity', 'delivered_quantity', 'store_code', 'site_code', 'department_name', 'status', 'created_by_user_id', 'created_at', 'updated_at'],
  defaultOrder: 'created_at desc, reservation_num desc',
  scope: departmentScope,
  ownerColumn,
  ownerSources: [workOrderOwnerSource, ownedSource({ table: 'dbo.purchase_requisitions', key: 'pr_num', payloadKey: 'pr_num' }), ownedSource({ table: 'dbo.purchase_orders', key: 'po_num', payloadKey: 'po_num' })],
  readOnly: true
}))

router.post('/preventive-maintenance/import', requirePermission('Preventive Maintenance', 'import'), asyncHandler(async (req, res) => {
  const sourceRows = Array.isArray(req.body?.rows) ? req.body.rows : []
  const scopedRows = sourceRows.map(payload => {
    const scoped = applyScopeDefaults({ user: req.user, payload, ...preventiveMaintenanceScope })
    assertPayloadWithinScope({ user: req.user, payload: scoped, ...preventiveMaintenanceScope, requireValues: true })
    return scoped
  })
  const pool = await getPool()
  const imported = await importPreventiveMaintenanceMasters({
    pool,
    rows: scopedRows,
    userId: req.user?.userId
  })
  req.app.locals.broadcastWorkspaceChange?.({
    moduleName: 'Preventive Maintenance',
    relatedModules: ['Overview', 'PM Schedule Rules', 'Work Orders'],
    table: 'dbo.preventive_maintenance',
    action: 'import',
    count: imported.length
  })
  res.json({ importedCount: imported.length, pmNumbers: imported })
}))

router.use('/preventive-maintenance', crudRouter({
  moduleName: 'Preventive Maintenance',
  relatedModules: ['Overview', 'PM Schedule Rules', 'Work Orders'],
  table: 'dbo.preventive_maintenance',
  key: 'pm_num',
  columns: ['pm_num', 'description', 'asset_num', 'route_code', 'location_code', 'job_plan_num', 'next_date', 'lead_time_days', 'frequency', 'frequency_unit', 'schedule_rule_name', 'pm_counter', 'work_type', 'wo_status', 'store_code', 'supervisor', 'lead_person', 'person_group', 'site_code', 'department_name', 'sub_department_code', 'pm_status', 'last_generated_cycle', 'created_by_user_id', 'created_at', 'updated_at'],
  defaultOrder: 'next_date, pm_num',
  scope: preventiveMaintenanceScope,
  ownerColumn,
  beforeCreate: preparePreventiveMaintenanceCreate,
  beforeUpdate: preparePreventiveMaintenanceUpdate
}))

router.use('/pm-schedule-rules', crudRouter({
  moduleName: 'PM Schedule Rules',
  relatedModules: ['Preventive Maintenance'],
  table: 'dbo.pm_schedule_rules',
  key: 'rule_name',
  columns: ['rule_name', 'frequency', 'frequency_unit', 'lead_time_days', 'horizon_days', 'trigger_hour', 'wo_prefix', 'default_wo_status', 'notes', 'status', 'created_at', 'updated_at'],
  beforeCreate: preparePmScheduleRuleCreate,
  beforeUpdate: preparePmScheduleRuleUpdate
}))

router.post('/smtp-sms-connectors/:id/test', requirePermission('SMTP & SMS', 'edit'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const result = await pool.request()
    .input('id', req.params.id)
    .query(`
      select top 1 connector_name, connector_type, host_endpoint, port, encryption, username_value, sender_value, status
      from dbo.smtp_sms_connectors
      where connector_name = @id
    `)
  const connector = result.recordset[0]
  if (!connector) return res.status(404).json({ error: 'NotFound', message: 'Connector not found' })
  if (String(connector.status || '').toLowerCase() === 'inactive') {
    return res.status(400).json({ error: 'InactiveConnector', message: 'Connector is inactive.' })
  }

  const rawHost = String(connector.host_endpoint || '').trim()
  if (!rawHost) return res.status(400).json({ error: 'MissingHost', message: 'Host / Endpoint is required before testing.' })

  const type = String(connector.connector_type || '').toUpperCase()
  const isSmtp = type === 'SMTP' || type === 'EMAIL'
  const host = isSmtp ? normalizeSmtpHost(rawHost) : rawHost
  const port = Number(connector.port) || (String(connector.encryption || '').toUpperCase() === 'SSL' ? 465 : 587)
  const startedAt = Date.now()
  let test
  try {
    test = isSmtp
      ? await testTcpConnection({ host, port, secure: String(connector.encryption || '').toUpperCase() === 'SSL' })
      : await testHttpEndpoint(host)
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: 'ConnectionTestFailed',
      message: error.message || 'Connection test failed.',
      connectorName: connector.connector_name,
      connectorType: connector.connector_type,
      elapsedMs: Date.now() - startedAt
    })
  }

  res.json({
    ...test,
    connectorName: connector.connector_name,
    connectorType: connector.connector_type,
    elapsedMs: Date.now() - startedAt
  })
}))

router.use('/smtp-sms-connectors', crudRouter({
  moduleName: 'SMTP & SMS',
  table: 'dbo.smtp_sms_connectors',
  key: 'connector_name',
  columns: ['connector_name', 'connector_type', 'host_endpoint', 'port', 'encryption', 'username_value', 'secret_value', 'sender_value', 'notes', 'status', 'created_at', 'updated_at'],
  beforeCreate: ({ payload }) => ({
    ...payload,
    secret_value: encryptSecret(payload.secret_value)
  }),
  beforeUpdate: ({ payload }) => {
    if (!String(payload.secret_value || '').trim()) delete payload.secret_value
    else payload.secret_value = encryptSecret(payload.secret_value)
    return payload
  },
  transformResponse: row => {
    const { secret_value: secretValue, ...safeRow } = row
    return { ...safeRow, secret_configured: Boolean(secretValue) }
  }
}))

router.use('/notification-rules', crudRouter({
  moduleName: 'Settings',
  relatedModules: ['SMTP & SMS', 'Work Orders'],
  table: 'dbo.notification_rules',
  key: 'rule_id',
  columns: ['rule_id', 'event_name', 'channel_name', 'recipients', 'notes', 'status', 'created_at', 'updated_at'],
  defaultOrder: 'created_at desc, rule_id'
}))

router.use('/job-plans', crudRouter({
  moduleName: 'Job Plans',
  table: 'dbo.job_plans',
  key: 'job_plan_num',
  columns: ['job_plan_num', 'description', 'status', 'estimated_duration_minutes', 'required_labor_json', 'required_materials_json', 'required_tools_json', 'safety_instructions', 'checklist_json', 'created_at', 'updated_at']
}))

router.use('/job-plan-tasks', crudRouter({
  moduleName: 'Job Plans',
  table: 'dbo.job_plan_tasks',
  key: 'job_plan_task_id',
  columns: ['job_plan_task_id', 'job_plan_num', 'task_sequence', 'task_description', 'duration_hours']
}))

router.use('/incidents', crudRouter({
  moduleName: 'Incidents',
  relatedModules: ['Overview'],
  table: 'dbo.incidents',
  key: 'incident_num',
  columns: ['incident_num', 'description', 'site_code', 'location_code', 'asset_num', 'department_name', 'severity', 'status', 'reported_by', 'reported_at', 'created_by_user_id', 'created_at', 'updated_at'],
  defaultOrder: 'reported_at desc, incident_num desc',
  scope: departmentScope,
  ownerColumn
}))

router.use('/meter-readings', crudRouter({
  moduleName: 'Meters',
  relatedModules: ['Work Orders', 'Assets'],
  table: 'dbo.meter_readings',
  key: 'meter_reading_id',
  columns: ['meter_reading_id', 'meter_id', 'asset_num', 'work_order_num', 'site_code', 'department_name', 'reading_value', 'reading_unit', 'reading_at', 'created_by_user_id', 'created_at'],
  defaultOrder: 'reading_at desc, meter_reading_id desc',
  scope: departmentScope,
  ownerColumn,
  ownerSources: [workOrderOwnerSource]
}))

export default router
