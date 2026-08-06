import { useEffect, useMemo, useRef, useState } from 'react'
import { lazy, Suspense, useCallback } from 'react'
import LoginPage from './pages/LoginPage'
import AppShell from './components/layout/AppShell'
import JobPlanDetailPage from './components/job-plans/JobPlanDetailPage'
import FailureLibraryDetailPage from './components/failure-library/FailureLibraryDetailPage'
import WorkOrderDocumentsTab from './components/work-orders/WorkOrderDocumentsTab'
import WorkOrderPrintReport from './components/work-orders/WorkOrderPrintReport'
import WorkOrderPlanTab from './components/work-orders/WorkOrderPlanTab'
import WorkOrderActualTab from './components/work-orders/WorkOrderActualTab'
import WorkOrderFailureTab from './components/work-orders/WorkOrderFailureTab'
import WorkOrderMaterialRequestsTab from './components/work-orders/WorkOrderMaterialRequestsTab'
import WorkOrderOverviewTab from './components/work-orders/WorkOrderOverviewTab'
import WorkOrderMetersTab from './components/work-orders/WorkOrderMetersTab'
import WorkOrderHeader, { workOrderOutlineButtonClass, workOrderPrimaryButtonClass } from './components/work-orders/WorkOrderHeader'
import WorkOrderTabs from './components/work-orders/WorkOrderTabs'
import WorkOrderDatesBar from './components/work-orders/WorkOrderDatesBar'
import { AlertTriangle, Clock, ClipboardList, FileText, Hash, HelpCircle, ListChecks, ListOrdered, ShieldCheck, Wrench } from 'lucide-react'
import { pathWithRecordFilter } from './lib/recordNavigation'
import AppState from './components/ui/AppState'
import Alert from './components/ui/Alert'
import Toast from './components/ui/Toast'
import { navigationItems, pathForPage, routeToPage } from './config/navigation'
import { departments, excelDate, slaBreached, statusMatrix, toDateTimeInput } from './config/runtimeDefaults'
import { useAuth } from './providers/AuthProvider'
import { nowLocalDateTime } from './lib/datetime'
import { printWithoutBrowserTitle } from './lib/print'
import { sameDepartment, systemNamesForDepartment, workGroupsForDepartment } from './lib/departments'
import { storeLabel, storesHolding, totalAvailable } from './lib/inventory'
import { readProjectName } from './lib/projectSettings'
import { canTransitionWorkOrder, statusCode, statusDescription, statusOptions, workOrderTransitions } from './lib/statusMatrix'
import { HOLD_MATERIAL, HOLD_PERMIT, effectiveTargetTime, endHold, holdSince, isOnHold, startHold } from './lib/holdPeriods'
import { describeOutstanding, markReturned, outstandingReturns } from './lib/resourceReturns'
import { canUseAction, canViewPage, filterNavigationForUser, firstAllowedPage, scopeRowsForUser } from './lib/accessControl'
import { failureClassOptions, jobPlanOptions } from './lib/masterOptions'
import { deriveDepartmentOptions, deriveSiteOptions } from './lib/referenceFallbacks'
import { api, loadWorkspace, loadWorkOrderDetail, loadWorkOrderPage, serviceRequestApi, supplyChainApi } from './services/api'
import { subscribeWorkspaceChanges } from './services/realtime'
import useEntityAttachments from './hooks/useEntityAttachments'
import useRelatedWorkOrders from './hooks/useRelatedWorkOrders'
import { resourcesForPage, resourcesForWorkspaceChange, workOrderChildTables } from './config/workspaceResources'
import {
  DEFAULT_WORK_ORDER_WORKFLOW,
  mapWorkOrderWorkflow,
  normalizeWorkOrderWorkflow,
  workOrderWorkflowToApi,
  workflowHasRequirement,
  workflowNextStep as getWorkflowNextStep,
  workflowPreviousStep as getWorkflowPreviousStep,
  workflowRequirementsForStatus,
  workflowStatusLabel,
  workflowStatusOptions,
  workflowStepByStatus,
  workflowAutoTarget
} from './lib/workOrderWorkflow'
import {
  DEFAULT_APPLICATION_WORKFLOWS,
  applicationWorkflowToApi,
  normalizeApplicationWorkflow
} from './lib/applicationWorkflow'
import { pmWorkOrderStatusLabel } from './lib/pmGeneration'

const ServiceRequestsPage = lazy(() => import('./pages/ServiceRequestsPage'))
const WorkOrdersPage = lazy(() => import('./pages/WorkOrdersPage'))
const LaborPage = lazy(() => import('./pages/LaborPage'))
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'))
const StoresPage = lazy(() => import('./pages/StoresPage'))
const ToolsPage = lazy(() => import('./pages/ToolsPage'))
const PreventiveMaintenancePage = lazy(() => import('./pages/PreventiveMaintenancePage'))
const AssetsPage = lazy(() => import('./pages/AssetsPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const LocationsPage = lazy(() => import('./pages/LocationsPage'))
const OverviewPage = lazy(() => import('./pages/OverviewPage'))
const NotificationsSettingsPage = lazy(() => import('./pages/NotificationsSettingsPage'))
const ConnectorsSettingsPage = lazy(() => import('./pages/ConnectorsSettingsPage'))
const PmRulesSettingsPage = lazy(() => import('./pages/PmRulesSettingsPage'))
const WorkOrderWorkflowSettingsPage = lazy(() => import('./pages/WorkOrderWorkflowSettingsPage'))
const IncidentsPage = lazy(() => import('./pages/IncidentsPage'))
const RolesPermissionsPage = lazy(() => import('./pages/RolesPermissionsPage'))
const MetersPage = lazy(() => import('./pages/MetersPage'))
const PurchaseRequestsPage = lazy(() => import('./pages/PurchaseRequestsPage'))
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'))
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SitesSettingsPage = lazy(() => import('./pages/SitesSettingsPage'))
const DepartmentsSettingsPage = lazy(() => import('./pages/DepartmentsSettingsPage'))


const buildWorkOrderNotifications = rows => {
  const now = Date.now()
  const upcomingWindow = now + 30 * 24 * 60 * 60 * 1000
  return rows
    .map(order => {
      const target = toDateTimeInput(order['TARGET FINISH ']) || toDateTimeInput(order['TARGET START '])
      const rawDue = target ? new Date(target).getTime() : null
      if (!rawDue) return null
      const closed = ['COMP', 'COMPLETED', 'CLOSE', 'CLOSED'].includes(String(order.STATUS || '').toUpperCase())
      if (closed) return null
      // A job waiting on stock is not late - its clock is stopped, so it is reported as
      // paused rather than counted against the SLA.
      if (isOnHold(order)) return {
        type: 'paused',
        workOrder: order.WORKORDER,
        description: order['DESCRIPITION '] || order.DESCRIPTION || 'Work order',
        message: `SLA Paused – awaiting material since ${new Date(holdSince(order)).toLocaleString()}.`
      }
      // Time already spent on hold is given back before judging lateness.
      const due = effectiveTargetTime(rawDue, order, now)
      if (due < now) return {
        type: 'overdue',
        workOrder: order.WORKORDER,
        description: order['DESCRIPITION '] || order.DESCRIPTION || 'Work order',
        message: `Target date passed on ${new Date(due).toLocaleString()}. SLA Met? No – SLA Breached.`
      }
      if (due <= upcomingWindow) return {
        type: 'upcoming',
        workOrder: order.WORKORDER,
        description: order['DESCRIPITION '] || order.DESCRIPTION || 'Work order',
        message: `Target date is ${new Date(due).toLocaleString()}.`
      }
      return null
    })
    .filter(Boolean)
}


const workOrderTabs = ['Overview', 'Plan', 'Failure', 'Material Requests', 'PTW & Files', 'Meters', 'Actual']
const workOrderBodyClass = 'grid gap-3 p-0'
const toLocationPriority = value => {
  const text = String(value || '').trim()
  if (text.startsWith('1') || text === 'Emergency') return 1
  if (text.startsWith('2') || text === 'High') return 2
  return 3
}
const maximoWorkOrderStatusDescriptions = new Proxy({}, { get: (_, status) => statusDescription('workOrder', status) })
const workOrderHoldStatuses = ['HOLD', HOLD_MATERIAL, HOLD_PERMIT]
const workOrderDisplayStatus = (isPM, workflow, status) => {
  const fallback = workflowStatusLabel(workflow, status) || maximoWorkOrderStatusDescriptions[status] || status
  return isPM ? pmWorkOrderStatusLabel(status, fallback) : fallback
}
const splitNotificationRecipients = value => {
  const source = Array.isArray(value) ? value.join(',') : String(value || '')
  return source.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean)
}
const notificationEventForWorkOrderStatus = status => {
  const code = String(status || '').toUpperCase()
  if (workOrderHoldStatuses.includes(code)) return 'Work order on hold'
  return ''
}
const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const splitPlanList = value => String(value || '').split(/[;\n]+/).map(cleanText).filter(Boolean)
const uniquePlanRows = (rows, keyFor) => [...new Map(rows.map(row => [keyFor(row), row]).filter(([key]) => key)).values()]
const jobPlanPackageFromRows = rows => ({
  requiredLabor: uniquePlanRows(rows
    .filter(row => cleanText(row['LABOR CRAFT']) && Number(row['LABOR HOURS']) > 0)
    .map((row, index) => ({ lineOrder: index + 1, craft: cleanText(row['LABOR CRAFT']), hours: Number(row['LABOR HOURS']), crew: cleanText(row['ASSIGNED CREW']) })), row => `${row.craft.toLowerCase()}|${row.hours}|${row.crew.toLowerCase()}`),
  requiredMaterials: uniquePlanRows(rows
    .filter(row => cleanText(row['MATERIAL CODE'] || row['MATERIAL DESCRIPTION']) && Number(row['MATERIAL QTY']) > 0)
    .map(row => ({ itemCode: cleanText(row['MATERIAL CODE']), description: cleanText(row['MATERIAL DESCRIPTION']), quantity: Number(row['MATERIAL QTY']), storeCode: cleanText(row['MATERIAL STORE']) })), row => `${row.itemCode.toLowerCase()}|${row.description.toLowerCase()}|${row.storeCode.toLowerCase()}`),
  requiredTools: uniquePlanRows(rows
    .filter(row => cleanText(row['TOOL CODE'] || row['TOOL DESCRIPTION']) && Number(row['TOOL QTY']) > 0)
    .map(row => ({ itemCode: cleanText(row['TOOL CODE']), description: cleanText(row['TOOL DESCRIPTION']), quantity: Number(row['TOOL QTY']), storeCode: cleanText(row['TOOL STORE']) })), row => `${row.itemCode.toLowerCase()}|${row.description.toLowerCase()}|${row.storeCode.toLowerCase()}`),
  safetyInstructions: [...new Set(rows.flatMap(row => splitPlanList(row['SAFETY INSTRUCTIONS'])))].join('\n'),
  checklist: [...new Set(rows.flatMap(row => splitPlanList(row['CHECKLIST ITEM'] || row.CHECKLIST)))]
})
let pendingReferenceCounter = 0
const pendingReference = prefix => `${prefix}-PENDING-${Date.now().toString(36)}-${++pendingReferenceCounter}`
const upsertLocalRecord = (rows, record, key) => {
  if (!record) return rows
  const value = String(record[key] ?? '')
  return [record, ...rows.filter(row => String(row[key] ?? '') !== value)]
}
const toNumberOrNull = value => value === '' || value === null || value === undefined ? null : Number(value)
const toDateOrNull = value => {
  if (value === '' || value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = String(value).trim()
  if (!text || text === '-' || /^invalid date$/i.test(text)) return null
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text)
  return Number.isNaN(date.getTime()) ? null : date
}
const toText = value => String(value ?? '').trim()
const statusText = (value, fallback = 'Active') => toText(value) || fallback
const actualResourceMetadata = rows => (Array.isArray(rows) ? rows : []).map(row => ({
  ...row,
  actualQuantity: row.actualQuantity ?? '',
  returned: Boolean(row.returned),
  returnedQuantity: Number(row.returnedQuantity || 0),
  returnedAt: Number(row.returnedAt || 0)
}))
const uniquePermissions = permissions => Object.fromEntries(
  Object.entries(permissions || {}).map(([action, modules]) => [
    action,
    [...new Set((Array.isArray(modules) ? modules : String(modules || '').split(/[,;|]+/)).map(item => String(item || '').trim()).filter(Boolean))]
  ])
)
const persistenceQueues = new Map()
const queuePersistence = (queueKey, task) => {
  const previous = persistenceQueues.get(queueKey) || Promise.resolve()
  const next = previous.catch(() => {}).then(task)
  const tracked = next.finally(() => {
    if (persistenceQueues.get(queueKey) === tracked) persistenceQueues.delete(queueKey)
  })
  persistenceQueues.set(queueKey, tracked)
  return tracked
}
const uniqueCodeOptions = (rows = [], codeKey, descriptionKey) => [
  ...new Map(rows
    .filter(row => cleanText(row?.[codeKey]))
    .map(row => [
      cleanText(row[codeKey]),
      { value: cleanText(row[codeKey]), label: cleanText(row[descriptionKey]) }
    ])).values()
]
const rowFingerprint = row => JSON.stringify(row || {})
const changedRows = (before = [], after = [], key) => {
  const beforeByKey = new Map(before.map(row => [toText(row?.[key]), row]).filter(([id]) => id))
  return after.filter(row => {
    const id = toText(row?.[key])
    if (!id) return true
    return rowFingerprint(beforeByKey.get(id)) !== rowFingerprint(row)
  })
}
const upsertBackendRow = async ({ endpoint, key, payload }) => {
  const cleanPayload = Object.fromEntries(Object.entries(payload || {}).filter(([, value]) => value !== undefined && value !== null))
  const saveEndpoint = cleanPayload.__endpoint || endpoint
  const saveKey = cleanPayload.__apiKey || key
  const fallbackEndpoint = cleanPayload.__fallbackEndpoint || endpoint
  const forcePost = Boolean(cleanPayload.__forcePost)
  delete cleanPayload.__endpoint
  delete cleanPayload.__apiKey
  delete cleanPayload.__fallbackEndpoint
  delete cleanPayload.__forcePost
  const id = toText(cleanPayload?.[saveKey])
  if (id && !forcePost) {
    try {
      return await api.put(`${saveEndpoint}/${encodeURIComponent(id)}`, cleanPayload)
    } catch (error) {
      if (error.status !== 404) throw error
    }
  }
  return api.post(fallbackEndpoint, cleanPayload)
}
const persistRowsToBackend = async ({ before = [], after = [], key, endpoint, apiKey, toApi }) => {
  const rows = changedRows(before, after, key)
  const savedRows = []
  for (const row of rows) {
    const id = toText(row?.[key])
    const existed = Boolean(id && before.some(existing => toText(existing?.[key]) === id))
    if (existed) await apiMappersByEndpoint[endpoint]?.beforeRow?.(row)
    const payload = toApi(row)
    const saved = await upsertBackendRow({ endpoint, key: apiKey, payload })
    await apiMappersByEndpoint[endpoint]?.afterRow?.(row, saved, { existed })
    savedRows.push(saved)
  }
  return savedRows
}
const backendSetter = (setState, config) => update => {
  let resolvePersistence
  let rejectPersistence
  const persistence = new Promise((resolve, reject) => {
    resolvePersistence = resolve
    rejectPersistence = reject
  })
  setState(current => {
    const next = typeof update === 'function' ? update(current) : update
    queuePersistence(config.endpoint, () => persistRowsToBackend({ before: current, after: Array.isArray(next) ? next : [], ...config }))
      .then(resolvePersistence)
      .catch(rejectPersistence)
    return next
  })
  return persistence
}
const safeApiList = endpoint => api.get(endpoint).catch(error => {
  if (error.status === 403 || error.status === 404) return []
  throw error
})
const workOrderChildList = (endpoint, workOrderNum) => safeApiList(`${endpoint}?work_order_num=${encodeURIComponent(workOrderNum)}&limit=500`)
const resourceNaturalKey = row => [
  row.resource_type,
  row.item_description,
  row.transaction_ref || '',
  row.source_type || ''
].map(value => String(value || '').trim()).join('|')
const comparableResourcePayload = row => ({
  work_order_num: toText(row.work_order_num),
  resource_type: row.resource_type || 'Material',
  item_code: row.item_code || null,
  item_description: toText(row.item_description),
  requested_quantity: toNumberOrNull(row.requested_quantity) || 0,
  available_quantity: toNumberOrNull(row.available_quantity) || 0,
  store_code: row.store_code || null,
  site_code: row.site_code || null,
  department_name: row.department_name || '',
  source_type: row.source_type || '',
  availability_status: row.availability_status || '',
  request_status: row.request_status || '',
  transaction_ref: row.transaction_ref || '',
  purchase_request_num: row.purchase_request_num || '',
  purchase_order_num: row.purchase_order_num || '',
  reservation_num: row.reservation_num || '',
  supply_chain_status: row.supply_chain_status || ''
})
const sameResourcePayload = (existing, payload) => rowFingerprint(comparableResourcePayload(existing)) === rowFingerprint(comparableResourcePayload(payload))
const workOrderResourcePayload = (order, resource) => ({
  ...(resource.resourceRequestId ? { resource_request_id: resource.resourceRequestId } : {}),
  work_order_num: toText(order.WORKORDER),
  resource_type: resource.type || 'Material',
  item_code: resource.itemCode || null,
  item_description: toText(resource.item || resource.description || resource.itemCode),
  requested_quantity: toNumberOrNull(resource.quantity || resource.requestedQuantity) || 0,
  available_quantity: toNumberOrNull(resource.availableQuantity) || 0,
  store_code: resource.source || resource.store || null,
  site_code: order.SITE || resource.site || null,
  department_name: order['DEPARTMENT '] || resource.department || '',
  source_type: resource.sourceType || '',
  availability_status: resource.availabilityStatus || resource.availability || '',
  request_status: resource.requestStatus || '',
  transaction_ref: resource.transactionRef || resource.purchaseRequest || resource.purchaseOrder || resource.reservation || '',
  purchase_request_num: resource.purchaseRequest || '',
  purchase_order_num: resource.purchaseOrder || '',
  reservation_num: resource.reservation || '',
  supply_chain_status: resource.supplyChainStatus || ''
})
const plannedLaborPayload = (order, labor, index) => ({
  ...(labor.plannedLaborId ? { planned_labor_id: labor.plannedLaborId } : {}),
  work_order_num: toText(order.WORKORDER),
  line_order: Number(labor.lineOrder || index + 1),
  craft_name: toText(labor.craft),
  estimated_hours: toNumberOrNull(labor.hours) || 0,
  assigned_crew: toText(labor.crew),
  site_code: order.SITE || null,
  department_name: order['DEPARTMENT '] || ''
})
const comparablePlannedLaborPayload = row => ({
  work_order_num: toText(row.work_order_num),
  line_order: Number(row.line_order || 0),
  craft_name: toText(row.craft_name),
  estimated_hours: toNumberOrNull(row.estimated_hours) || 0,
  assigned_crew: toText(row.assigned_crew),
  site_code: row.site_code || null,
  department_name: row.department_name || ''
})
const samePlannedLaborPayload = (existing, payload) => rowFingerprint(comparablePlannedLaborPayload(existing)) === rowFingerprint(comparablePlannedLaborPayload(payload))
const persistWorkOrderPlannedLabor = async order => {
  const plannedLabor = Array.isArray(order['PLANNED LABOR']) ? order['PLANNED LABOR'] : []
  const workOrderNum = toText(order.WORKORDER)
  if (!workOrderNum) return
  const existing = await workOrderChildList('/work-order-planned-labor', workOrderNum)
  const matched = new Set()
  for (const [index, labor] of plannedLabor.entries()) {
    const payload = plannedLaborPayload(order, labor, index)
    if (!payload.craft_name && !payload.assigned_crew && !payload.estimated_hours) continue
    const match = labor.plannedLaborId
      ? existing.find(row => String(row.planned_labor_id) === String(labor.plannedLaborId))
      : existing.find(row => Number(row.line_order) === Number(payload.line_order))
    if (match) {
      matched.add(String(match.planned_labor_id))
      if (!samePlannedLaborPayload(match, payload)) {
        await api.put(`/work-order-planned-labor/${encodeURIComponent(match.planned_labor_id)}`, payload)
      }
    } else {
      const saved = await api.post('/work-order-planned-labor', payload)
      if (saved?.planned_labor_id) matched.add(String(saved.planned_labor_id))
    }
  }
  for (const row of existing) {
    if (!matched.has(String(row.planned_labor_id))) {
      await api.delete(`/work-order-planned-labor/${encodeURIComponent(row.planned_labor_id)}`)
    }
  }
}
const workOrderTaskPayload = (order, task, index) => ({
  ...(task.workOrderTaskId ? { work_order_task_id: task.workOrderTaskId } : {}),
  work_order_num: toText(order.WORKORDER),
  task_sequence: toNumberOrNull(task.sequence) || (index + 1) * 10,
  task_description: toText(task.description || task['JOB TASK DESCRIPTION'] || task.DESCRIPTION),
  duration_minutes: toNumberOrNull(task.duration || task['TASK DURATION IN HOUR']) || 0,
  site_code: order.SITE || null,
  department_name: order['DEPARTMENT '] || ''
})
const comparableWorkOrderTaskPayload = row => ({
  work_order_num: toText(row.work_order_num),
  task_sequence: toNumberOrNull(row.task_sequence) || 0,
  task_description: toText(row.task_description),
  duration_minutes: toNumberOrNull(row.duration_minutes) || 0,
  site_code: row.site_code || null,
  department_name: row.department_name || ''
})
const sameWorkOrderTaskPayload = (existing, payload) => rowFingerprint(comparableWorkOrderTaskPayload(existing)) === rowFingerprint(comparableWorkOrderTaskPayload(payload))
const persistWorkOrderTasks = async order => {
  const tasks = Array.isArray(order['JOB PLAN TASKS']) ? order['JOB PLAN TASKS'] : []
  const workOrderNum = toText(order.WORKORDER)
  if (!workOrderNum) return
  const existing = await workOrderChildList('/work-order-tasks', workOrderNum)
  const matched = new Set()
  for (const [index, task] of tasks.entries()) {
    const payload = workOrderTaskPayload(order, task, index)
    if (!payload.task_description && !payload.duration_minutes) continue
    const match = task.workOrderTaskId
      ? existing.find(row => String(row.work_order_task_id) === String(task.workOrderTaskId))
      : existing.find(row => Number(row.task_sequence) === Number(payload.task_sequence))
    if (match) {
      matched.add(String(match.work_order_task_id))
      if (!sameWorkOrderTaskPayload(match, payload)) {
        await api.put(`/work-order-tasks/${encodeURIComponent(match.work_order_task_id)}`, payload)
      }
    } else {
      const saved = await api.post('/work-order-tasks', payload)
      if (saved?.work_order_task_id) matched.add(String(saved.work_order_task_id))
    }
  }
  for (const row of existing) {
    if (!matched.has(String(row.work_order_task_id))) {
      await api.delete(`/work-order-tasks/${encodeURIComponent(row.work_order_task_id)}`)
    }
  }
}
const persistWorkOrderResources = async order => {
  const resources = Array.isArray(order['PLANNED RESOURCES']) ? order['PLANNED RESOURCES'] : []
  const workOrderNum = toText(order.WORKORDER)
  if (!workOrderNum) return
  const existing = await workOrderChildList('/work-order-resource-requests', workOrderNum)
  const matched = new Set()
  for (const resource of resources) {
    const payload = workOrderResourcePayload(order, resource)
    if (!payload.item_description) continue
    const match = resource.resourceRequestId
      ? existing.find(row => String(row.resource_request_id) === String(resource.resourceRequestId))
      : existing.find(row => resourceNaturalKey(row) === resourceNaturalKey(payload))
    if (match) {
      matched.add(String(match.resource_request_id))
      if (!sameResourcePayload(match, payload)) {
        await api.put(`/work-order-resource-requests/${encodeURIComponent(match.resource_request_id)}`, payload)
      }
    } else {
      const saved = await api.post('/work-order-resource-requests', payload)
      if (saved?.resource_request_id) matched.add(String(saved.resource_request_id))
    }
  }
  for (const row of existing) {
    if (!matched.has(String(row.resource_request_id))) {
      await api.delete(`/work-order-resource-requests/${encodeURIComponent(row.resource_request_id)}`)
    }
  }
}
const workOrderMeterPayloads = order => {
  const workOrderNum = toText(order.WORKORDER)
  const readingAt = toDateOrNull(order['METER READING DATE']) || new Date()
  return [{
    asset_num: order.ASSET || null,
    work_order_num: workOrderNum,
    site_code: order.SITE || null,
    department_name: order['DEPARTMENT '] || '',
    meter_id: toText(order['METER ID']),
    reading_value: toNumberOrNull(order['METER READING']),
    reading_unit: order['METER READING UNIT'] || '',
    reading_at: readingAt
  }]
}
const comparableMeterPayload = row => ({
  meter_id: toText(row.meter_id),
  asset_num: row.asset_num || null,
  work_order_num: toText(row.work_order_num),
  site_code: row.site_code || null,
  department_name: row.department_name || '',
  reading_value: toNumberOrNull(row.reading_value) || 0,
  reading_unit: row.reading_unit || '',
  reading_at: toDateOrNull(row.reading_at)?.toISOString?.() || String(row.reading_at || '')
})
const sameMeterPayload = (existing, payload) => rowFingerprint(comparableMeterPayload(existing)) === rowFingerprint(comparableMeterPayload(payload))
const persistWorkOrderMeters = async order => {
  const workOrderNum = toText(order.WORKORDER)
  const selectedMeterId = toText(order['METER ID'])
  if (!workOrderNum) return
  const rows = await workOrderChildList('/meter-readings', workOrderNum)
  const generated = rows
    .filter(row => String(row.work_order_num) === workOrderNum)
    .filter(row => ['GENERAL', 'WATER', 'ENERGY'].some(suffix => String(row.meter_id || '').toUpperCase().endsWith(`-${suffix}`)))
  for (const row of generated) {
    if (row.meter_reading_id) await api.delete(`/meter-readings/${encodeURIComponent(row.meter_reading_id)}`)
  }
  const payloads = workOrderMeterPayloads(order)
  for (const payload of payloads) {
    const latestMeterRow = rows
      .filter(row => String(row.meter_id) === selectedMeterId)
      .sort((left, right) => String(right.reading_at || '').localeCompare(String(left.reading_at || '')))[0]
    const existingWorkOrderReading = rows.find(row =>
      String(row.meter_id) === selectedMeterId &&
      String(row.work_order_num || '') === workOrderNum
    )
    if (!payload.meter_id || payload.reading_value === null) {
      continue
    }
    const cleanPayload = {
      meter_id: payload.meter_id,
      asset_num: latestMeterRow?.asset_num || payload.asset_num,
      work_order_num: payload.work_order_num,
      site_code: latestMeterRow?.site_code || payload.site_code,
      department_name: latestMeterRow?.department_name || payload.department_name,
      reading_value: payload.reading_value,
      reading_unit: latestMeterRow?.reading_unit || payload.reading_unit,
      reading_at: payload.reading_at
    }
    if (existingWorkOrderReading?.meter_reading_id) {
      if (!sameMeterPayload(existingWorkOrderReading, cleanPayload)) await api.put(`/meter-readings/${encodeURIComponent(existingWorkOrderReading.meter_reading_id)}`, cleanPayload)
    } else {
      await api.post('/meter-readings', cleanPayload)
    }
  }
}
const persistWorkOrderChildren = async order => {
  await persistWorkOrderResources(order)
  await persistWorkOrderPlannedLabor(order)
  await persistWorkOrderTasks(order)
  await persistWorkOrderMeters(order)
}
const apiMappers = {
  sites: {
    endpoint: '/sites',
    key: 'code',
    apiKey: 'site_code',
    toApi: row => ({ site_code: toText(row.code), site_name: toText(row.name), region: row.region || '', city: row.city || '', status: statusText(row.status) })
  },
  departments: {
    endpoint: '/departments',
    key: 'subDepartmentCode',
    apiKey: 'sub_department_code',
    toApi: row => ({ sub_department_code: toText(row.subDepartmentCode), department_name: toText(row.department), description: toText(row.description), status: statusText(row.status) })
  },
  assets: {
    endpoint: '/assets',
    key: 'assetnum',
    apiKey: 'asset_num',
    toApi: row => ({ asset_num: toText(row.assetnum), description: toText(row.description), location_code: row.location || '', parent_asset_num: row.parent || null, department_name: row.department || '', sub_department_code: row['sub department'] || row.subDepartment || '', priority: toNumberOrNull(row.prioity || row.priority), site_code: row.site || null, status: statusText(row.status, 'OPERATING'), model_num: row.modelnum || '', serial_num: row.serialnum || '', install_date: toDateOrNull(row.installdate), quantity: toNumberOrNull(row.quantity) || 1 })
  },
  locations: {
    endpoint: '/locations',
    key: 'location',
    apiKey: 'location_code',
    toApi: row => ({ location_code: toText(row.location), description: toText(row.description), location_type: row.type || '', status: statusText(row.status, 'OPERATING'), priority: toNumberOrNull(row.priority), priority_description: row.priorityDescription || row['priority  description'] || '', site_code: row.site || null, building: row.building || row.builiding || '', building_category: row.buildingCategory || row['builiding category'] || '', department_name: row.department || '' })
  },
  labor: {
    endpoint: '/labor',
    key: 'personId',
    apiKey: 'labor_id',
    toApi: row => ({ labor_id: toText(row.personId), display_name: toText(row.name), craft_code: row.craftCode || '', craft_name: row.craft || '', department_name: row.department || '', sub_department_code: row.subDepartment || '', site_code: row.site || null, availability: row.availability || 'Available', status: statusText(row.status) })
  },
  materials: {
    endpoint: '/materials',
    key: 'itemNumber',
    apiKey: 'item_code',
    toApi: row => ({ item_code: toText(row.itemNumber), description: toText(row.description), category: row.category || '', unit_of_measure: row.unit || 'EA', status: statusText(row.status, row.availability || 'Active') })
  },
  stores: {
    endpoint: '/storerooms',
    key: 'code',
    apiKey: 'store_code',
    toApi: row => ({ store_code: toText(row.code), store_name: toText(row.name), site_code: row.site || null, status: statusText(row.status) })
  },
  tools: {
    endpoint: '/tools-equipment',
    key: 'toolNumber',
    apiKey: 'tool_code',
    toApi: row => ({ tool_code: toText(row.toolNumber), description: toText(row.description), category: row.category || '', location_code: row.location || null, site_code: row.site || null, quantity: toNumberOrNull(row.quantity) || 1, low_level: toNumberOrNull(row.lowLevel) || 0, status: statusText(row.status, 'Available'), inspection_due: toDateOrNull(row.inspectionDue) })
  },
  failureCodes: {
    endpoint: '/failure-library',
    key: 'failureLibraryId',
    apiKey: 'failure_library_id',
    toApi: row => ({ ...(row.failureLibraryId ? { failure_library_id: row.failureLibraryId } : {}), failure_class_id: toText(row['FAILURE CLASS ID']), description: toText(row.DESCRIPTION), problem_code: row['PROBLEM CODE'] || null, problem_description: row['PC - DESCRIPTION'] || '', cause_code: row['CAUSE CODE'] || null, cause_description: row['CC - DESCRIPTION'] || '', remedy_code: row['REMEDY CODE'] || null, remedy_description: row['RC - DESCRIPTION'] || '' })
  },
  workOrders: {
    endpoint: '/work-orders',
    key: 'WORKORDER',
    apiKey: 'work_order_num',
    toApi: row => ({ ...(row.__isNew ? { __forcePost: true } : {}), work_order_num: row.__isNew ? 'AUTO' : toText(row.WORKORDER), description: toText(row['DESCRIPITION '] || row.DESCRIPTION), long_description: row['LONG DESCRIPTION'] || '', location_code: row['LOCATION '] || '', asset_num: row.ASSET || null, status: statusText(row.STATUS, 'WAPPR'), work_type: row['WORK TYPE '] || row['WORK TYPE'] || 'CM', priority: toNumberOrNull(row.PRIORTY || row.priority), site_code: row.SITE || null, department_name: row['DEPARTMENT '] || '', sub_department_code: row['SUB DEPARTMENT  NAME'] || '', assigned_department_name: row['ASSIGNED DEPARTMENT'] || row['DEPARTMENT '] || '', work_group: row['WORK GROUP'] || '', system_name: row.SYSTEM || '', supervisor: row.SUPERVISOR || '', labor_craft_code: row['LABOR CRAFT CODE'] || '', target_start_at: toDateOrNull(row['TARGET START ']), target_finish_at: toDateOrNull(row['TARGET FINISH ']), actual_start_at: toDateOrNull(row['ACTUAL START ']), actual_finish_at: toDateOrNull(row['ACTUAL FINISH ']), reported_at: toDateOrNull(row['REPORTED DATE ']) || new Date(), source_sr_num: row['SOURCE SR'] || null, pm_num: row['PM NUMBER'] || null, pm_cycle: row['PM CYCLE'] || null, job_plan_num: row['JOB PLAN'] || null, schedule_rule_name: row['PM RULE'] || null, failure_code: row['FAILURE CODE'] || '', problem_code: row['PROBLEM CODE'] || '', cause_code: row['CAUSE CODE'] || '', remedy_code: row['REMEDY CODE'] || '', ...(row['PTW REQUIRED'] === undefined ? {} : { ptw_required: Boolean(row['PTW REQUIRED']) }), technician_remarks: row['TECHNICIAN REMARKS'] || '', completion_notes: row['COMPLETION NOTES'] || '', actual_labor: row['ACTUAL LABOR'] || '', actual_hours: toNumberOrNull(row['ACTUAL HOURS']), actual_materials_json: JSON.stringify(actualResourceMetadata(row['ACTUAL MATERIALS'])), actual_tools_json: JSON.stringify(actualResourceMetadata(row['ACTUAL TOOLS'])), held_from_status: row['HELD FROM'] || null, hold_periods_json: JSON.stringify(Array.isArray(row.holdPeriods) ? row.holdPeriods : []), estimated_duration_minutes: toNumberOrNull(row['ESTIMATED DURATION']) || 0, safety_instructions: row['SAFETY INSTRUCTIONS'] || '', checklist_json: JSON.stringify(Array.isArray(row.CHECKLIST) ? row.CHECKLIST : []) }),
    beforeRow: persistWorkOrderChildren,
    afterRow: async (row, saved, context) => {
      if (context?.existed) return
      if (saved?.work_order_num) {
        row.WORKORDER = saved.work_order_num
        row.__isNew = false
      }
      await persistWorkOrderChildren(row)
    }
  },
  serviceRequests: {
    endpoint: '/service-requests',
    key: 'sr',
    apiKey: 'sr_num',
    toApi: row => ({ ...(row.__isNew ? { __forcePost: true } : {}), sr_num: row.__isNew ? 'AUTO' : toText(row.sr), description: toText(row.description), long_description: row.longDescription || '', site_code: row.site || null, location_code: row.location || '', asset_num: row.asset || null, department_name: row.department || '', sub_department_code: row.subDepartment || '', assigned_department_name: row.assignedDepartment || row.department || '', reported_by: row.reportedBy || '', reported_at: toDateOrNull(row.reportedDate) || new Date(), priority: row.priority || '', request_type: row.requestType || 'Service', failure_code: row.failureCode || '', problem_code: row.problemCode || '', status: statusText(row.status, 'NEW'), converted_work_order_num: row.convertedWorkOrder || null }),
    afterRow: (row, saved) => {
      if (!row.__isNew || !saved?.sr_num) return
      row.__isNew = false
      row.sr = saved.sr_num
    }
  },
  incidents: {
    endpoint: '/incidents',
    key: 'incidentNumber',
    apiKey: 'incident_num',
    toApi: row => ({ ...(row.__isNew ? { __forcePost: true } : {}), incident_num: row.__isNew ? 'AUTO' : toText(row.incidentNumber || row.incident), description: toText(row.description), site_code: row.site || null, location_code: row.location || '', asset_num: row.asset || null, department_name: row.department || '', severity: row.severity || 'Medium', status: statusText(row.status, 'NEW'), reported_by: row.reportedBy || '', reported_at: toDateOrNull(row.reportedDate) || new Date() }),
    afterRow: (row, saved) => {
      if (!row.__isNew || !saved?.incident_num) return
      row.__isNew = false
      row.incidentNumber = saved.incident_num
    }
  },
  pm: {
    endpoint: '/preventive-maintenance',
    key: 'pmNumber',
    apiKey: 'pm_num',
    toApi: row => ({ pm_num: toText(row.pmNumber), description: toText(row.description), asset_num: row.asset || null, route_code: row.route || '', location_code: row.location || '', job_plan_num: row.jobPlan || null, next_date: toDateOrNull(row.startDate), lead_time_days: toNumberOrNull(row.leadTime) || 0, frequency: toNumberOrNull(row.frequency) || 1, frequency_unit: row.freqUnit || 'MONTHS', schedule_rule_name: row.scheduleRule || null, pm_counter: toNumberOrNull(row.pmCounter) || 0, work_type: row.workType || 'PM', wo_status: row.woStatus || 'WSCH', store_code: row.storeLocation || null, supervisor: row.supervisor || '', lead_person: row.lead || '', person_group: row.personGroup || '', site_code: row.site || null, department_name: row.department || '', sub_department_code: row.subDepartment || '', pm_status: row.pmStatus || 'ACTIVE', last_generated_cycle: row.lastGeneratedCycle || '' })
  },
  pmRules: {
    endpoint: '/pm-schedule-rules',
    key: 'name',
    apiKey: 'rule_name',
    toApi: row => ({ rule_name: toText(row.name), frequency: toNumberOrNull(row.frequency) || 1, frequency_unit: row.freqUnit || 'MONTHS', lead_time_days: toNumberOrNull(row.leadTimeDays) || 0, horizon_days: toNumberOrNull(row.horizonDays) ?? 30, trigger_hour: ['MINUTES', 'HOURS'].includes(row.freqUnit) ? 0 : Math.max(0, Math.min(23, toNumberOrNull(row.triggerHour) || 0)), wo_prefix: row.woPrefix || 'PMWO-', default_wo_status: row.defaultWoStatus || 'WSCH', notes: row.notes || '', status: row.status || 'Active' })
  },
  connectors: {
    endpoint: '/smtp-sms-connectors',
    key: 'name',
    apiKey: 'connector_name',
    toApi: row => ({ connector_name: toText(row.name), connector_type: row.type || 'SMTP', host_endpoint: toText(row.host), port: toNumberOrNull(row.port), encryption: row.encryption || 'TLS', username_value: row.username || '', secret_value: row.password || '', sender_value: row.sender || '', notes: row.notes || '', status: row.status || 'Active' })
  },
  notificationRules: {
    endpoint: '/notification-rules',
    key: 'id',
    apiKey: 'rule_id',
    toApi: row => ({ rule_id: toText(row.id), event_name: toText(row.event), channel_name: toText(row.channel), recipients: row.recipients || '', notes: row.notes || '', status: row.status || 'Active' })
  },
  meters: {
    endpoint: '/meter-readings',
    key: 'meterReadingId',
    apiKey: 'meter_reading_id',
    toApi: row => ({ ...(row.meterReadingId ? { meter_reading_id: row.meterReadingId } : {}), meter_id: toText(row.meterId), asset_num: row.asset || null, work_order_num: row.workOrder || null, site_code: row.site || null, department_name: row.department || '', reading_value: toNumberOrNull(row.reading) || 0, reading_unit: row.unit || '', reading_at: toDateOrNull(row.readingDate) || new Date() })
  },
  jobPlans: {
    endpoint: '/job-plans',
    key: 'JPNUM',
    apiKey: 'job_plan_num',
    toApi: row => ({ job_plan_num: toText(row.JPNUM || row.number), description: toText(row.DESCRIPTION || row.description), status: statusText(row.status, 'ACTIVE'), estimated_duration_minutes: toNumberOrNull(row.estimatedDurationMinutes) || 0, required_labor_json: JSON.stringify(Array.isArray(row.requiredLabor) ? row.requiredLabor : []), required_materials_json: JSON.stringify(Array.isArray(row.requiredMaterials) ? row.requiredMaterials : []), required_tools_json: JSON.stringify(Array.isArray(row.requiredTools) ? row.requiredTools : []), safety_instructions: row.safetyInstructions || '', checklist_json: JSON.stringify(Array.isArray(row.checklist) ? row.checklist : []) })
  },
  jobTasks: {
    endpoint: '/job-plan-tasks',
    key: 'JOBTASKID',
    apiKey: 'job_plan_task_id',
    toApi: row => ({
      ...(row.__isNew ? { __forcePost: true } : {}),
      ...(row.__isNew ? {} : { job_plan_task_id: row.JOBTASKID }),
      job_plan_num: toText(row.JPNUM),
      task_sequence: toNumberOrNull(row['JOB TASK SEQUENCE']) || 10,
      task_description: toText(row['JOB TASK DESCRIPTION'] || row.DESCRIPTION),
      duration_hours: toNumberOrNull(row['TASK DURATION IN HOUR']) || 0
    }),
    afterRow: (row, saved) => {
      if (!row.__isNew || !saved?.job_plan_task_id) return
      row.__isNew = false
      row.JOBTASKID = saved.job_plan_task_id
    }
  },
  users: {
    endpoint: '/users',
    key: 'userId',
    apiKey: 'user_id',
    toApi: row => ({ user_id: toText(row.userId), username: toText(row.username), password: row.password || undefined, display_name: toText(row.name), email: row.email || '', role_id: row.roleId, role: row.role, labor_id: row.laborId || null, site: row.site || 'All Sites', department: row.department || 'All Departments', data_scope_override: row.dataScopeOverride || 'ROLE', status: statusText(row.status) })
  },
  roles: {
    endpoint: '/roles',
    key: 'roleId',
    apiKey: 'role_id',
    toApi: row => ({
      ...(row.roleId ? { role_id: row.roleId } : { __endpoint: '/roles/by-name', __apiKey: 'role_name', __fallbackEndpoint: '/roles' }),
      role_code: row.roleCode,
      role_name: toText(row.role),
      scope_description: row.scope || '',
      data_scope: row.dataScope || 'DEPARTMENT',
      status: statusText(row.status),
      permissions: uniquePermissions(row.permissions)
    })
  }
}
const apiMappersByEndpoint = Object.fromEntries(Object.values(apiMappers).map(config => [config.endpoint, config]))
const normalizeWoStatus = value => {
  return statusCode('workOrder',value)||'WAPPR'
}
const getWorkOrderJobPlan = order => cleanText(order['JOB PLAN'] || order.JPNUM || order.JPNUMBER || order['JOP PLAN '] || order['JOP PLAN'] || order.jobPlan)
const taskToPlanRow = (task, index = 0) => ({
  sequence: task.sequence ?? task['JOB TASK SEQUENCE'] ?? task.SEQUENCE ?? index + 1,
  description: task.description ?? task['JOB TASK DESCRIPTION'] ?? task.DESCRIPTION ?? '',
  duration: task.duration ?? Math.max(5, Math.round(Number(task['TASK DURATION IN HOUR'] || 0) * 60))
})
const assetFromMaster = (assetNumber, masterAssets = []) => masterAssets.find(asset => cleanText(asset.assetnum) === cleanText(assetNumber))
const assetDescriptionFromMaster = (assetNumber, masterAssets = []) => masterAssets.find(asset => cleanText(asset.assetnum) === cleanText(assetNumber))?.description?.trim() || ''
function WorkOrderWorkflowNotice({ status, missing = [], nextStep }) {
  const clear = missing.length === 0
  return (
    <Alert
      tone={clear ? 'success' : 'warning'}
      title={clear ? 'Ready for the next workflow action' : 'Update needed before the next workflow action'}
      actions={(
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--app-panel)_70%,transparent)] px-3 py-2 text-xs">
          <span className="block text-[9px] font-extrabold uppercase tracking-[.14em] opacity-70">Current status</span>
          <strong>{status}</strong>
          <span className="mx-2 opacity-50">·</span>
          <span>{nextStep}</span>
        </div>
      )}
    >
      <div className="mt-2 flex flex-wrap gap-2">
        {clear ? (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--app-panel)_70%,transparent)] px-2.5 py-1 text-[10px] font-bold">No blocking fields</span>
        ) : missing.map(item => (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--app-panel)_70%,transparent)] px-2.5 py-1 text-[10px] font-bold" key={item}>{item}</span>
        ))}
      </div>
    </Alert>
  )
}

function WorkOrderEditor({ order, onClose, page = false, projectName, initialTab, workflow: workflowValue = DEFAULT_WORK_ORDER_WORKFLOW, siteRecords = [], departmentRecords = [], assetRecords = [], workOrderRows = [], laborRecords = [], materialRecords = [], stockRecords = [], storeRecords = [], toolRecords = [], jobTaskRecords = [], failureCodeRecords = [], reservationRecords = [], purchaseRequestRecords = [], purchaseOrderRecords = [], meterRecords = [], onCreatePurchaseRequest, onCreateReservation, onUpdateWorkOrder, onNotifyWorkOrderStatus, notify }) {
  const { user } = useAuth()
  const workflow = useMemo(()=>normalizeWorkOrderWorkflow(workflowValue),[workflowValue])
  const canEditWorkOrder = canUseAction(user, 'Work Orders', 'edit')
  const canCloseWorkOrder = canEditWorkOrder && canUseAction(user, 'Work Orders', 'close')
  const canManageHold = workflow.allowHold && canEditWorkOrder && canUseAction(user, 'Work Orders', 'approve')
  const canViewPlanTab = canUseAction(user, 'Work Order Planning', 'view')
  const visibleWorkOrderTabs = canViewPlanTab ? workOrderTabs : workOrderTabs.filter(name => name !== 'Plan')
  const workType=(order['WORK TYPE'] || order['WORK TYPE '] || order['WORK TYPE  '] || 'CM').trim()
  const isPM = workType === 'PM'
  const isCM = workType === 'CM'
  const [tab, setTab] = useState(workOrderTabs.includes(initialTab) ? initialTab : 'Overview')
  const [autoSaveState,setAutoSaveState]=useState('Saved')
  const saveReady = useRef(false)
  const lastSavedFingerprint = useRef('')
  const [selectedStatus,setSelectedStatus]=useState(normalizeWoStatus(order.STATUS))
  const [heldFrom,setHeldFrom]=useState(order['HELD FROM']||'')
  const [holdPeriods,setHoldPeriods]=useState(Array.isArray(order.holdPeriods)?order.holdPeriods:[])
  // The editor seeds its state from `order` once, but the parent swaps that object
  // whenever the stored work order changes - Save, or the hold/resume buttons. Keyed on
  // the stored STATUS so it re-syncs on those, and never stomps an unsaved selection made
  // in the status dropdown (which does not change the stored order).
  useEffect(()=>{
    setSelectedStatus(normalizeWoStatus(order.STATUS))
    setHeldFrom(order['HELD FROM']||'')
    setHoldPeriods(Array.isArray(order.holdPeriods)?order.holdPeriods:[])
  },[order.WORKORDER,order.STATUS])
  useEffect(()=>{
    if(!canViewPlanTab&&tab==='Plan') setTab('Overview')
  },[canViewPlanTab,tab])
  const [workCompleted,setWorkCompleted]=useState(['COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workClosed,setWorkClosed]=useState(['CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workStarted,setWorkStarted]=useState(['INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workApproved,setWorkApproved]=useState(['APPR','WSCH','SCHED','INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workWaitingSchedule,setWorkWaitingSchedule]=useState(['WSCH','SCHED','INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [workScheduled,setWorkScheduled]=useState(['SCHED','INPRG','COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase()))
  const [description,setDescription]=useState(order['DESCRIPITION ']||'')
  const [longDescription,setLongDescription]=useState(order['LONG DESCRIPTION']||order['LONG DESCRIPTION ']||'')
  const [priority,setPriority]=useState(String(order['PRIORTY']||'2'))
  const [department,setDepartment]=useState(String(order['DEPARTMENT ']||''))
  const [subDepartment,setSubDepartment]=useState(String(order['SUB DEPARTMENT  NAME']||''))
  const [assignedDepartment,setAssignedDepartment]=useState(String(order['ASSIGNED DEPARTMENT']||order['DEPARTMENT ']||''))
  const [workGroup,setWorkGroup]=useState(order['WORK GROUP']||'')
  const [supervisor,setSupervisor]=useState(order.SUPERVISOR||'')
  const [laborCraft,setLaborCraft]=useState(order['LABOR CRAFT CODE']||'')
  const [siteValue,setSiteValue]=useState(String(order.SITE || ''))
  const [assetValue,setAssetValue]=useState(order.ASSET||'')
  const [assetDescription,setAssetDescription]=useState(assetDescriptionFromMaster(order.ASSET, assetRecords) || order['ASSET DESCRIPTION'] || order['ASSET DESCRIPTION '] || '')
  const [locationValue,setLocationValue]=useState(order['LOCATION '] || assetFromMaster(order.ASSET, assetRecords)?.location || '')
  const [systemValue,setSystemValue]=useState(order.SYSTEM||assetFromMaster(order.ASSET, assetRecords)?.system||'')
  const [failureClass,setFailureClass]=useState(order['FAILURE CODE']||'')
  const [problemCode,setProblemCode]=useState(order['PROBLEM CODE']||'')
  const [causeCode,setCauseCode]=useState(order['CAUSE CODE']||'')
  const [remedyCode,setRemedyCode]=useState(order['REMEDY CODE']||'')
  const jobPlanNumber = getWorkOrderJobPlan(order)
  const jobPlanTaskRows = order['JOB PLAN TASKS']?.length ? order['JOB PLAN TASKS'] : jobPlanNumber ? jobTaskRecords.filter(task => cleanText(task.JPNUM) === jobPlanNumber) : []
  // saveChanges writes these back onto the order, so reopening a saved work order must
  // read them again - otherwise planned rows silently vanish on every revisit.
  const [plannedLabor,setPlannedLabor]=useState(order['PLANNED LABOR']?.length?order['PLANNED LABOR']:isPM?[]:[{craft:'',hours:'',crew:''}])
  const [plannedResources,setPlannedResources]=useState(order['PLANNED RESOURCES']?.length?order['PLANNED RESOURCES']:[])
  const [plannedTasks,setPlannedTasks]=useState(isPM?jobPlanTaskRows.map(taskToPlanRow):[{sequence:10,description:'',duration:''}])
  const tasksFromJobPlan=isPM&&jobPlanTaskRows.length>0
  // Written by convertRequest but, until now, never read anywhere except its own dedupe guard.
  const sourceRequest=order['SOURCE SR']?{sr:order['SOURCE SR'],reportedBy:order['REPORTED BY']||'',reportedDate:toDateTimeInput(order['REPORTED DATE '])||'',priority:order['SOURCE SR PRIORITY']||'',requestType:order['SOURCE SR TYPE']||''}:null
  const [ptwRequired,setPtwRequired]=useState(order['PTW REQUIRED'] === undefined ? workflow.ptwRequiredDefault : Boolean(order['PTW REQUIRED']))
  const { attachments: workOrderAttachments, uploadFiles: uploadWorkOrderFiles, removeAttachment: removeWorkOrderAttachment, downloadAttachment: downloadWorkOrderAttachment } = useEntityAttachments('work-order', order.WORKORDER)
  const ptwFiles=useMemo(()=>workOrderAttachments.filter(file=>String(file.category||'').toUpperCase()==='PTW'),[workOrderAttachments])
  const generalFiles=useMemo(()=>workOrderAttachments.filter(file=>String(file.category||'').toUpperCase()!=='PTW'),[workOrderAttachments])
  const [technicianRemarks,setTechnicianRemarks]=useState(order['TECHNICIAN REMARKS']||'')
  const [completionNotes,setCompletionNotes]=useState(order['COMPLETION NOTES']||'')
  const [actualLabor,setActualLabor]=useState(order['ACTUAL LABOR']||'')
  const [actualHours,setActualHours]=useState(order['ACTUAL HOURS']||'')
  const [actualMaterials,setActualMaterials]=useState(order['ACTUAL MATERIALS']||[])
  const [actualTools,setActualTools]=useState(order['ACTUAL TOOLS']||[])
  const [actualStart,setActualStart]=useState(toDateTimeInput(order['ACTUAL START ']) || '')
  const [actualFinish,setActualFinish]=useState(['COMP','COMPLETED','CLOSE','CLOSED'].includes(String(order.STATUS||'').toUpperCase())?toDateTimeInput(order['ACTUAL FINISH ']) : '')
  const [meterId,setMeterId]=useState(order['METER ID']||'')
  const [waterMeterId,setWaterMeterId]=useState(order['WATER METER ID']||'')
  const [energyMeterId,setEnergyMeterId]=useState(order['ENERGY METER ID']||'')
  const [meterReading,setMeterReading]=useState(order['METER READING']||'')
  const [waterConsumption,setWaterConsumption]=useState(order['WATER CONSUMPTION']||'')
  const [energyConsumption,setEnergyConsumption]=useState(order['ENERGY CONSUMPTION']||'')
  const [meterReadingDate,setMeterReadingDate]=useState(toDateTimeInput(order['METER READING DATE'])||'')
  // When the job was raised. It is the floor for Target Start, so it is resolved once here
  // rather than inline in the tab.
  const reportedDateValue=toDateTimeInput(order['REPORTED DATE ']||order['REPORTED DATE']||order['REPORT DATE'])||nowLocalDateTime()
  const [targetStart,setTargetStart]=useState(toDateTimeInput(order['TARGET START ']))
  const [targetFinish,setTargetFinish]=useState(toDateTimeInput(order['TARGET FINISH ']))
  useEffect(()=>{
    if(!workflow.allowPtwOverride&&!ptwRequired) setPtwRequired(true)
  },[workflow.allowPtwOverride,ptwRequired])
  const siteOptions=deriveSiteOptions({siteRecords,user,assets:assetRecords,orders:workOrderRows})
  const departmentOptions=deriveDepartmentOptions({departmentRecords,user,assets:assetRecords,orders:workOrderRows})
  const selectedDepartment=departments.find(item=>sameDepartment(item.name,department))
  const masterSubDepartments=departmentRecords.filter(item=>item.status!=='Inactive'&&sameDepartment(item.department,department)).map(item=>({value:item.subDepartmentCode,label:item.description}))
  const subDepartmentOptions=masterSubDepartments.length?masterSubDepartments:(selectedDepartment?.subDepartments||departments.flatMap(item=>item.subDepartments)).map(item=>({value:item.name,label:item.code}))
  const workGroupOptions=workGroupsForDepartment(assignedDepartment)
  const systemOptions=systemNamesForDepartment(department)
  const supervisorOptions=laborRecords.filter(person=>!assignedDepartment||person.department===assignedDepartment).map(person=>({value:person.name,label:`${person.craftCode} · ${person.craft}`}))
  const laborCraftOptions=[...new Map(laborRecords.map(person=>[person.craftCode,{value:person.craftCode,label:person.craft}])).values()]
  const plannedCraftOptions=[...new Map(laborRecords.map(person=>[person.craft,{value:person.craft,label:person.craftCode}])).values()]
  const plannedCrewOptions=laborRecords.map(person=>({value:person.name,label:`${person.personId} · ${person.craft} · ${person.availability}`}))
  const assetsForSite=assetRecords.filter(a=>!siteValue||String(a.site)===siteValue)
  const assetOptions=assetsForSite.map(a=>({value:a.assetnum,label:a.description?.trim()}))
  const locationOptions=[...new Set([...assetsForSite.map(a=>a.location),...workOrderRows.filter(o=>!siteValue||String(o.SITE)===siteValue).map(o=>o['LOCATION '])].filter(Boolean))].sort()
  const changeSite=e=>{setSiteValue(e.target.value);setAssetValue('');setLocationValue('')}
  const changeAsset=e=>{const value=e.target.value;setAssetValue(value);const match=assetRecords.find(a=>cleanText(a.assetnum)===cleanText(value));setAssetDescription(match?.description?.trim()||'');if(match?.location)setLocationValue(match.location);if(match?.site)setSiteValue(String(match.site));if(match?.system)setSystemValue(current=>current||match.system)}
  const matchingFailures=failureCodeRecords.filter(row=>!failureClass||cleanText(row['FAILURE CLASS ID'])===cleanText(failureClass))
  const failureClassOptions=uniqueCodeOptions(failureCodeRecords,'FAILURE CLASS ID','DESCRIPTION')
  const problemOptions=uniqueCodeOptions(matchingFailures,'PROBLEM CODE','PC - DESCRIPTION')
  const selectedProblems=matchingFailures.filter(row=>!problemCode||cleanText(row['PROBLEM CODE'])===cleanText(problemCode))
  const causeOptions=uniqueCodeOptions(selectedProblems,'CAUSE CODE','CC - DESCRIPTION')
  const remedyOptions=uniqueCodeOptions(selectedProblems.filter(row=>!causeCode||cleanText(row['CAUSE CODE'])===cleanText(causeCode)),'REMEDY CODE','RC - DESCRIPTION')
  const failureDescription=failureCodeRecords.find(row=>cleanText(row['FAILURE CLASS ID'])===cleanText(failureClass))?.DESCRIPTION||''
  const problemDescription=failureCodeRecords.find(row=>cleanText(row['FAILURE CLASS ID'])===cleanText(failureClass)&&cleanText(row['PROBLEM CODE'])===cleanText(problemCode))?.['PC - DESCRIPTION']||''
  const causeDescription=failureCodeRecords.find(row=>cleanText(row['PROBLEM CODE'])===cleanText(problemCode)&&cleanText(row['CAUSE CODE'])===cleanText(causeCode))?.['CC - DESCRIPTION']||''
  const remedyDescription=failureCodeRecords.find(row=>cleanText(row['PROBLEM CODE'])===cleanText(problemCode)&&cleanText(row['REMEDY CODE'])===cleanText(remedyCode))?.['RC - DESCRIPTION']||''
  const firstProblemForFailure=value=>failureCodeRecords
    .filter(row=>cleanText(row['FAILURE CLASS ID'])===cleanText(value)&&cleanText(row['PROBLEM CODE']))
    .sort((left,right)=>cleanText(left['PROBLEM CODE']).localeCompare(cleanText(right['PROBLEM CODE']),undefined,{numeric:true,sensitivity:'base'}))[0]
  const changeFailure=e=>{
    const next=e.target.value
    const problem=firstProblemForFailure(next)
    setFailureClass(next)
    setProblemCode(problem?cleanText(problem['PROBLEM CODE']):'')
    setCauseCode('')
    setRemedyCode('')
  }
  useEffect(()=>{
    if(!cleanText(failureClass)||cleanText(problemCode)) return
    const problem=firstProblemForFailure(failureClass)
    if(!problem) return
    setProblemCode(cleanText(problem['PROBLEM CODE']))
    setCauseCode('')
    setRemedyCode('')
  },[failureClass,problemCode,failureCodeRecords])
  const updatePlanRow=(setter,index,key,value)=>setter(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,[key]:value}:row))
  // Changing what was used invalidates any return already confirmed against the old
  // figure - returning 1 of 2 then marking both used must not keep claiming "Returned 1".
  const updateActualRow=(setter,index,value)=>setter(rows=>rows.map((row,rowIndex)=>
    rowIndex===index?{...row,actualQuantity:value,returned:false,returnedQuantity:0,returnedAt:0}:row))
  const clearResourceSupplyChain = row => ({ ...row, requestStatus: '', transactionRef: '', purchaseRequest: '', purchaseOrder: '', reservation: '', supplyChainStatus: '' })
  const resourceLocked=row=>Boolean(row.transactionRef||row.purchaseRequest||row.purchaseOrder||row.reservation)
  const updatePlannedResource=(index,value)=>setPlannedResources(rows=>rows.map((row,rowIndex)=>rowIndex===index&&!resourceLocked(row)?{...clearResourceSupplyChain(row),item:value}:row))
  const updatePlannedResourceField=(index,key,value)=>setPlannedResources(rows=>rows.map((row,rowIndex)=>rowIndex===index&&!resourceLocked(row)?{...clearResourceSupplyChain(row),[key]:value}:row))
  const findPlannedInventory = resource => resource.type === 'Material'
    ? materialRecords.find(item => item.description === resource.item || item.itemNumber === resource.item || item.item === resource.item)
    : toolRecords.find(item => item.description === resource.item || item.toolNumber === resource.item || item.tool === resource.item)
  const resourceAvailability = resource => {
    const inventory = findPlannedInventory(resource)
    if (!inventory) return { availability: 'Not Found', source: resource.type === 'Material' ? 'Materials master' : 'Tools master' }
    if (resource.type === 'Material') {
      const availableQuantity = totalAvailable(inventory.itemNumber, stockRecords)
      const requestedQuantity = Number(resource.quantity || 0)
      const holding = storesHolding(inventory.itemNumber, stockRecords)
      return {
        availability: requestedQuantity > 0 && availableQuantity >= requestedQuantity ? 'Available' : 'Purchase Required',
        source: holding.length ? holding.map(code => storeLabel(code, storeRecords)).join(', ') : 'No store holds this item',
        storeCode: holding[0] || '',
        availableQuantity,
        itemNumber: inventory.itemNumber
      }
    }
    const requestedQuantity = Number(resource.quantity || 0)
    const availableQuantity = inventory.status === 'Available' ? Number(inventory.quantity || 0) : 0
    return {
      availability: requestedQuantity > 0 && availableQuantity >= requestedQuantity ? 'Available' : 'Purchase Required',
      source: inventory.location || 'Tool Crib',
      storeCode: '',
      availableQuantity,
      itemNumber: inventory.toolNumber,
      inventoryStatus: inventory.status
    }
  }
  const materialRequests=plannedResources.filter(resource=>resource.type==='Material')
  const resourceRequests=plannedResources.filter(resource=>['Material','Tool','Equipment'].includes(resource.type))
  const hasSupplyChainTransaction=resource=>Boolean(resource.transactionRef||resource.purchaseRequest||resource.purchaseOrder||resource.reservation)
  const materialBlocked=materialRequests.some(resource=>resourceAvailability(resource).availability==='Purchase Required'&&!hasSupplyChainTransaction(resource))
  const liveReservationStatus=resource=>{
    const reservation=resource.reservation
      ? reservationRecords.find(row=>String(row.reservation)===String(resource.reservation))
      : null
    return cleanText(reservation?.status || resource.requestStatus).toUpperCase()
  }
  const resourceSupplyReady=resource=>Boolean(resource.item&&Number(resource.quantity)>0&&resource.reservation&&liveReservationStatus(resource)==='COMPLETE')
  // A planned row with no item, or one naming something that is not in the master, used to be
  // skipped by every gate - so a work order could be scheduled and a nameless tool allocated
  // and delivered. Those rows now block instead of being ignored.
  const unnamedResourceMissing=resourceRequests
    .filter(resource=>!cleanText(resource.item))
    .map(resource=>`Material Requests: name the planned ${String(resource.type||'resource').toLowerCase()} or remove the row`)
  const unknownResourceMissing=resourceRequests
    .filter(resource=>cleanText(resource.item)&&resourceAvailability(resource).availability==='Not Found')
    .map(resource=>`Material Requests: ${resource.item} is not in the ${resource.type==='Material'?'materials':'tools'} master`)
  const supplyChainMissing=[
    ...unnamedResourceMissing,
    ...unknownResourceMissing,
    ...resourceRequests
      .filter(resource=>resource.item&&Number(resource.quantity)>0&&!resourceSupplyReady(resource))
      .map(resource=>`Material Requests: ${resource.quantity || 0} x ${resource.item} must be issued by Store`)
  ]
  const ptwBlocked=(!workflow.allowPtwOverride||ptwRequired)&&ptwFiles.length===0
  const ptwRequirementMissing=[ptwBlocked&&'PTW & Files: attach permit file'].filter(Boolean)
  const ptwMissing=workflowHasRequirement(workflow,'ptw')?ptwRequirementMissing:[]
  const storeIssueRequirementMissing=supplyChainMissing
  const storeIssueMissing=workflowHasRequirement(workflow,'store_issue')?storeIssueRequirementMissing:[]
  const targetOutOfOrder=Boolean(targetStart&&targetFinish&&new Date(targetFinish)<new Date(targetStart))
  // A job cannot be scheduled to start before it was reported. The picker refuses earlier dates,
  // but a value already stored - or typed straight into the field - still has to be caught.
  const targetStartBeforeReport=Boolean(targetStart&&reportedDateValue&&new Date(targetStart)<new Date(reportedDateValue))
  const overviewRequirementMissing=[!description.trim()&&'Description',!priority&&'Priority',!siteValue&&'Site',!locationValue&&'Location',isCM&&!assetValue&&'Asset',!department&&'Department',!assignedDepartment&&'Assigned Department',targetOutOfOrder&&'Target Finish must be on or after Target Start',targetStartBeforeReport&&'Target Start cannot be before the reported date'].filter(Boolean)
  const overviewMissing=workflowHasRequirement(workflow,'overview')?overviewRequirementMissing:[]
  const plannedLaborReady=plannedLabor.some(row=>cleanText(row.craft)&&Number(row.hours)>0&&cleanText(row.crew))
  const plannedMaterialsReady=plannedResources.some(row=>row.type==='Material'&&row.item&&Number(row.quantity)>0)
  const plannedToolsReady=plannedResources.some(row=>['Tool','Equipment'].includes(row.type)&&row.item&&Number(row.quantity)>0)
  const plannedLaborRequirementMissing=[!plannedLaborReady&&'Plan: labor, estimated hours, and assigned crew'].filter(Boolean)
  const plannedMaterialsRequirementMissing=[isCM&&!plannedMaterialsReady&&'Plan: required materials'].filter(Boolean)
  const plannedToolsRequirementMissing=[isCM&&!plannedToolsReady&&'Plan: required tools'].filter(Boolean)
  const planMissing=[
    ...(workflowHasRequirement(workflow,'planned_labor')?plannedLaborRequirementMissing:[]),
    ...(workflowHasRequirement(workflow,'planned_materials_cm')?plannedMaterialsRequirementMissing:[]),
    ...(workflowHasRequirement(workflow,'planned_tools_cm')?plannedToolsRequirementMissing:[])
  ]
  const planReady=planMissing.length===0
  // "if applicable" - only demanded when the failure library holds entries for this problem.
  const causeApplicable=Boolean(isCM&&problemCode&&causeOptions.length)
  const remedyApplicable=Boolean(isCM&&problemCode&&remedyOptions.length)
  const failureRequirementMissing=[isCM&&!failureClass&&'Failure: failure code',isCM&&!problemCode&&'Failure: problem code',causeApplicable&&!causeCode&&'Failure: cause code',remedyApplicable&&!remedyCode&&'Failure: remedy code'].filter(Boolean)
  const failureMissing=workflowHasRequirement(workflow,'failure')?failureRequirementMissing:[]
  const failureReady=failureMissing.length===0
  const actualMaterialsReady=!isCM||actualMaterials.some(row=>row.item&&Number(row.actualQuantity)>0)
  // A tool has no "used" quantity - it is taken and given back. Recording it means the row
  // exists and is named; whether it came back is the returns gate's job, not this one.
  const actualToolsReady=!isCM||actualTools.some(row=>row.item)
  // Unused material and every borrowed tool go back to the store before closeout. A work
  // order that closes with a ladder still on site has simply lost the ladder.
  const outstandingReturnRows=outstandingReturns(actualMaterials,actualTools)
  const returnsSettledNow=outstandingReturnRows.length===0
  const returnResource=(kind,index)=>{
    const setter=kind==='tool'?setActualTools:setActualMaterials
    setter(rows=>rows.map((row,rowIndex)=>rowIndex===index?markReturned({...row,type:kind==='tool'?'Tool':'Material'}):row))
  }
  const actualLaborRequirementMissing=[!actualLabor.trim()&&'Actual: labor',!Number(actualHours)&&'Actual: labor hours'].filter(Boolean)
  const executionNotesRequirementMissing=[!technicianRemarks.trim()&&'Actual: technician remarks',!completionNotes.trim()&&'Actual: completion notes'].filter(Boolean)
  const actualResourcesRequirementMissing=[!actualMaterialsReady&&'Actual: materials',!actualToolsReady&&'Actual: tools'].filter(Boolean)
  const returnsRequirementMissing=[!returnsSettledNow&&`Return to store: ${describeOutstanding(actualMaterials,actualTools)}`].filter(Boolean)
  const completionMissing=[
    ...(workflowHasRequirement(workflow,'execution_notes')?executionNotesRequirementMissing:[]),
    ...(workflowHasRequirement(workflow,'actual_labor')?actualLaborRequirementMissing:[]),
    ...(workflowHasRequirement(workflow,'actual_resources')?actualResourcesRequirementMissing:[])
  ]
  const returnMissing=workflowHasRequirement(workflow,'returns')?returnsRequirementMissing:[]
  const requirementMissingById={
    overview:overviewRequirementMissing,
    planned_labor:plannedLaborRequirementMissing,
    planned_materials_cm:plannedMaterialsRequirementMissing,
    planned_tools_cm:plannedToolsRequirementMissing,
    ptw:ptwRequirementMissing,
    store_issue:storeIssueRequirementMissing,
    failure:failureRequirementMissing,
    actual_labor:actualLaborRequirementMissing,
    execution_notes:executionNotesRequirementMissing,
    actual_resources:actualResourcesRequirementMissing,
    returns:returnsRequirementMissing
  }
  const missingFor=target=>[...new Set(workflowRequirementsForStatus(workflow,target).flatMap(requirement=>requirementMissingById[requirement]||[]))]
  const actualMissing=[...completionMissing,...returnMissing]
  const actualReady=missingFor('CLOSE').length===0
  const completionReady=missingFor('COMP').length===0
  const status = selectedStatus
  const configuredNextStep=getWorkflowNextStep(workflow,status)
  const notifyStatusChange=next=>{
    if(String(selectedStatus||'').toUpperCase()===String(next||'').toUpperCase()) return
    onNotifyWorkOrderStatus?.({
      ...order,
      ...currentWorkOrderSnapshot(),
      STATUS: next,
      'STATUS DESCRIPITION': workOrderDisplayStatus(isPM,workflow,next)
    })
  }
  // `chained` is set only by the automatic advance, which has already walked the steps one at a
  // time and checked each one - so the single commit it asks for may skip several statuses.
  const changeStatus=(value,options)=>{
    const next=normalizeWoStatus(value)
    const chained=options?.chained===true
    if(['CLOSE','CAN'].includes(next)&&!canCloseWorkOrder) return
    if((workOrderHoldStatuses.includes(next)||workOrderHoldStatuses.includes(selectedStatus))&&!canManageHold) return
    // The select disables invalid options, but guard here too so no other caller can
    // drive the work order off the workflow.
    if(!chained&&!canTransitionWorkOrder(selectedStatus,next,heldFrom,workflow)) return
    notifyStatusChange(next)
    const wasHold=workOrderHoldStatuses.includes(selectedStatus)
    if(workOrderHoldStatuses.includes(next)) setHeldFrom(selectedStatus)
    else if(wasHold) setHeldFrom('')
    if(workOrderHoldStatuses.includes(next)) {
      const reason=next===HOLD_MATERIAL?'MATERIAL':next===HOLD_PERMIT?'PERMIT':'GENERAL'
      setHoldPeriods(current=>startHold({holdPeriods:current},reason))
    } else if(wasHold) setHoldPeriods(current=>endHold({holdPeriods:current}))
    setSelectedStatus(next)
    setWorkApproved(['APPR','WSCH','SCHED','INPRG','COMP','CLOSE'].includes(next))
    setWorkWaitingSchedule(['WSCH','SCHED','INPRG','COMP','CLOSE'].includes(next))
    setWorkScheduled(['SCHED','INPRG','COMP','CLOSE'].includes(next))
    setWorkStarted(['INPRG','COMP','CLOSE'].includes(next))
    setWorkCompleted(['COMP','CLOSE'].includes(next))
    setWorkClosed(next==='CLOSE')
    const now=toDateTimeInput(new Date())
    const startForFinish=actualStart||now
    if(['INPRG','COMP','CLOSE'].includes(next)) setActualStart(current=>current||now)
    if(['COMP','CLOSE'].includes(next)) setActualFinish(current=>current||(Number(actualHours)>0?addHoursToDate(startForFinish,actualHours):now))
  }
  const holdMissing=[materialBlocked&&workflowHasRequirement(workflow,'store_issue')&&'Material Requests: create PR or resolve stock',...ptwMissing].filter(Boolean)
  const alertRequirements=new Set(configuredNextStep?.requirements||workflowRequirementsForStatus(workflow,status))
  const tabAlerts=[
    alertRequirements.has('overview')&&overviewRequirementMissing.length&&'Overview',
    ['planned_labor','planned_materials_cm','planned_tools_cm'].some(requirement=>alertRequirements.has(requirement))&&planMissing.length&&'Plan',
    alertRequirements.has('failure')&&failureRequirementMissing.length&&'Failure',
    alertRequirements.has('store_issue')&&(materialBlocked||supplyChainMissing.length)&&'Material Requests',
    alertRequirements.has('ptw')&&ptwRequirementMissing.length&&'PTW & Files',
    ['actual_labor','execution_notes','actual_resources','returns'].some(requirement=>alertRequirements.has(requirement))&&actualMissing.length&&'Actual'
  ].filter(Boolean)
  const startReady=!missingFor('INPRG').length
  // The banner reports what blocks the NEXT step, not the current one. Asking about the
  // current status always reads "nothing missing" - the work order is already there - which
  // contradicted the disabled action sitting right beneath it.
  const nextInChain=configuredNextStep?.statusCode||''
  const workflowMissing=workOrderHoldStatuses.includes(status)?holdMissing
    :missingFor(status).length?missingFor(status)
    :nextInChain?missingFor(nextInChain):[]
  const allowedStatuses=workOrderTransitions(status,heldFrom,workflow)
  const configuredStatusOptions=workflowStatusOptions(workflow)
  const exceptionalStatusOptions=statusOptions('workOrder')
    .filter(value=>[...workOrderHoldStatuses,'CAN'].includes(value))
    .map(value=>({value,label:maximoWorkOrderStatusDescriptions[value]||value}))
  const allStatusOptions=[...configuredStatusOptions,...exceptionalStatusOptions]
  if(!allStatusOptions.some(option=>option.value===status)) allStatusOptions.push({value:status,label:workOrderDisplayStatus(isPM,workflow,status)})
  const statusSelectOptions=allStatusOptions.map(option=>({
    value:option.value,
    label:`${option.value} · ${workOrderDisplayStatus(isPM,workflow,option.value)}`,
    disabled:option.value!==status&&(!allowedStatuses.includes(option.value)||missingFor(option.value).length>0||(['CLOSE','CAN'].includes(option.value)&&!canCloseWorkOrder)||(workOrderHoldStatuses.includes(option.value)&&!canManageHold))
  }))
  const workflowNextStepText=workOrderHoldStatuses.includes(status)
    ?(status===HOLD_MATERIAL?'SLA is paused. Resume once material is available':status===HOLD_PERMIT?'SLA is paused. Resume once the permit is approved':'Resolve the hold before continuing')
    :!configuredNextStep
      ?'Workflow complete'
      :missingFor(configuredNextStep.statusCode).length
        ?`Complete the configured requirements before ${configuredNextStep.stepName}`
        :configuredNextStep.isAutomatic
          ?`Moving automatically to ${configuredNextStep.stepName}`
          :`Ready to move to ${configuredNextStep.stepName}`

  // Every automatic step whose requirements are already met is resolved here, so completing the
  // plan lands on the final status in one move instead of redrawing the banner at each one.
  const autoAdvanceTo=workflowAutoTarget(workflow,status,code=>
    !(code==='CLOSE'&&!canCloseWorkOrder)&&!missingFor(code).length)
  useEffect(()=>{
    if(!autoAdvanceTo) return
    // Deferred a tick so a keystroke that completes the last required field is committed
    // before the status moves underneath the field being typed in.
    const timer=setTimeout(()=>changeStatus(autoAdvanceTo,{chained:true}),0)
    return ()=>clearTimeout(timer)
  },[autoAdvanceTo])
  useEffect(()=>{
    if(status!=='COMP'&&!['COMPLETED'].includes(status)) return
    if(!missingFor('COMP').length) return
    setSelectedStatus(getWorkflowPreviousStep(workflow,'COMP')?.statusCode||'INPRG')
    setWorkCompleted(false)
    setWorkClosed(false)
  },[status,storeIssueMissing.length,completionMissing.length,failureMissing.length,workflow])
  useEffect(()=>{
    if(status!=='INPRG'||!missingFor('INPRG').length) return
    setSelectedStatus(getWorkflowPreviousStep(workflow,'INPRG')?.statusCode||'SCHED')
    setWorkStarted(false)
    setWorkCompleted(false)
    setWorkClosed(false)
  },[status,ptwBlocked,supplyChainMissing.length,overviewMissing.length,planMissing.length,workflow])
  const closeWork=()=>{if(canCloseWorkOrder)changeStatus('CLOSE')}
  const actualsEditable = true
  const number = order.WORKORDER || 'AUTO'
  const rawTargetFinishTime=targetFinish?new Date(targetFinish).getTime():null
  const actualFinishTime=actualFinish?new Date(actualFinish).getTime():null
  const onWorkflowHold=workOrderHoldStatuses.includes(status)||isOnHold({holdPeriods})
  // The deadline moves forward by whatever time this order has already spent on hold, so
  // waiting on stock never eats into the SLA.
  const targetFinishTime=effectiveTargetTime(rawTargetFinishTime,{holdPeriods})
  const slaBreachedNow=Boolean(!onWorkflowHold&&targetFinishTime&&((actualFinishTime&&actualFinishTime>targetFinishTime)||(!actualFinishTime&&Date.now()>targetFinishTime)))
  const slaLabel=onWorkflowHold?'SLA Paused'
    :!targetFinishTime?'Not defined'
    :actualFinishTime?(slaBreachedNow?'No – SLA Breached':'Yes – SLA Met')
    :(slaBreachedNow?'No – SLA Breached':'Pending – Within SLA')
  const close = () => onClose()
  const reroute=()=>{setTab('Overview');setAssignedDepartment('');setSupervisor('');setWorkStarted(false);setWorkScheduled(false);setWorkWaitingSchedule(false);setWorkApproved(false)}
  const addFiles=category=>async event=>{
    const selected=Array.from(event.target.files||[])
    event.target.value=''
    if(!selected.length) return
    try{
      await uploadWorkOrderFiles(selected,category)
      notify?.(`${selected.length} attachment${selected.length===1?'':'s'} uploaded.`,'success')
    }catch(error){notify?.(error.message||'Unable to upload attachment.','error')}
  }
  const removeFile=async file=>{
    try{await removeWorkOrderAttachment(file);notify?.('Attachment removed.','success')}
    catch(error){notify?.(error.message||'Unable to remove attachment.','error')}
  }
  const downloadFile=async file=>{
    try{await downloadWorkOrderAttachment(file)}
    catch(error){notify?.(error.message||'Unable to download attachment.','error')}
  }
  // Planned labour already names the craft, the hours and who is doing it, so the actual
  // fields start from it rather than being re-keyed. Planned rows store the craft *name*
  // ("HVAC Technician") while the actual field wants the *code* ("HVAC-TECH"), so the crew
  // member is looked up first and the craft name used as a fallback.
  const plannedCraftCode=()=>{
    const named=plannedLabor.find(row=>row.crew||row.craft)
    if(!named) return ''
    const person=laborRecords.find(entry=>entry.name===named.crew)
    if(person?.craftCode) return person.craftCode
    return laborRecords.find(entry=>entry.craft===named.craft)?.craftCode||''
  }
  const plannedCrewName=()=>[...new Set(plannedLabor.map(row=>row.crew).filter(Boolean))].join(', ')
  const plannedTotalHours=()=>{
    const total=plannedLabor.reduce((sum,row)=>sum+(Number(row.hours)||0),0)
    return total?String(total):''
  }
  const addHoursToDate=(start,hours)=>{
    const startDate=new Date(start)
    const hourCount=Number(hours)
    if(!start||Number.isNaN(startDate.getTime())||!hourCount) return ''
    return toDateTimeInput(new Date(startDate.getTime()+(hourCount*60*60*1000)))
  }
  const hoursBetween=(start,finish)=>{
    const startDate=new Date(start)
    const finishDate=new Date(finish)
    if(!start||!finish||Number.isNaN(startDate.getTime())||Number.isNaN(finishDate.getTime())) return ''
    const hours=(finishDate.getTime()-startDate.getTime())/(60*60*1000)
    return hours>=0?String(Math.round(hours*100)/100):''
  }
  const changeActualStart=value=>{
    setActualStart(value)
    if(value&&Number(actualHours)>0) setActualFinish(addHoursToDate(value,actualHours))
    else if(value&&actualFinish) setActualHours(hoursBetween(value,actualFinish))
  }
  const changeActualHours=value=>{
    setActualHours(value)
    if(actualStart&&Number(value)>0) setActualFinish(addHoursToDate(actualStart,value))
  }
  const changeActualFinish=value=>{
    setActualFinish(value)
    if(actualStart&&value) setActualHours(hoursBetween(actualStart,value))
  }
  const issuedQuantityForResource=row=>{
    const reservation=row.reservation
      ? reservationRecords.find(item=>String(item.reservation)===String(row.reservation))
      : null
    return Number(reservation?.deliveredQuantity||reservation?.releasedQuantity||reservation?.arrangedQuantity||row.deliveredQuantity||row.releasedQuantity||row.arrangedQuantity||row.quantity||0)
  }
  const actualResourceKey=row=>`${row.type || ''}|${row.resourceRequestId || row.itemCode || row.item || ''}`
  const mergeActualRows=(current,nextRows,material=false)=>{
    const keepActualRow=row=>Number(row.quantity||0)>0||Number(row.actualQuantity||0)>0
    const dedupeRows=rows=>[...rows.filter(keepActualRow).reduce((map,row)=>{
      const key=actualResourceKey(row)
      const existing=map.get(key)
      if(!existing||Number(row.quantity||0)>Number(existing.quantity||0)) map.set(key,row)
      return map
    },new Map()).values()]
    if(!current.length) return dedupeRows(nextRows)
    const nextByKey=new Map(nextRows.map(row=>[actualResourceKey(row),row]))
    const merged=current.map(row=>{
      const next=nextByKey.get(actualResourceKey(row))
      if(!next) return row
      return {
        ...row,
        ...next,
        quantity: Number(next.quantity||0) || Number(row.quantity||0),
        actualQuantity: material && (!Number(row.actualQuantity)||!Number(row.quantity)) ? next.actualQuantity : row.actualQuantity,
        returned: row.returned,
        returnedQuantity: row.returnedQuantity,
        returnedAt: row.returnedAt
      }
    })
    const seen=new Set(merged.map(actualResourceKey))
    return dedupeRows([...merged,...nextRows.filter(row=>!seen.has(actualResourceKey(row)))])
  }
  const plannedActualMaterials=()=>plannedResources
    .filter(row=>row.type==='Material'&&row.item&&issuedQuantityForResource(row)>0)
    .map(row=>({...row,type:'Material',quantity:issuedQuantityForResource(row),actualQuantity:row.actualQuantity ?? issuedQuantityForResource(row) ?? ''}))
  const plannedActualTools=()=>plannedResources
    .filter(row=>['Tool','Equipment'].includes(row.type)&&row.item&&issuedQuantityForResource(row)>0)
    .map(row=>({...row,type:row.type || 'Tool',quantity:issuedQuantityForResource(row)}))
  useEffect(()=>{
    setActualLabor(current=>current||plannedCrewName())
    setLaborCraft(current=>current||plannedCraftCode())
    setActualHours(current=>current||plannedTotalHours())
    setActualMaterials(current=>mergeActualRows(current,plannedActualMaterials(),true))
    setActualTools(current=>mergeActualRows(current,plannedActualTools()))
  },[plannedLabor,plannedResources,reservationRecords])
  const completeWork=()=>{if(!completionReady){setTab(!failureReady?'Failure':storeIssueMissing.length?'Material Requests':'Actual');return}const now=toDateTimeInput(new Date());const startForFinish=actualStart||now;setActualFinish(current=>current||(Number(actualHours)>0?addHoursToDate(startForFinish,actualHours):now));setActualStart(current=>current||now);setActualMaterials(current=>mergeActualRows(current,plannedActualMaterials(),true));setActualTools(current=>mergeActualRows(current,plannedActualTools()));
    // Only fill blanks - anything already typed by hand wins.
    setActualLabor(current=>current||plannedCrewName());setLaborCraft(current=>current||plannedCraftCode());setActualHours(current=>current||plannedTotalHours());
    setWorkCompleted(true);changeStatus('COMP')}
  const printWorkOrder=()=>{if(isPM&&tab!=='Plan')setTab('Plan');printWithoutBrowserTitle()}
  const currentWorkOrderSnapshot=()=>({
    WORKORDER: number,
    'DESCRIPITION ': description,
    'LONG DESCRIPTION': longDescription,
    PRIORTY: Number(String(priority).charAt(0)) || Number(priority) || 3,
    SITE: siteValue,
    ASSET: assetValue,
    'ASSET DESCRIPTION': assetDescription,
    'LOCATION ': locationValue,
    'DEPARTMENT ': department,
    'SUB DEPARTMENT  NAME': subDepartment,
    'ASSIGNED DEPARTMENT': assignedDepartment,
    'WORK GROUP': workGroup,
    'SYSTEM': systemValue,
    'HELD FROM': heldFrom,
    holdPeriods,
    SUPERVISOR: supervisor,
    'LABOR CRAFT CODE': laborCraft,
    STATUS: status,
    'STATUS DESCRIPITION': workOrderDisplayStatus(isPM,workflow,status),
    'TARGET START ': targetStart,
    'TARGET FINISH ': targetFinish,
    'ACTUAL START ': actualStart,
    'ACTUAL FINISH ': actualFinish,
    'FAILURE CODE': failureClass,
    'PROBLEM CODE': problemCode,
    'CAUSE CODE': causeCode,
    'REMEDY CODE': remedyCode,
    'JOB PLAN': jobPlanNumber,
    'JOB PLAN TASKS': plannedTasks,
    'PLANNED LABOR': plannedLabor,
    'PLANNED RESOURCES': plannedResources,
    'PTW REQUIRED': ptwRequired,
    'TECHNICIAN REMARKS': technicianRemarks,
    'COMPLETION NOTES': completionNotes,
    'ACTUAL LABOR': actualLabor,
    'ACTUAL HOURS': actualHours,
    'ACTUAL MATERIALS': actualMaterials,
    'ACTUAL TOOLS': actualTools,
    'METER ID': meterId,
    'WATER METER ID': waterMeterId,
    'ENERGY METER ID': energyMeterId,
    'METER READING': meterReading,
    'WATER CONSUMPTION': waterConsumption,
    'ENERGY CONSUMPTION': energyConsumption,
    'METER READING DATE': meterReadingDate
  })
  const saveFingerprint=()=>rowFingerprint(currentWorkOrderSnapshot())
  const saveChanges=()=>{
    if(!canEditWorkOrder){setAutoSaveState('Read only');return Promise.resolve()}
    const fingerprint = saveFingerprint()
    if (lastSavedFingerprint.current === fingerprint) {
      setAutoSaveState('Saved')
      return Promise.resolve()
    }
    const updatedOrder = {
      ...order,
      ...currentWorkOrderSnapshot()
    }
    setAutoSaveState('Saving')
    Promise.resolve(onUpdateWorkOrder?.(number, updatedOrder))
      .then(result=>{if(result?.__saveError) throw result.error||new Error('Unable to save work order.');lastSavedFingerprint.current = fingerprint; setAutoSaveState('Saved')})
      .catch(()=>setAutoSaveState('Save failed'))
  }
  useEffect(()=>{
    if(!saveReady.current){saveReady.current=true;lastSavedFingerprint.current=saveFingerprint();return}
    if(lastSavedFingerprint.current===saveFingerprint()){setAutoSaveState('Saved');return}
    setAutoSaveState('Unsaved changes')
    const timer=setTimeout(saveChanges,650)
    return()=>clearTimeout(timer)
  },[description,longDescription,priority,department,subDepartment,assignedDepartment,workGroup,supervisor,laborCraft,siteValue,assetValue,assetDescription,locationValue,targetStart,targetFinish,failureClass,problemCode,causeCode,remedyCode,plannedLabor,plannedResources,plannedTasks,ptwRequired,technicianRemarks,completionNotes,actualLabor,actualHours,actualMaterials,actualTools,actualStart,actualFinish,meterId,waterMeterId,energyMeterId,meterReading,waterConsumption,energyConsumption,meterReadingDate,selectedStatus,workApproved,workWaitingSchedule,workScheduled,workStarted,workCompleted,workClosed])
  return <div className={page?'w-full':'fixed inset-0 z-50 overflow-auto bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_72%,transparent)] p-6 backdrop-blur-sm'}><div className={`${page?'mx-auto w-full max-w-[1400px] space-y-3 bg-transparent p-0':'mx-auto max-w-7xl space-y-4 rounded-3xl bg-[var(--app-panel)] p-0 shadow-2xl'} wo-screen`}>
    <WorkOrderHeader number={number} workType={workType} status={status} statusDescription={workOrderDisplayStatus(isPM,workflow,status)} statusTone={workflowStepByStatus(workflow,status)?.badgeTone} description={description || order.DESCRIPTION || 'Enter work order information'} isPM={isPM} statusOptions={statusSelectOptions} onStatusChange={changeStatus} close={close} printWorkOrder={printWorkOrder} workClosed={workClosed} statusLocked={!canEditWorkOrder||!workflow.allowManualStatusChange} />
    <WorkOrderTabs tabs={visibleWorkOrderTabs} active={tab} onChange={setTab} alertTabs={tabAlerts} meta={<WorkOrderDatesBar readOnly={!canEditWorkOrder} isPM={isPM} reportedDate={reportedDateValue} targetStart={targetStart} setTargetStart={setTargetStart} targetFinish={targetFinish} setTargetFinish={setTargetFinish} actualStart={actualStart} actualFinish={actualFinish} />} />
    <WorkOrderWorkflowNotice status={status} missing={workflowMissing} nextStep={workflowNextStepText} />
    <div className={workOrderBodyClass}>
      {tab==='Overview' && <WorkOrderOverviewTab readOnly={!canEditWorkOrder} projectName={projectName} sourceRequest={sourceRequest} number={number} status={status} workType={workType} priority={priority} setPriority={setPriority} description={description} setDescription={setDescription} siteValue={siteValue} changeSite={changeSite} siteOptions={siteOptions} longDescription={longDescription} setLongDescription={setLongDescription} assetValue={assetValue} changeAsset={changeAsset} assetOptions={assetOptions} locationValue={locationValue} setLocationValue={setLocationValue} locationOptions={locationOptions} assetDescription={assetDescription} setAssetDescription={setAssetDescription} department={department} setDepartment={setDepartment} departmentOptions={departmentOptions} subDepartment={subDepartment} setSubDepartment={setSubDepartment} subDepartmentOptions={subDepartmentOptions} assignedDepartment={assignedDepartment} setAssignedDepartment={setAssignedDepartment} setWorkGroup={setWorkGroup} setSupervisor={setSupervisor} workGroup={workGroup} workGroupOptions={workGroupOptions} systemValue={systemValue} setSystemValue={setSystemValue} systemOptions={systemOptions} supervisor={supervisor} supervisorOptions={supervisorOptions} laborCraft={laborCraft} setLaborCraft={setLaborCraft} laborCraftOptions={laborCraftOptions} reportedDate={reportedDateValue} targetStart={targetStart} setTargetStart={setTargetStart} targetFinish={targetFinish} setTargetFinish={setTargetFinish} actualStart={actualStart} setActualStart={setActualStart} actualFinish={actualFinish} setActualFinish={setActualFinish} slaLabel={slaLabel} isPM={isPM} />}
      {tab==='Plan' && <WorkOrderPlanTab readOnly={!canEditWorkOrder} isPM={isPM} tasksLocked={tasksFromJobPlan} jobPlanNumber={jobPlanNumber} estimatedDuration={order['ESTIMATED DURATION']} safetyInstructions={order['SAFETY INSTRUCTIONS']} checklist={order.CHECKLIST||[]} plannedLabor={plannedLabor} setPlannedLabor={setPlannedLabor} plannedResources={plannedResources} setPlannedResources={setPlannedResources} plannedTasks={plannedTasks} setPlannedTasks={setPlannedTasks} plannedCraftOptions={plannedCraftOptions} plannedCrewOptions={plannedCrewOptions} materialMaster={materialRecords} toolMaster={toolRecords} updatePlanRow={updatePlanRow} updatePlannedResource={updatePlannedResource} updatePlannedResourceField={updatePlannedResourceField} />}
      {tab==='Actual' && <WorkOrderActualTab readOnly={!canEditWorkOrder} actualsEditable={actualsEditable} status={status} nextStatus={nextInChain} preparationReady={startReady} planReady={planReady} setTab={setTab} setWorkStarted={value=>{if(value&&startReady)changeStatus('INPRG')}} completeWork={completeWork} showStartAction={!workflowStepByStatus(workflow,'INPRG')?.isAutomatic} showCompleteAction={!workflowStepByStatus(workflow,'COMP')?.isAutomatic} showCloseAction={canCloseWorkOrder&&!workflowStepByStatus(workflow,'CLOSE')?.isAutomatic} completionReady={completionReady} completionBlocked={missingFor('COMP').join(', ')} startBlocked={missingFor('INPRG').join(', ')} outlineButtonClass={workOrderOutlineButtonClass} primaryButtonClass={workOrderPrimaryButtonClass} targetStart={targetStart} targetFinish={targetFinish} actualFinish={actualFinish} completionDate={order['COMPLETED AT']} closedAt={order['CLOSED AT']} closedBy={order['CLOSED BY']} setActualFinish={changeActualFinish} slaBreachedNow={slaBreachedNow} slaLabel={slaLabel} technicianRemarks={technicianRemarks} setTechnicianRemarks={setTechnicianRemarks} completionNotes={completionNotes} setCompletionNotes={setCompletionNotes} actualLabor={actualLabor} setActualLabor={setActualLabor} actualHours={actualHours} setActualHours={changeActualHours} actualStart={actualStart} setActualStart={changeActualStart} actualMaterials={actualMaterials} setActualMaterials={setActualMaterials} actualTools={actualTools} setActualTools={setActualTools} updateActualRow={updateActualRow} workClosed={workClosed} actualReady={actualReady} closeWork={closeWork} returnResource={returnResource} outstanding={outstandingReturnRows} currentUser={user} />}
      {tab==='Failure' && <WorkOrderFailureTab readOnly={!canEditWorkOrder} isCM={isCM} causeApplicable={causeApplicable} remedyApplicable={remedyApplicable} failureClass={failureClass} changeFailure={changeFailure} failureClassOptions={failureClassOptions} problemCode={problemCode} setProblemCode={setProblemCode} setCauseCode={setCauseCode} setRemedyCode={setRemedyCode} problemOptions={problemOptions} causeCode={causeCode} causeOptions={causeOptions} remedyCode={remedyCode} remedyOptions={remedyOptions} failureDescription={failureDescription} problemDescription={problemDescription} causeDescription={causeDescription} remedyDescription={remedyDescription} failureCount={failureCodeRecords.length} />}
      {tab==='Material Requests' && <WorkOrderMaterialRequestsTab readOnly={!canEditWorkOrder} resourceRequests={resourceRequests} plannedResources={plannedResources} setPlannedResources={setPlannedResources} updatePlanRow={updatePlanRow} getAvailability={resourceAvailability} materialBlocked={materialBlocked} primaryButtonClass={workOrderPrimaryButtonClass} outlineButtonClass={workOrderOutlineButtonClass} setTab={setTab} materials={materialRecords} reservations={reservationRecords} purchaseRequests={purchaseRequestRecords} purchaseOrders={purchaseOrderRecords} workOrderContext={{ number, site: siteValue, department: department || assignedDepartment, assignedDepartment }} onCreatePurchaseRequest={onCreatePurchaseRequest} onCreateReservation={onCreateReservation} />}
      {tab==='PTW & Files' && <WorkOrderDocumentsTab readOnly={!canEditWorkOrder} ptwRequired={ptwRequired} setPtwRequired={setPtwRequired} allowPtwOverride={workflow.allowPtwOverride} ptwFiles={ptwFiles} generalFiles={generalFiles} addFiles={addFiles} removeFile={removeFile} downloadFile={downloadFile} />}
      {tab==='Meters' && <WorkOrderMetersTab readOnly={!canEditWorkOrder} workOrderNumber={number} assetValue={assetValue} siteValue={siteValue} department={department} meterRows={meterRecords} meterId={meterId} setMeterId={setMeterId} meterReading={meterReading} setMeterReading={setMeterReading} meterReadingDate={meterReadingDate} setMeterReadingDate={setMeterReadingDate} />}
    </div>
  </div><WorkOrderPrintReport sourceRequest={sourceRequest} systemValue={systemValue} number={number} description={description || order['DESCRIPITION '] || 'Work order'} workType={workType} status={status} priority={priority} siteValue={siteValue} department={department} subDepartment={subDepartment} assignedDepartment={assignedDepartment} locationValue={locationValue} assetValue={assetValue} assetDescription={assetDescription} targetStart={targetStart} targetFinish={targetFinish} actualStart={actualStart} actualFinish={actualFinish} slaLabel={slaLabel} jobPlan={jobPlanNumber} estimatedDuration={order['ESTIMATED DURATION']} safetyInstructions={order['SAFETY INSTRUCTIONS']} checklist={order.CHECKLIST||[]} pmNumber={order['PM NUMBER']} pmCycle={order['PM CYCLE']} plannedTasks={plannedTasks} plannedLabor={plannedLabor} plannedResources={plannedResources} ptwRequired={ptwRequired} ptwFiles={ptwFiles} generalFiles={generalFiles} meterReading={meterReading} waterConsumption={waterConsumption} energyConsumption={energyConsumption} meterReadingDate={meterReadingDate} failureClass={failureClass} problemCode={problemCode} causeCode={causeCode} remedyCode={remedyCode} technicianRemarks={technicianRemarks} completionNotes={completionNotes} actualLabor={actualLabor} actualHours={actualHours} actualMaterials={actualMaterials} actualTools={actualTools} /></div>
}

export default function App() {
  const { isAuthenticated, user, logout, refreshSession, applySessionUpdate } = useAuth()
  const [active, setActive] = useState(()=>routeToPage(window.location.pathname))
  const [routePath, setRoutePath] = useState(() => window.location.pathname)
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [assetRecords,setAssetRecords]=useState([])
  const [overviewSnapshot,setOverviewSnapshot]=useState(null)
  const [locationRecords,setLocationRecords]=useState([])
  const [laborRecords,setLaborRecords]=useState([])
  const [materialRecords,setMaterialRecords]=useState([])
  const [stockRecords,setStockRecords]=useState([])
  const [storeRecords,setStoreRecords]=useState([])
  const [toolRecords,setToolRecords]=useState([])
  const [meterRecords,setMeterRecords]=useState([])
  const [allWorkOrders,setAllWorkOrders]=useState([])
  const [workOrderResourceRecords,setWorkOrderResourceRecords]=useState([])
  const [workOrderContext,setWorkOrderContext]=useState({ workOrder: '', purchaseRequests: [], purchaseOrders: [], reservations: [], meters: [], tasks: [] })
  const [workOrderPageMeta,setWorkOrderPageMeta]=useState({ page: 1, pageSize: 10, total: 0, summary: { total: 0, byType: {} }, loaded: false })
  const [serviceRequests,setServiceRequests]=useState([])
  const [incidents,setIncidents]=useState([])
  const [jobTaskRecords,setJobTaskRecords]=useState([])
  const [jobPlanRecords,setJobPlanRecords]=useState([])
  const [pmScheduleRecords,setPmScheduleRecords]=useState([])
  const [pmRuleRecords,setPmRuleRecords]=useState([])
  const [connectorRecords,setConnectorRecords]=useState([])
  const [notificationRuleRecords,setNotificationRuleRecords]=useState([])
  const [workOrderWorkflow,setWorkOrderWorkflow]=useState(DEFAULT_WORK_ORDER_WORKFLOW)
  const [applicationWorkflows,setApplicationWorkflows]=useState(DEFAULT_APPLICATION_WORKFLOWS)
  const [purchaseRequests,setPurchaseRequests]=useState([])
  const [purchaseOrders,setPurchaseOrders]=useState([])
  const [reservations,setReservations]=useState([])
  const [rolePermissionRecords,setRolePermissionRecords]=useState([])
  const [userRecords,setUserRecords]=useState([])
  const [siteRecords,setSiteRecords]=useState([])
  const [departmentRecords,setDepartmentRecords]=useState([])
  const [failureCodeRecords,setFailureCodeRecords]=useState([])
  const [workspaceLoading,setWorkspaceLoading]=useState(false)
  const [workspaceError,setWorkspaceError]=useState('')
  const [toast,setToast]=useState(null)
  const [projectName]=useState(readProjectName)
  const loadedResourcesRef=useRef(new Set())
  const sessionIdentityRef=useRef('')
  const workOrderQueryRef=useRef({ page: 1, pageSize: 10, search: '', sort: { key: 'REPORTED DATE', direction: 'desc' }, type: 'All', filters: {} })
  const notify = useCallback((message, tone = 'info') => {
    if (!message) return
    setToast({ id: Date.now(), message, tone })
  }, [])
  const sendWorkOrderStatusNotification = useCallback(order => {
    const eventName = notificationEventForWorkOrderStatus(order.STATUS)
    if (!eventName) return
    const emailRules = notificationRuleRecords
      .filter(rule => String(rule.status || 'Active').toLowerCase() === 'active')
      .filter(rule => String(rule.channel || '').toLowerCase() === 'email')
      .filter(rule => String(rule.event || '').toLowerCase() === eventName.toLowerCase())
    const recipients = [...new Set(emailRules.flatMap(rule => splitNotificationRecipients(rule.recipients)).map(item => item.trim()).filter(Boolean))]
    if (!recipients.length) {
      notify(`${eventName}: no email recipients configured.`, 'info')
      return
    }
    const statusLabel = `${order.STATUS} - ${statusDescription('workOrder', order.STATUS) || order['STATUS DESCRIPITION'] || ''}`.trim()
    api.post('/notifications/send-email', {
      recipients,
      subject: `${eventName}: Work order #${order.WORKORDER}`,
      text: [
        `${eventName}`,
        '',
        `Work order: #${order.WORKORDER}`,
        `Status: ${statusLabel}`,
        `Description: ${order['DESCRIPITION '] || order.DESCRIPTION || '-'}`,
        `Site: ${order.SITE || '-'}`,
        `Department: ${order['DEPARTMENT '] || '-'}`,
        `Location: ${order['LOCATION '] || '-'}`,
        `Asset: ${order.ASSET || '-'}`,
        '',
        `Sent from ${projectName || 'CAFM'}.`
      ].join('\n')
    })
      .then(result => notify(`${eventName} email sent to ${result.sentCount || recipients.length} recipient(s).`, 'success'))
      .catch(error => notify(error.message || `${eventName} email failed.`, 'error'))
  }, [notificationRuleRecords, notify, projectName])
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(timer)
  }, [toast])
  const applyWorkspaceData = useCallback(data => {
    if (Object.hasOwn(data, 'overviewSnapshot')) setOverviewSnapshot(data.overviewSnapshot)
    if (Object.hasOwn(data, 'assets')) setAssetRecords(data.assets)
    if (Object.hasOwn(data, 'locations')) setLocationRecords(data.locations)
    if (Object.hasOwn(data, 'labor')) setLaborRecords(data.labor)
    if (Object.hasOwn(data, 'materials')) setMaterialRecords(data.materials)
    if (Object.hasOwn(data, 'inventoryStock')) setStockRecords(data.inventoryStock)
    if (Object.hasOwn(data, 'storerooms')) setStoreRecords(data.storerooms)
    if (Object.hasOwn(data, 'tools')) setToolRecords(data.tools)
    if (Object.hasOwn(data, 'workOrders')) setAllWorkOrders(data.workOrders)
    if (Object.hasOwn(data, 'workOrderPage')) setWorkOrderPageMeta({ ...data.workOrderPage, loaded: true })
    if (Object.hasOwn(data, 'workOrderResources')) setWorkOrderResourceRecords(data.workOrderResources)
    if (Object.hasOwn(data, 'serviceRequests')) setServiceRequests(data.serviceRequests)
    if (Object.hasOwn(data, 'incidents')) setIncidents(data.incidents)
    if (Object.hasOwn(data, 'jobTasks')) setJobTaskRecords(data.jobTasks)
    if (Object.hasOwn(data, 'jobPlans')) setJobPlanRecords(data.jobPlans)
    if (Object.hasOwn(data, 'pmSchedules')) setPmScheduleRecords(data.pmSchedules)
    if (Object.hasOwn(data, 'pmRules')) setPmRuleRecords(data.pmRules)
    if (Object.hasOwn(data, 'connectors')) setConnectorRecords(data.connectors)
    if (Object.hasOwn(data, 'notificationRules')) setNotificationRuleRecords(data.notificationRules)
    if (Object.hasOwn(data, 'workOrderWorkflow')) setWorkOrderWorkflow(normalizeWorkOrderWorkflow(data.workOrderWorkflow))
    if (Object.hasOwn(data, 'applicationWorkflows')) setApplicationWorkflows(data.applicationWorkflows)
    if (Object.hasOwn(data, 'purchaseRequests')) setPurchaseRequests(data.purchaseRequests)
    if (Object.hasOwn(data, 'purchaseOrders')) setPurchaseOrders(data.purchaseOrders)
    if (Object.hasOwn(data, 'reservations')) setReservations(data.reservations)
    if (Object.hasOwn(data, 'meters')) setMeterRecords(data.meters)
    if (Object.hasOwn(data, 'roles')) setRolePermissionRecords(data.roles)
    if (Object.hasOwn(data, 'users')) setUserRecords(data.users)
    if (Object.hasOwn(data, 'sites')) setSiteRecords(data.sites)
    if (Object.hasOwn(data, 'departments')) setDepartmentRecords(data.departments)
    if (Object.hasOwn(data, 'failureCodes')) setFailureCodeRecords(data.failureCodes)
  }, [])
  useEffect(() => {
    const identity = isAuthenticated ? String(user?.userId || user?.username || '') : ''
    if (sessionIdentityRef.current === identity) return
    sessionIdentityRef.current = identity
    loadedResourcesRef.current.clear()
    setOverviewSnapshot(null)
    setAssetRecords([])
    setLocationRecords([])
    setLaborRecords([])
    setMaterialRecords([])
    setStockRecords([])
    setStoreRecords([])
    setToolRecords([])
    setMeterRecords([])
    setAllWorkOrders([])
    setWorkOrderResourceRecords([])
    setWorkOrderContext({ workOrder: '', purchaseRequests: [], purchaseOrders: [], reservations: [], meters: [], tasks: [] })
    setWorkOrderPageMeta({ page: 1, pageSize: 10, total: 0, summary: { total: 0, byType: {} }, loaded: false })
    setServiceRequests([])
    setIncidents([])
    setJobTaskRecords([])
    setJobPlanRecords([])
    setPmScheduleRecords([])
    setPmRuleRecords([])
    setConnectorRecords([])
    setNotificationRuleRecords([])
    setApplicationWorkflows(DEFAULT_APPLICATION_WORKFLOWS)
    setPurchaseRequests([])
    setPurchaseOrders([])
    setReservations([])
    setRolePermissionRecords([])
    setUserRecords([])
    setSiteRecords([])
    setDepartmentRecords([])
    setFailureCodeRecords([])
    setWorkspaceError('')
  }, [isAuthenticated, user?.userId, user?.username])
  const refreshWorkspace = useCallback(async ({ silent = false, resources, force = false, workOrderQuery } = {}) => {
    if (!isAuthenticated) return
    const requested = [...new Set(resources || resourcesForPage(active, routePath))]
    const pending = force ? requested : requested.filter(resource => !loadedResourcesRef.current.has(resource))
    if (!pending.length) return
    const sessionIdentity = sessionIdentityRef.current
    if (!silent) setWorkspaceLoading(true)
    setWorkspaceError('')
    try {
      const firstLoad = loadedResourcesRef.current.size === 0
      const data = await loadWorkspace({ resources: pending, workOrderQuery: workOrderQuery || workOrderQueryRef.current })
      if (sessionIdentityRef.current !== sessionIdentity) return
      applyWorkspaceData(data)
      pending.forEach(resource => loadedResourcesRef.current.add(resource))
      if (firstLoad || pending.some(resource => ['roles', 'users'].includes(resource))) await refreshSession()
    } catch (error) {
      if (error.status === 401) {
        logout()
        return
      }
      setWorkspaceError(error.message || 'Unable to load backend data.')
    } finally {
      if (!silent && sessionIdentityRef.current === sessionIdentity) setWorkspaceLoading(false)
    }
  }, [active, applyWorkspaceData, isAuthenticated, logout, refreshSession, routePath])
  const requestWorkOrderPage = useCallback(async query => {
    if (!isAuthenticated) return null
    workOrderQueryRef.current = { ...workOrderQueryRef.current, ...query }
    const sessionIdentity = sessionIdentityRef.current
    try {
      const result = await loadWorkOrderPage(workOrderQueryRef.current)
      if (sessionIdentityRef.current !== sessionIdentity) return null
      setAllWorkOrders(result.rows)
      setWorkOrderPageMeta({ ...result, loaded: true })
      loadedResourcesRef.current.add('workOrders')
      return result
    } catch (error) {
      if (error.status === 401) logout()
      else notify(error.message || 'Unable to load work orders.', 'error')
      return null
    }
  }, [isAuthenticated, logout, notify])
  const loadWorkOrderById = useCallback(async workOrderNumber => {
    if (!workOrderNumber || workOrderNumber === 'new') return null
    const sessionIdentity = sessionIdentityRef.current
    const detailResources = resourcesForPage('Work Orders', `/work-orders/${workOrderNumber}`).filter(resource => resource !== 'workOrders')
    const [, detailResult] = await Promise.all([
      refreshWorkspace({ resources: detailResources, silent: true }),
      loadWorkOrderDetail(workOrderNumber)
    ])
    if (sessionIdentityRef.current !== sessionIdentity) return null
    const detail = detailResult.order
    setWorkOrderContext({ workOrder: String(workOrderNumber), ...detailResult.context })
    setAllWorkOrders(current => [...current.filter(order => String(order.WORKORDER) !== String(workOrderNumber)), detail])
    return detail
  }, [refreshWorkspace])
  useEffect(() => {
    refreshWorkspace({ resources: resourcesForPage(active, routePath) })
  }, [active, routePath, refreshWorkspace])
  useEffect(() => {
    if (!isAuthenticated) return undefined
    let timer
    const pendingResources = new Set()
    let refreshOpenWorkOrder = false
    const unsubscribe = subscribeWorkspaceChanges(change => {
      const currentPath = window.location.pathname
      const currentPage = routeToPage(currentPath)
      const visibleResources = new Set(resourcesForPage(currentPage, currentPath))
      const changedResources = resourcesForWorkspaceChange(change)
      changedResources.forEach(resource => loadedResourcesRef.current.delete(resource))
      if (change.actor && String(change.actor) === String(user?.userId || user?.username || '')) return
      if (String(change.table || '').toLowerCase() === 'dbo.attachments' && currentPage !== 'Overview') return
      changedResources.forEach(resource => {
        if (visibleResources.has(resource)) pendingResources.add(resource)
      })
      if (workOrderChildTables.has(String(change.table || '').toLowerCase()) && /^\/work-orders\/[^/]+/.test(currentPath)) refreshOpenWorkOrder = true
      if (String(change.table || '').toLowerCase() === 'dbo.work_orders' && /^\/work-orders\/[^/]+/.test(currentPath)) {
        const routeNumber = decodeURIComponent(currentPath.split('/work-orders/')[1] || '')
        if (!change.id || String(change.id) === String(routeNumber)) refreshOpenWorkOrder = true
      }
      clearTimeout(timer)
      timer = setTimeout(async () => {
        const currentPathAtFlush = window.location.pathname
        const currentPageAtFlush = routeToPage(currentPathAtFlush)
        const workOrderDetailOpen = /^\/work-orders\/[^/]+/.test(currentPathAtFlush)
        if (refreshOpenWorkOrder) {
          const routeNumber = decodeURIComponent(currentPathAtFlush.split('/work-orders/')[1] || '')
          await loadWorkOrderById(routeNumber).catch(() => {})
        }
        if (workOrderDetailOpen) pendingResources.delete('workOrders')
        if (pendingResources.has('workOrders') && currentPageAtFlush === 'Work Orders') {
          await requestWorkOrderPage(workOrderQueryRef.current)
          pendingResources.delete('workOrders')
        }
        const resources = [...pendingResources].filter(resource => !['workOrderPlannedLabor', 'workOrderTasks'].includes(resource))
        pendingResources.clear()
        refreshOpenWorkOrder = false
        if (resources.length) await refreshWorkspace({ resources, force: true, silent: true })
      }, 180)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [isAuthenticated, loadWorkOrderById, refreshWorkspace, requestWorkOrderPage, user?.userId, user?.username])
  const effectiveUser = useMemo(() => {
    if (!user) return null
    const account = userRecords.find(row => row.userId === user.userId || row.username === user.username) || user
    const role = rolePermissionRecords.find(row => row.role === user.role)
    const rolePermissions = role?.permissions && Object.keys(role.permissions).length ? role.permissions : user.permissions
    return role ? {
      ...user,
      ...account,
      permissions: rolePermissions || {},
      roleStatus: role.status,
      dataScope: account.dataScope || (account.dataScopeOverride && account.dataScopeOverride !== 'ROLE' ? account.dataScopeOverride : role.dataScope) || user.dataScope,
      siteScope: account.site || role.site,
      departmentScope: account.department || role.department
    } : { ...user, ...account, role: account.role || user.role, siteScope: account.site, departmentScope: account.department }
  }, [user, userRecords, rolePermissionRecords])

  // effectiveUser already reflects an edited user record, but only for the data arrays
  // below. Everything that reads useAuth().user directly - eleven components - would keep
  // the snapshot taken at login until a logout. Pushing the merged scope back into the
  // session makes those current too, so changing a user's site takes effect immediately.
  useEffect(() => {
    if (!user || !effectiveUser) return
    applySessionUpdate({
      site: effectiveUser.site,
      department: effectiveUser.department,
      role: effectiveUser.role,
      status: effectiveUser.status,
      permissions: effectiveUser.permissions,
      dataScope: effectiveUser.dataScope,
      dataScopeOverride: effectiveUser.dataScopeOverride,
      siteScope: effectiveUser.siteScope,
      departmentScope: effectiveUser.departmentScope
    })
    // applySessionUpdate no-ops when nothing actually differs, which is what stops this
    // effect and the session state from feeding each other.
  }, [effectiveUser, user, applySessionUpdate])

  const scopedAssets = useMemo(() => scopeRowsForUser(assetRecords, effectiveUser, ['site'], ['department', 'sub department']), [assetRecords, effectiveUser])
  const scopedWorkOrders = useMemo(() => scopeRowsForUser(allWorkOrders, effectiveUser, ['SITE'], ['DEPARTMENT ', 'ASSIGNED DEPARTMENT', 'SUB DEPARTMENT  NAME']), [allWorkOrders, effectiveUser])
  const scopedServiceRequests = useMemo(() => scopeRowsForUser(serviceRequests, effectiveUser, ['site'], ['department', 'assignedDepartment', 'subDepartment']), [serviceRequests, effectiveUser])
  const scopedIncidents = useMemo(() => scopeRowsForUser(incidents, effectiveUser, ['site'], ['department']), [incidents, effectiveUser])
  const scopedLocations = useMemo(() => scopeRowsForUser(locationRecords, effectiveUser, ['site'], ['department']), [locationRecords, effectiveUser])
  const scopedPurchaseRequests = useMemo(() => scopeRowsForUser(purchaseRequests, effectiveUser, ['site'], ['department']), [purchaseRequests, effectiveUser])
  const scopedPurchaseOrders = useMemo(() => scopeRowsForUser(purchaseOrders, effectiveUser, ['site'], ['department']), [purchaseOrders, effectiveUser])
  const scopedReservations = useMemo(() => scopeRowsForUser(reservations, effectiveUser, ['site'], ['department']), [reservations, effectiveUser])
  const canDo = useCallback((moduleName, action) => canUseAction(effectiveUser, moduleName, action), [effectiveUser])
  const saveWorkOrderWorkflow = useCallback(async nextWorkflow => {
    if (!canDo('Work Order Workflow', 'edit')) {
      const error = new Error('No edit access for Work Order Workflow. Ask an administrator to update your role permissions.')
      notify(error.message, 'error')
      throw error
    }
    try {
      const saved = mapWorkOrderWorkflow(await api.put('/work-order-workflow', workOrderWorkflowToApi(nextWorkflow)))
      setWorkOrderWorkflow(saved)
      notify('Work order workflow controls saved and applied.', 'success')
      return saved
    } catch (error) {
      notify(error.message || 'Unable to save Work Order Workflow.', 'error')
      throw error
    }
  }, [canDo, notify])
  const saveApplicationWorkflow = useCallback(async (workflowKey, nextWorkflow) => {
    if (!canDo('Work Order Workflow', 'edit')) {
      const error = new Error('No edit access for Workflow Controls. Ask an administrator to update your role permissions.')
      notify(error.message, 'error')
      throw error
    }
    try {
      const saved = normalizeApplicationWorkflow(
        await api.put(`/application-workflows/${workflowKey}`, applicationWorkflowToApi(nextWorkflow)),
        workflowKey
      )
      setApplicationWorkflows(current => ({ ...current, [workflowKey]: saved }))
      notify(`${saved.moduleName} workflow controls saved and applied.`, 'success')
      return saved
    } catch (error) {
      notify(error.message || 'Unable to save workflow controls.', 'error')
      throw error
    }
  }, [canDo, notify])
  const guardSave = useCallback((moduleName, saveFn) => update => {
    const permissionModule = moduleName === 'Job Plan Tasks' ? 'Job Plans' : moduleName
    const beforeRows = moduleName === 'Assets' ? assetRecords
      : moduleName === 'Locations' ? locationRecords
      : moduleName === 'Labor' ? laborRecords
      : moduleName === 'Materials' ? materialRecords
      : moduleName === 'Stores' ? storeRecords
      : moduleName === 'Tools & Equipment' ? toolRecords
      : moduleName === 'Failure Library' ? failureCodeRecords
      : moduleName === 'Meters' ? meterRecords
      : moduleName === 'Work Orders' ? allWorkOrders
      : moduleName === 'Job Requests' ? serviceRequests
      : moduleName === 'Incidents' ? incidents
      : moduleName === 'Preventive Maintenance' ? pmScheduleRecords
      : moduleName === 'PM Schedule Rules' ? pmRuleRecords
      : moduleName === 'SMTP & SMS' ? connectorRecords
      : moduleName === 'Settings' ? notificationRuleRecords
      : moduleName === 'Purchase Requisitions' ? purchaseRequests
      : moduleName === 'Purchase Orders' ? purchaseOrders
      : moduleName === 'Reservations' ? reservations
      : moduleName === 'Sites' ? siteRecords
      : moduleName === 'Departments' ? departmentRecords
      : moduleName === 'Job Plans' ? jobPlanRecords
      : moduleName === 'Job Plan Tasks' ? jobTaskRecords
      : moduleName === 'Users' ? userRecords
      : moduleName === 'Roles & Permissions' ? rolePermissionRecords
      : []
    const nextRows = typeof update === 'function' ? update(beforeRows) : update
    const beforeCount = Array.isArray(beforeRows) ? beforeRows.length : 0
    const nextCount = Array.isArray(nextRows) ? nextRows.length : 0
    const action = nextCount > beforeCount ? 'create' : nextCount < beforeCount ? 'edit' : 'edit'
    if (!canDo(permissionModule, action)) {
      notify(`No ${action} access for ${permissionModule}. Ask an administrator to update your role permissions.`, 'error')
      return Promise.resolve()
    }
    return saveFn(nextRows)
      .then(result => {
        if (action === 'create') notify(`${moduleName} saved.`, 'success')
        else if (moduleName === 'Roles & Permissions') notify('Role permissions saved.', 'success')
        return result
      })
      .catch(error => {
        notify(error.message || `Unable to save ${moduleName}.`, 'error')
        refreshWorkspace({ silent: true })
        return { __saveError: true, error }
      })
  }, [assetRecords, locationRecords, laborRecords, materialRecords, storeRecords, toolRecords, failureCodeRecords, meterRecords, allWorkOrders, serviceRequests, incidents, pmScheduleRecords, pmRuleRecords, connectorRecords, notificationRuleRecords, purchaseRequests, purchaseOrders, reservations, siteRecords, departmentRecords, jobPlanRecords, jobTaskRecords, userRecords, rolePermissionRecords, canDo, notify, refreshWorkspace])
  const rawSaveAssets = useMemo(() => backendSetter(setAssetRecords, apiMappers.assets), [])
  const rawSaveLocations = useMemo(() => backendSetter(setLocationRecords, apiMappers.locations), [])
  const rawSaveLabor = useMemo(() => backendSetter(setLaborRecords, apiMappers.labor), [])
  const rawSaveMaterials = useMemo(() => backendSetter(setMaterialRecords, apiMappers.materials), [])
  const rawSaveStores = useMemo(() => backendSetter(setStoreRecords, apiMappers.stores), [])
  const rawSaveTools = useMemo(() => backendSetter(setToolRecords, apiMappers.tools), [])
  const rawSaveFailureCodes = useMemo(() => backendSetter(setFailureCodeRecords, apiMappers.failureCodes), [])
  const rawSaveMeters = useMemo(() => backendSetter(setMeterRecords, apiMappers.meters), [])
  const rawSaveWorkOrders = useMemo(() => backendSetter(setAllWorkOrders, apiMappers.workOrders), [])
  const rawSaveServiceRequests = useMemo(() => backendSetter(setServiceRequests, apiMappers.serviceRequests), [])
  const rawSaveIncidents = useMemo(() => backendSetter(setIncidents, apiMappers.incidents), [])
  const rawSavePmSchedules = useMemo(() => backendSetter(setPmScheduleRecords, apiMappers.pm), [])
  const rawSavePmRules = useMemo(() => backendSetter(setPmRuleRecords, apiMappers.pmRules), [])
  const rawSaveConnectors = useMemo(() => backendSetter(setConnectorRecords, apiMappers.connectors), [])
  const rawSaveNotificationRules = useMemo(() => backendSetter(setNotificationRuleRecords, apiMappers.notificationRules), [])
  const rawSaveSites = useMemo(() => backendSetter(setSiteRecords, apiMappers.sites), [])
  const rawSaveDepartments = useMemo(() => backendSetter(setDepartmentRecords, apiMappers.departments), [])
  const rawSaveJobPlans = useMemo(() => backendSetter(setJobPlanRecords, apiMappers.jobPlans), [])
  const rawSaveJobTasks = useMemo(() => backendSetter(setJobTaskRecords, apiMappers.jobTasks), [])
  const rawSaveUsers = useMemo(() => backendSetter(setUserRecords, apiMappers.users), [])
  const rawSaveRoles = useMemo(() => backendSetter(setRolePermissionRecords, apiMappers.roles), [])
  const saveAssets = useMemo(() => guardSave('Assets', rawSaveAssets), [guardSave, rawSaveAssets])
  const saveLocations = useMemo(() => guardSave('Locations', rawSaveLocations), [guardSave, rawSaveLocations])
  const saveLabor = useMemo(() => guardSave('Labor', rawSaveLabor), [guardSave, rawSaveLabor])
  const saveMaterials = useMemo(() => guardSave('Materials', rawSaveMaterials), [guardSave, rawSaveMaterials])
  const saveStores = useMemo(() => guardSave('Stores', rawSaveStores), [guardSave, rawSaveStores])
  const saveTools = useMemo(() => guardSave('Tools & Equipment', rawSaveTools), [guardSave, rawSaveTools])
  const saveFailureCodes = useMemo(() => guardSave('Failure Library', rawSaveFailureCodes), [guardSave, rawSaveFailureCodes])
  const saveMeters = useMemo(() => guardSave('Meters', rawSaveMeters), [guardSave, rawSaveMeters])
  const saveWorkOrders = useMemo(() => guardSave('Work Orders', rawSaveWorkOrders), [guardSave, rawSaveWorkOrders])
  const saveServiceRequests = useMemo(() => guardSave('Job Requests', rawSaveServiceRequests), [guardSave, rawSaveServiceRequests])
  const saveIncidents = useMemo(() => guardSave('Incidents', rawSaveIncidents), [guardSave, rawSaveIncidents])
  const savePmSchedules = useMemo(() => guardSave('Preventive Maintenance', rawSavePmSchedules), [guardSave, rawSavePmSchedules])
  const importPmSchedules = useCallback(async plans => {
    if (!canDo('Preventive Maintenance', 'import')) {
      const error = new Error('No import access for Preventive Maintenance.')
      notify(error.message, 'error')
      throw error
    }
    try {
      const result = await api.post('/preventive-maintenance/import', {
        rows: plans.map(apiMappers.pm.toApi)
      })
      await refreshWorkspace({ resources: ['pmSchedules'], force: true, silent: true })
      notify(`${result.importedCount} PM master${result.importedCount === 1 ? '' : 's'} imported.`, 'success')
      return result
    } catch (error) {
      notify(error.message || 'Unable to import PM masters.', 'error')
      throw error
    }
  }, [canDo, notify, refreshWorkspace])
  const savePmRules = useMemo(() => guardSave('PM Schedule Rules', rawSavePmRules), [guardSave, rawSavePmRules])
  const saveConnectors = useMemo(() => guardSave('SMTP & SMS', rawSaveConnectors), [guardSave, rawSaveConnectors])
  const saveNotificationRules = useMemo(() => guardSave('Settings', rawSaveNotificationRules), [guardSave, rawSaveNotificationRules])
  const saveSites = useMemo(() => guardSave('Sites', rawSaveSites), [guardSave, rawSaveSites])
  const saveDepartments = useMemo(() => guardSave('Departments', rawSaveDepartments), [guardSave, rawSaveDepartments])
  const saveJobPlans = useMemo(() => guardSave('Job Plans', rawSaveJobPlans), [guardSave, rawSaveJobPlans])
  const saveJobTasks = useMemo(() => guardSave('Job Plan Tasks', rawSaveJobTasks), [guardSave, rawSaveJobTasks])
  const saveUsers = useMemo(() => guardSave('Users', rawSaveUsers), [guardSave, rawSaveUsers])
  const saveRoles = useMemo(() => guardSave('Roles & Permissions', rawSaveRoles), [guardSave, rawSaveRoles])
  const siteScopeOptions = useMemo(() => {
    const options = deriveSiteOptions({ siteRecords, user: effectiveUser, locations: scopedLocations, assets: scopedAssets, orders: scopedWorkOrders })
      .map(option => option.label ? `${option.label} / ${option.value}` : option.value)
    return [...(effectiveUser?.dataScope === 'GLOBAL' ? ['All Sites'] : []), ...new Set(options)]
  }, [siteRecords, effectiveUser, scopedLocations, scopedAssets, scopedWorkOrders])
  const departmentScopeOptions = useMemo(() => {
    const options = deriveDepartmentOptions({ departmentRecords, user: effectiveUser, assets: scopedAssets, orders: scopedWorkOrders, locations: scopedLocations })
      .map(option => option.value)
    return [...(effectiveUser?.dataScope === 'GLOBAL' ? ['All Departments'] : []), ...new Set(options)]
  }, [departmentRecords, effectiveUser, scopedAssets, scopedWorkOrders, scopedLocations])
  const workOrderNotifications = buildWorkOrderNotifications(scopedWorkOrders)
  const allowedNavigation = useMemo(() => filterNavigationForUser(navigationItems, effectiveUser), [effectiveUser])
  const fallbackPage = firstAllowedPage(navigationItems, effectiveUser)
  const canNavigate = name => canViewPage(effectiveUser, name)
  const accessFor = useCallback(moduleName => ({
    view: canDo(moduleName, 'view'),
    create: canDo(moduleName, 'create'),
    edit: canDo(moduleName, 'edit'),
    approve: canDo(moduleName, 'approve'),
    close: canDo(moduleName, 'close'),
    import: canDo(moduleName, 'import')
  }), [canDo])
  const activePage = canNavigate(active) ? active : fallbackPage
  // `options.reference` lets a link land on a list page already narrowed to one record.
  const navigate = (name, options = {}) => {
    if (!canNavigate(name)) {
      // Say why. Landing on a different page with no explanation reads as a broken link.
      notify(`No access to ${name}.`, 'error')
      const fallback = fallbackPage || 'Overview'
      const fallbackPath = pathForPage(fallback)
      setActive(fallback)
      setRoutePath(fallbackPath)
      setSearch('')
      setMobileOpen(false)
      window.history.replaceState({}, '', fallbackPath)
      return
    }
    const path = pathForPage(name)
    setActive(name); setRoutePath(path); setSearch(''); setMobileOpen(false); window.history.pushState({},'',pathWithRecordFilter(path, options.reference))
  }
  useEffect(() => {
    if (!isAuthenticated || !effectiveUser) return
    const syncRouteAccess = () => {
      const currentPath = window.location.pathname
      const routePage = routeToPage(currentPath)
      if (canViewPage(effectiveUser, routePage)) {
        setRoutePath(currentPath)
        setActive(routePage)
        return
      }
      if (fallbackPage) {
        const fallbackPath = pathForPage(fallbackPage)
        setActive(fallbackPage)
        setRoutePath(fallbackPath)
        window.history.replaceState({}, '', fallbackPath)
      }
    }
    syncRouteAccess()
    window.addEventListener('popstate', syncRouteAccess)
    return () => window.removeEventListener('popstate', syncRouteAccess)
  }, [isAuthenticated, effectiveUser, fallbackPage])
  const jobPlanRouteId = decodeURIComponent(routePath.split('/job-plans/')[1] || '')
  // Memoised: rebuilt inline this array got a new identity every render, and
  // RegisterPage resyncs on `rows`, which silently wiped anything the user added.
  const jobPlanSummaryRows = useMemo(() => {
    const summarise = (jpnum, description, status) => {
      const tasks = jobTaskRecords.filter(row => row.JPNUM === jpnum)
      return {
        JPNUM: jpnum,
        DESCRIPTION: description || tasks[0]?.DESCRIPTION || '',
        status: status || 'ACTIVE',
        taskCount: tasks.length,
        totalMinutes: tasks.reduce((sum, row) => sum + Math.max(1, Math.round(Number(row['TASK DURATION IN HOUR'] || 0) * 60)), 0)
      }
    }
    const fromMaster = jobPlanRecords.map(plan => summarise(plan.JPNUM, plan.DESCRIPTION, plan.status))
    const known = new Set(fromMaster.map(plan => plan.JPNUM))
    // Union in any plan that exists only as task rows, so the list can never drop one.
    const orphans = [...new Set(jobTaskRecords.map(task => task.JPNUM).filter(Boolean))]
      .filter(jpnum => !known.has(jpnum))
      .map(jpnum => summarise(jpnum))
    return [...fromMaster, ...orphans]
  }, [jobPlanRecords, jobTaskRecords])
  const [selectedJobPlan,setSelectedJobPlan]=useState(jobPlanSummaryRows.find(plan => plan.JPNUM === jobPlanRouteId) || null)
  const failureRouteId = decodeURIComponent(routePath.split('/failure-library/')[1] || '')
  const failureClassRows = useMemo(() => [...new Map(failureCodeRecords.map(row => [row['FAILURE CLASS ID'], row])).values()], [failureCodeRecords])
  const [selectedFailureClass,setSelectedFailureClass]=useState(failureClassRows.find(row => row['FAILURE CLASS ID'] === failureRouteId) || null)
  const relatedJobPlanWorkOrders = useRelatedWorkOrders(
    selectedJobPlan ? { job_plan_num: selectedJobPlan.JPNUM } : null,
    { enabled: Boolean(selectedJobPlan) }
  )
  const relatedFailureWorkOrders = useRelatedWorkOrders(
    selectedFailureClass ? { failure_code: selectedFailureClass['FAILURE CLASS ID'] } : null,
    { enabled: Boolean(selectedFailureClass) }
  )
  const requestFailureOptions = useMemo(() => uniqueCodeOptions(failureCodeRecords, 'FAILURE CLASS ID', 'DESCRIPTION'), [failureCodeRecords])
  useEffect(() => {
    if (!jobPlanRouteId) {
      setSelectedJobPlan(null)
      return
    }
    setSelectedJobPlan(jobPlanSummaryRows.find(plan => plan.JPNUM === jobPlanRouteId) || null)
  }, [jobPlanSummaryRows, jobPlanRouteId])
  useEffect(() => {
    if (!failureRouteId) {
      setSelectedFailureClass(null)
      return
    }
    setSelectedFailureClass(failureClassRows.find(row => row['FAILURE CLASS ID'] === failureRouteId) || null)
  }, [failureClassRows, failureRouteId])
  const firstProblemCodeForFailure = value => failureCodeRecords
    .filter(row => cleanText(row['FAILURE CLASS ID']) === cleanText(value) && cleanText(row['PROBLEM CODE']))
    .sort((left, right) => cleanText(left['PROBLEM CODE']).localeCompare(cleanText(right['PROBLEM CODE']), undefined, { numeric: true, sensitivity: 'base' }))[0]?.['PROBLEM CODE'] || ''
  const failureFieldsFromRequest = request => {
    const failureCode = cleanText(request?.failureCode || request?.['FAILURE CODE'] || request?.failure_code)
    const problemCode = cleanText(request?.problemCode || request?.['PROBLEM CODE'] || request?.problem_code) || firstProblemCodeForFailure(failureCode)
    return {
      'FAILURE CODE': failureCode,
      'PROBLEM CODE': cleanText(problemCode),
      'CAUSE CODE': cleanText(request?.causeCode || request?.['CAUSE CODE'] || request?.cause_code),
      'REMEDY CODE': cleanText(request?.remedyCode || request?.['REMEDY CODE'] || request?.remedy_code)
    }
  }
  const syncWorkOrderFailureFromRequest = (number, sourceRequest) => {
    const request = sourceRequest || serviceRequests.find(item => String(item.convertedWorkOrder) === String(number))
    const fields = failureFieldsFromRequest(request)
    if (!fields['FAILURE CODE']) return
    saveWorkOrders(rows => rows.map(order => {
      if (String(order.WORKORDER) !== String(number)) return order
      return {
        ...order,
        'FAILURE CODE': fields['FAILURE CODE'],
        'PROBLEM CODE': fields['PROBLEM CODE'] || order['PROBLEM CODE'] || '',
        'CAUSE CODE': fields['CAUSE CODE'] || order['CAUSE CODE'] || '',
        'REMEDY CODE': fields['REMEDY CODE'] || order['REMEDY CODE'] || ''
      }
    }))
  }
  const convertRequest = async request => {
    const result = await serviceRequestApi.convertToCorrectiveWorkOrder(request.sr)
    setAllWorkOrders(rows => upsertLocalRecord(rows, result.workOrder, 'WORKORDER'))
    setServiceRequests(rows => upsertLocalRecord(rows, result.serviceRequest, 'sr'))
    return result
  }
  // A role without Work Orders access - a supply chain manager, say - now gets told why nothing
  // happened. Bouncing them to a different page looked like the click had broken the app.
  const openConvertedWorkOrder=(number, sourceRequest)=>{if(!canNavigate('Work Orders')){notify(`No access to Work Orders, so ${number||'this work order'} cannot be opened.`,'error');return}syncWorkOrderFailureFromRequest(number, sourceRequest);setActive('Work Orders');setSearch('');window.history.pushState({},'',`/work-orders/${number}`)}
  // Deep link carries the target number so the tab only applies to that order, never
  // to whichever work order the user opens next.
  const [workOrderDeepLink,setWorkOrderDeepLink]=useState(null)
  const openWorkOrderTab=(number,tab)=>{setWorkOrderDeepLink({number:String(number),tab});openConvertedWorkOrder(number)}
  const deepLinkTabFor=order=>String(order?.WORKORDER)===workOrderDeepLink?.number?workOrderDeepLink.tab:undefined
  const materialCodeFor=value=>materialRecords.find(item=>cleanText(item.itemNumber)===cleanText(value)||cleanText(item.description)===cleanText(value))?.itemNumber||cleanText(value)
  const toolCodeFor=value=>toolRecords.find(item=>cleanText(item.toolNumber)===cleanText(value)||cleanText(item.description)===cleanText(value))?.toolNumber||cleanText(value)
  const itemCodeFor=(type,value)=>['Tool','Equipment'].includes(type)?toolCodeFor(value):materialCodeFor(value)
  const storeCodeFor=value=>storeRecords.find(store=>cleanText(store.code)===cleanText(value)||cleanText(store.name)===cleanText(value))?.code||cleanText(value)
  const preferredStoreFor=record=>storeCodeFor(record.source)||storeRecords.find(store=>store.status!=='Inactive')?.code||''
  const upsertStockRecord=(storeCode,itemCode,patch)=>{
    if(!storeCode||!itemCode) return
    const existing=stockRecords.find(row=>String(row.storeroom)===String(storeCode)&&String(row.itemNumber)===String(itemCode))
    const next={
      storeroom: storeCode,
      itemNumber: itemCode,
      balance: Math.max(0,Number(existing?.balance||0)+Number(patch.balanceDelta||0)),
      reserved: Math.max(0,Number(existing?.reserved||0)+Number(patch.reservedDelta||0)),
      reorderLevel: patch.reorderLevel ?? existing?.reorderLevel ?? null
    }
    setStockRecords(rows=>{
      const hasRow=rows.some(row=>String(row.storeroom)===String(storeCode)&&String(row.itemNumber)===String(itemCode))
      return hasRow
        ? rows.map(row=>String(row.storeroom)===String(storeCode)&&String(row.itemNumber)===String(itemCode)?next:row)
        : [next,...rows]
    })
    const payload={balance:next.balance,reserved_quantity:next.reserved,reorder_point:next.reorderLevel}
    const encodedStore=encodeURIComponent(storeCode)
    const encodedItem=encodeURIComponent(itemCode)
    const request=existing
      ? api.put(`/inventory-stock/${encodedStore}/${encodedItem}`, payload)
      : api.post('/inventory-stock', { store_code: storeCode, item_code: itemCode, ...payload })
    request.catch(error=>notify(error.message||'Unable to update inventory stock.','error'))
  }
  const createPurchaseRequest=async record=>{
    if(!canDo('Purchase Requisitions','create')){notify('No create access for Purchase Requisitions.','error');return null}
    try{
      const result=await supplyChainApi.createPurchaseRequest({
        work_order_num:record.workOrder||null,
        resource_request_id:record.resourceRequestId||null,
        request_type:record.type||'Material',
        item_code:itemCodeFor(record.type,record.itemCode||record.item),
        item_description:record.item||record.description||record.itemCode,
        requested_quantity:Number(record.quantity||record.requestedQuantity||0),
        planned_quantity:Number(record.plannedQuantity||record.quantity||0),
        available_quantity:Number(record.availableQuantity||0),
        store_code:record.type==='Material'?preferredStoreFor(record):storeCodeFor(record.source)||null,
        site_code:record.site||null,
        department_name:record.department||null
      })
      setPurchaseRequests(rows=>upsertLocalRecord(rows,result.purchaseRequisition,'purchaseRequest'))
      if(record.workOrder) await loadWorkOrderById(record.workOrder).catch(()=>{})
      notify(result.existing?`Purchase requisition ${result.purchaseRequisition.purchaseRequest} already exists.`:`Purchase requisition ${result.purchaseRequisition.purchaseRequest} created.`,result.existing?'info':'success')
      return result.purchaseRequisition
    }catch(error){notify(error.message||'Unable to create purchase requisition.','error');return null}
  }
  const createPurchaseOrderFromRequest=async request=>{
    if(!canDo('Purchase Orders','create')||!canDo('Purchase Requisitions','approve')){notify('No approve/create access for this purchase workflow.','error');return null}
    try{
      const result=await supplyChainApi.approveAndCreatePurchaseOrder(request.purchaseRequest)
      setPurchaseRequests(rows=>upsertLocalRecord(rows,result.purchaseRequisition,'purchaseRequest'))
      setPurchaseOrders(rows=>upsertLocalRecord(rows,result.purchaseOrder,'purchaseOrder'))
      if(request.workOrder) await loadWorkOrderById(request.workOrder).catch(()=>{})
      notify(result.existing?`Purchase order ${result.purchaseOrder.purchaseOrder} already exists.`:`Purchase order ${result.purchaseOrder.purchaseOrder} created.`,result.existing?'info':'success')
      return result.purchaseOrder
    }catch(error){notify(error.message||'Unable to approve the requisition and create a purchase order.','error');return null}
  }
  const updatePurchaseRequest=async (reference,patch)=>{
    const source=purchaseRequests.find(row=>row.purchaseRequest===reference)
    if(!source||!patch.status)return null
    try{
      const updated=await supplyChainApi.transitionPurchaseRequest(reference,{status:patch.status})
      setPurchaseRequests(rows=>upsertLocalRecord(rows,updated,'purchaseRequest'))
      if(updated.workOrder)await loadWorkOrderById(updated.workOrder).catch(()=>{})
      notify(`${reference} updated to ${statusDescription('purchaseRequisition',updated.status)}.`,'success')
      return updated
    }catch(error){notify(error.message||'Unable to update purchase requisition.','error');return null}
  }
  const updateJobPlan=(reference,patch)=>{
    saveJobPlans(rows=>rows.map(row=>row.JPNUM===reference?{...row,...patch}:row))
    setSelectedJobPlan(current=>current?.JPNUM===reference?{...current,...patch}:current)
  }
  const createJobPlan=async form=>{
    if(!canDo('Job Plans','create')){notify('No create access for Job Plans.','error');return null}
    const jpnum=String(form.JPNUM||'').trim()
    if(!jpnum) return null
    const executionPackage=jobPlanPackageFromRows([form])
    const plan={JPNUM:jpnum,DESCRIPTION:form.DESCRIPTION||'',status:form.status||'DRAFT',...executionPackage}
    const planResult=await saveJobPlans(rows=>rows.some(row=>row.JPNUM===jpnum)?rows.map(row=>row.JPNUM===jpnum?{
      ...row,
      ...plan,
      requiredLabor: executionPackage.requiredLabor.length?uniquePlanRows([...(row.requiredLabor||[]),...executionPackage.requiredLabor],item=>`${item.craft}|${item.hours}|${item.crew}`):row.requiredLabor||[],
      requiredMaterials: executionPackage.requiredMaterials.length?uniquePlanRows([...(row.requiredMaterials||[]),...executionPackage.requiredMaterials],item=>`${item.itemCode}|${item.description}|${item.storeCode}`):row.requiredMaterials||[],
      requiredTools: executionPackage.requiredTools.length?uniquePlanRows([...(row.requiredTools||[]),...executionPackage.requiredTools],item=>`${item.itemCode}|${item.description}|${item.storeCode}`):row.requiredTools||[],
      safetyInstructions: executionPackage.safetyInstructions||row.safetyInstructions||'',
      checklist: executionPackage.checklist.length?[...new Set([...(row.checklist||[]),...executionPackage.checklist])]:row.checklist||[]
    }:row):[plan,...rows])
    if(!planResult||planResult.__saveError)return null
    if(form['JOB TASK DESCRIPTION']) {
      const task={...form,JPNUM:jpnum,JOBTASKID:pendingReference('JPT'),__isNew:true}
      const taskResult=await saveJobTasks(rows=>[...rows,task])
      if(!taskResult||taskResult.__saveError)return null
    }
    notify(`Job plan ${jpnum} saved.`,'success')
    return plan
  }
  const importJobPlans=async importedRows=>{
    if(!canDo('Job Plans','import')){const error=new Error('No import access for Job Plans.');notify(error.message,'error');throw error}
    const normalized=importedRows.map(row=>({
      ...row,
      JPNUM:cleanText(row.JPNUM||row['Job Plan']),
      DESCRIPTION:cleanText(row.DESCRIPTION||row['Plan Description']),
      'JOB TASK SEQUENCE':Number(row['JOB TASK SEQUENCE']||row['Task Sequence']||10),
      'JOB TASK DESCRIPTION':cleanText(row['JOB TASK DESCRIPTION']||row['Task Description']),
      'TASK DURATION IN HOUR':Number(row['TASK DURATION IN HOUR']||row['Duration in Hours']||0),
      'LABOR CRAFT':cleanText(row['LABOR CRAFT']||row['Labor Craft']),
      'LABOR HOURS':Number(row['LABOR HOURS']||row['Labor Hours']||0),
      'ASSIGNED CREW':cleanText(row['ASSIGNED CREW']||row['Assigned Crew']),
      'MATERIAL CODE':cleanText(row['MATERIAL CODE']||row['Material Code']),
      'MATERIAL DESCRIPTION':cleanText(row['MATERIAL DESCRIPTION']||row['Material Description']),
      'MATERIAL QTY':Number(row['MATERIAL QTY']||row['Material Quantity']||0),
      'MATERIAL STORE':cleanText(row['MATERIAL STORE']||row['Material Store']),
      'TOOL CODE':cleanText(row['TOOL CODE']||row['Tool Code']),
      'TOOL DESCRIPTION':cleanText(row['TOOL DESCRIPTION']||row['Tool Description']),
      'TOOL QTY':Number(row['TOOL QTY']||row['Tool Quantity']||0),
      'TOOL STORE':cleanText(row['TOOL STORE']||row['Tool Store']),
      'SAFETY INSTRUCTIONS':row['SAFETY INSTRUCTIONS']||row['Safety Instructions']||'',
      'CHECKLIST ITEM':row['CHECKLIST ITEM']||row['Checklist Item']||row.CHECKLIST||'',
      status:statusText(row.status||row.STATUS,'ACTIVE')
    })).filter(row=>row.JPNUM)
    if(!normalized.length)throw new Error('No valid Job Plan rows were found.')
    const plans=[...new Set(normalized.map(row=>row.JPNUM))].map(JPNUM=>{
      const planRows=normalized.filter(row=>row.JPNUM===JPNUM)
      const source=planRows[0]
      return {JPNUM,DESCRIPTION:source.DESCRIPTION,status:source.status,estimatedDurationMinutes:planRows.reduce((total,row)=>total+Number(row['TASK DURATION IN HOUR']||0)*60,0),...jobPlanPackageFromRows(planRows)}
    })
    const planResult=await saveJobPlans(current=>[
      ...plans.map(plan=>({...current.find(row=>row.JPNUM===plan.JPNUM),...plan})),
      ...current.filter(row=>!plans.some(plan=>plan.JPNUM===row.JPNUM))
    ])
    if(!planResult||planResult.__saveError)throw planResult?.error||new Error('Unable to import Job Plans.')
    const taskRows=[...new Map(normalized
      .filter(row=>row['JOB TASK DESCRIPTION'])
      .map(row=>[`${row.JPNUM}|${row['JOB TASK SEQUENCE']}`,row])).values()]
    if(taskRows.length){
      const taskResult=await saveJobTasks(current=>{
        const touched=new Set()
        const imported=taskRows.map((row,index)=>{
          const naturalKey=`${row.JPNUM}|${row['JOB TASK SEQUENCE']}`
          touched.add(naturalKey)
          const existing=current.find(task=>`${task.JPNUM}|${task['JOB TASK SEQUENCE']}`===naturalKey)
          return existing?{...existing,...row}:{...row,JOBTASKID:pendingReference(`JPT-${index+1}`),__isNew:true}
        })
        return [...imported,...current.filter(task=>!touched.has(`${task.JPNUM}|${task['JOB TASK SEQUENCE']}`))]
      })
      if(!taskResult||taskResult.__saveError)throw taskResult?.error||new Error('Unable to import Job Plan tasks.')
    }
  }
  const failureCodeKey=row=>['FAILURE CLASS ID','PROBLEM CODE','CAUSE CODE','REMEDY CODE'].map(key=>cleanText(row?.[key]).toLowerCase()).join('|')
  const importFailureCodes=async importedRows=>{
    if(!canDo('Failure Library','import')){const error=new Error('No import access for Failure Library.');notify(error.message,'error');throw error}
    const normalized=importedRows.map(row=>({
      'FAILURE CLASS ID':cleanText(row['FAILURE CLASS ID']||row.failure_class_id),
      DESCRIPTION:cleanText(row.DESCRIPTION||row.description),
      'PROBLEM CODE':cleanText(row['PROBLEM CODE']||row.problem_code),
      'PC - DESCRIPTION':cleanText(row['PC - DESCRIPTION']||row.problem_description),
      'CAUSE CODE':cleanText(row['CAUSE CODE']||row.cause_code),
      'CC - DESCRIPTION':cleanText(row['CC - DESCRIPTION']||row.cause_description),
      'REMEDY CODE':cleanText(row['REMEDY CODE']||row.remedy_code),
      'RC - DESCRIPTION':cleanText(row['RC - DESCRIPTION']||row.remedy_description)
    })).filter(row=>row['FAILURE CLASS ID']&&row.DESCRIPTION)
    if(!normalized.length)throw new Error('No valid Failure Library rows were found.')
    const result=await saveFailureCodes(current=>{
      const importedKeys=new Set(normalized.map(failureCodeKey))
      return [
        ...normalized.map(row=>({...current.find(existing=>failureCodeKey(existing)===failureCodeKey(row)),...row})),
        ...current.filter(row=>!importedKeys.has(failureCodeKey(row)))
      ]
    })
    if(!result||result.__saveError)throw result?.error||new Error('Unable to import Failure Library records.')
  }
  const createReservation=async record=>{
    if(!canDo('Reservations','create')){notify('No create access for Reservations.','error');return null}
    try{
      const reservation=await supplyChainApi.createReservation({
        work_order_num:record.workOrder,
        resource_request_id:record.resourceRequestId||null,
        pr_num:record.purchaseRequest||null,
        po_num:record.purchaseOrder||null,
        request_type:record.type||'Material',
        item_code:itemCodeFor(record.type,record.itemCode||record.item),
        item_description:record.item||record.itemCode,
        reserved_quantity:Number(record.quantity||record.requestedQuantity||0),
        store_code:storeCodeFor(record.source)||null,
        site_code:record.site||null,
        department_name:record.department||null
      })
      setReservations(rows=>upsertLocalRecord(rows,reservation,'reservation'))
      if(record.workOrder) await loadWorkOrderById(record.workOrder).catch(()=>{})
      notify(`${reservation.reservation} saved.`,'success')
      return reservation
    }catch(error){notify(error.message||'Unable to create reservation.','error');return null}
  }
  const updatePurchaseOrder=async (reference,patch)=>{
    const source=purchaseOrders.find(order=>order.purchaseOrder===reference)
    const next=source?{...source,...patch,statusDescription:patch.status?statusDescription('purchaseOrder',patch.status):source.statusDescription}:null
    if(source?.status!=='CLOSE'&&String(patch.status||'').toUpperCase()==='CLOSE'){
      try{
        const result=await supplyChainApi.receivePurchaseOrder(reference)
        setPurchaseOrders(rows=>upsertLocalRecord(rows,result.purchaseOrder,'purchaseOrder'))
        if(result.purchaseRequisition)setPurchaseRequests(rows=>upsertLocalRecord(rows,result.purchaseRequisition,'purchaseRequest'))
        if(result.reservation)setReservations(rows=>upsertLocalRecord(rows,result.reservation,'reservation'))
        if(result.inventoryStock)setStockRecords(rows=>upsertLocalRecord(rows,result.inventoryStock,'stockKey'))
        if(result.tool)setToolRecords(rows=>upsertLocalRecord(rows,result.tool,'toolNumber'))
        if(result.purchaseOrder.workOrder) await loadWorkOrderById(result.purchaseOrder.workOrder).catch(()=>{})
        notify(`${reference} received and posted to inventory.`,'success')
        return result.purchaseOrder
      }catch(error){notify(error.message||'Unable to receive purchase order.','error');return null}
    }
    if(!next?.status)return null
    try{
      const updated=await supplyChainApi.transitionPurchaseOrder(reference,{status:next.status})
      setPurchaseOrders(rows=>upsertLocalRecord(rows,updated,'purchaseOrder'))
      if(updated.workOrder)await loadWorkOrderById(updated.workOrder).catch(()=>{})
      notify(`${reference} updated to ${statusDescription('purchaseOrder',updated.status)}.`,'success')
      return updated
    }catch(error){notify(error.message||'Unable to update purchase order.','error');return null}
  }
  const updateReservation=async (reference,patch)=>{
    const source=reservations.find(row=>row.reservation===reference)
    if(!source)return null
    try{
      const updated=await supplyChainApi.transitionReservation(reference,{
        arranged_quantity:patch.arrangedQuantity??source.arrangedQuantity,
        released_quantity:patch.releasedQuantity??source.releasedQuantity,
        delivered_quantity:patch.deliveredQuantity??source.deliveredQuantity,
        status:patch.status||source.status
      })
      setReservations(rows=>upsertLocalRecord(rows,updated,'reservation'))
      if(updated.inventoryStock)setStockRecords(rows=>upsertLocalRecord(rows,updated.inventoryStock,'stockKey'))
      if(updated.workOrder) await loadWorkOrderById(updated.workOrder).catch(()=>{})
      if(patch.status)notify(`${reference} updated to ${statusDescription('inventoryUsage',updated.status)}.`,'success')
      return updated
    }catch(error){notify(error.message||'Unable to update reservation.','error');return null}
  }
  const updateWorkOrder=async (number,patch)=>{
    const source=allWorkOrders.find(order=>String(order.WORKORDER)===String(number))
    const nextStatus=String(patch?.STATUS || source?.STATUS || '').toUpperCase()
    const wasCancelled=String(source?.STATUS || '').toUpperCase()==='CAN'
    if(nextStatus==='CAN'&&!wasCancelled){
      try{
        const result=await supplyChainApi.cancelWorkOrder(number)
        setReservations(rows=>rows.map(row=>String(row.workOrder)===String(number)?{...row,status:'CANCELLED'}:row))
        setPurchaseRequests(rows=>rows.map(row=>String(row.workOrder)===String(number)&&!['CLOSE','CAN'].includes(String(row.status).toUpperCase())?{...row,status:'CAN'}:row))
        setPurchaseOrders(rows=>rows.map(row=>String(row.workOrder)===String(number)&&!['CLOSE','CAN'].includes(String(row.status).toUpperCase())?{...row,status:'CAN'}:row))
        result.inventoryStocks.forEach(stock=>setStockRecords(rows=>upsertLocalRecord(rows,stock,'stockKey')))
        const cancelledOrder=await loadWorkOrderById(number)
        notify(`Work order #${number} cancelled with ${result.reservations} reservation(s), ${result.purchaseRequisitions} PR(s), and ${result.purchaseOrders} PO(s).`,'success')
        return cancelledOrder
      }catch(error){notify(error.message||'Unable to cancel work order and its supply chain.','error');return {__saveError:true,error}}
    }
    const result=saveWorkOrders(rows=>rows.map(order=>{
      if(String(order.WORKORDER)!==String(number)) return order
      const resources = Array.isArray(order['PLANNED RESOURCES']) ? order['PLANNED RESOURCES'] : []
      const cancelledResources = nextStatus === 'CAN'
        ? resources.map(resource => ({
          ...resource,
          requestStatus: ['Tool', 'Equipment'].includes(resource.type) ? 'CANCELLED' : 'CAN',
          supplyChainStatus: 'Cancelled with work order'
        }))
        : resources
      return {...order,...patch,'PLANNED RESOURCES':cancelledResources}
    }))
    return result
  }
  const createWorkOrder=async form=>{if(!canDo('Work Orders','create')){notify('No create access for Work Orders.','error');return null}const created={'WORKORDER':'AUTO','__isNew':true,'DESCRIPITION ':form.description,'LOCATION ':form.location,'LOCATION PRIORTY':toLocationPriority(form.priority),'ASSET':form.asset,'STATUS':workOrderWorkflow.initialStatus,'WORK TYPE ':form.type,'STATUS DESCRIPITION':workflowStatusLabel(workOrderWorkflow,workOrderWorkflow.initialStatus)||workOrderWorkflow.initialStatus,'DEPARTMENT ':form.department||'','SUB DEPARTMENT  NAME':form.subDepartment||'','ASSIGNED DEPARTMENT':form.department||'','ASSET DESCRIPTION':assetDescriptionFromMaster(form.asset, assetRecords),'SYSTEM':assetFromMaster(form.asset, assetRecords)?.system||'','PRIORTY':Number(String(form.priority).charAt(0))||3,'SITE':form.site,'TARGET START ':null,'TARGET FINISH ':null,'REPORTED DATE ':nowLocalDateTime(),'PTW REQUIRED':workOrderWorkflow.ptwRequiredDefault};const result=await saveWorkOrders(rows=>[...rows,created]);if(result?.__saveError)return null;notify(`Work order #${created.WORKORDER} created.`,'success');return created}
  const pages = {
    'Job Requests': <ServiceRequestsPage onConvert={convertRequest} onOpenWorkOrder={openConvertedWorkOrder} requests={scopedServiceRequests} setRequests={saveServiceRequests} assets={scopedAssets} workOrders={scopedWorkOrders} siteRecords={siteRecords} departmentRecords={departmentRecords} failureOptions={requestFailureOptions} failureRecords={failureCodeRecords} workflow={applicationWorkflows.JOB_REQUEST} access={accessFor('Job Requests')} notify={notify}/>,
    'Incidents': <IncidentsPage rows={scopedIncidents} setRows={saveIncidents} siteRecords={siteRecords} departmentRecords={departmentRecords} locationRows={scopedLocations} laborRows={laborRecords}/>,
    'Work Orders': <WorkOrdersPage rows={scopedWorkOrders} assets={scopedAssets} locationRows={scopedLocations} siteRecords={siteRecords} departmentRecords={departmentRecords} onCreate={createWorkOrder} onImportRows={saveWorkOrders} pageMeta={workOrderPageMeta} onPageRequest={requestWorkOrderPage} onLoadDetail={loadWorkOrderById} EditorComponent={props => {
      const detailContext = workOrderContext.workOrder === String(props.order.WORKORDER) ? workOrderContext : null
      return <WorkOrderEditor {...props} projectName={projectName} initialTab={deepLinkTabFor(props.order)} workflow={workOrderWorkflow} siteRecords={siteRecords} departmentRecords={departmentRecords} assetRecords={assetRecords} workOrderRows={allWorkOrders} laborRecords={laborRecords} materialRecords={materialRecords} stockRecords={stockRecords} storeRecords={storeRecords} toolRecords={toolRecords} jobTaskRecords={detailContext?.tasks || jobTaskRecords} failureCodeRecords={failureCodeRecords} reservationRecords={detailContext?.reservations || reservations} purchaseRequestRecords={detailContext?.purchaseRequests || purchaseRequests} purchaseOrderRecords={detailContext?.purchaseOrders || purchaseOrders} meterRecords={detailContext?.meters || meterRecords} onCreatePurchaseRequest={createPurchaseRequest} onCreateReservation={createReservation} onUpdateWorkOrder={updateWorkOrder} onNotifyWorkOrderStatus={sendWorkOrderStatusNotification} notify={notify} />
    }} excelDate={excelDate} workflow={workOrderWorkflow} slaBreached={slaBreached} access={accessFor('Work Orders')}/>,
    'Assets': <AssetsPage rows={scopedAssets} setRows={saveAssets} workOrders={scopedWorkOrders} siteRecords={siteRecords} departmentRecords={departmentRecords} locationRows={scopedLocations} />,
    'Preventive Maintenance': <PreventiveMaintenancePage rows={pmScheduleRecords} setRows={savePmSchedules} onImport={importPmSchedules} pmRules={pmRuleRecords} assets={scopedAssets} jobPlans={jobPlanRecords} jobTasks={jobTaskRecords} workOrders={scopedWorkOrders} departmentRecords={departmentRecords} locationRows={scopedLocations} storeRows={storeRecords} laborRows={laborRecords} workflow={workOrderWorkflow} scopeUser={effectiveUser} onOpenWorkOrder={openConvertedWorkOrder}/>,
    'Meters': <MetersPage rows={meterRecords} setRows={saveMeters} assets={scopedAssets} workOrders={scopedWorkOrders} siteRecords={siteRecords} departmentRecords={departmentRecords} locationRows={scopedLocations} />,
    'Locations': <LocationsPage rows={scopedLocations} setRows={saveLocations} assets={scopedAssets} workOrders={scopedWorkOrders} siteRecords={siteRecords} departmentRecords={departmentRecords}/>,
    'Job Plans': selectedJobPlan ? <JobPlanDetailPage plan={selectedJobPlan} tasks={jobTaskRecords.filter(task=>task.JPNUM===selectedJobPlan.JPNUM)} workOrders={relatedJobPlanWorkOrders.rows} onBack={()=>{setSelectedJobPlan(null);window.history.pushState({},'','/job-plans')}} onUpdate={updateJobPlan}/> : <RegisterPage title="Job plans" eyebrow="MAINTENANCE" description="Standard task sequences and estimated durations for technicians." rows={jobPlanSummaryRows} onCreate={createJobPlan} onImport={importJobPlans} access={accessFor('Job Plans')} search={search} setSearch={setSearch} action="New job plan" modalTitle="Add job plan" modalNote="Create a job plan task line with sequence, instructions, and estimated duration." modalFields={[
      { key: 'JPNUM', label: 'Job Plan', icon: ClipboardList, required: true, suggestions: jobPlanOptions(jobTaskRecords), placeholder: 'Select a plan or type a new number', section: 'Plan', sectionIcon: ClipboardList, sectionNote: 'The plan this task line belongs to - pick an existing one or name a new plan' },
      { key: 'DESCRIPTION', label: 'Plan Description', icon: FileText, required: true, section: 'Plan' },
      { key: 'status', label: 'Status', icon: ShieldCheck, required: true, options: ['DRAFT', 'ACTIVE', 'INACTIVE'], defaultValue: 'ACTIVE', section: 'Plan', fullWidth: true },
      { key: 'JOB TASK SEQUENCE', label: 'Task Sequence', icon: ListOrdered, required: true, type: 'number', defaultValue: 10, section: 'Task line', sectionIcon: ListChecks, sectionNote: 'One step of the plan: what to do, in what order, and how long it takes', sectionTone: 'green' },
      { key: 'TASK DURATION IN HOUR', label: 'Duration in Hours', icon: Clock, required: true, type: 'number', defaultValue: 1, section: 'Task line' },
      { key: 'JOB TASK DESCRIPTION', label: 'Task Description', icon: FileText, required: true, type: 'textarea', fullWidth: true, section: 'Task line', placeholder: 'What the technician has to do at this step' }
      ,{ key: 'LABOR CRAFT', label: 'Required Labor Craft', icon: ClipboardList, section: 'Execution package', sectionIcon: ShieldCheck, sectionNote: 'Optional labor, resources, safety, and checklist copied into every generated PM Work Order' }
      ,{ key: 'LABOR HOURS', label: 'Estimated Labor Hours', icon: Clock, type: 'number', section: 'Execution package' }
      ,{ key: 'ASSIGNED CREW', label: 'Default Crew (optional)', icon: ClipboardList, section: 'Execution package' }
      ,{ key: 'MATERIAL CODE', label: 'Material Code', icon: ClipboardList, section: 'Execution package' }
      ,{ key: 'MATERIAL DESCRIPTION', label: 'Material Description', icon: FileText, section: 'Execution package' }
      ,{ key: 'MATERIAL QTY', label: 'Material Quantity', icon: Clock, type: 'number', section: 'Execution package' }
      ,{ key: 'MATERIAL STORE', label: 'Material Store', icon: ClipboardList, section: 'Execution package' }
      ,{ key: 'TOOL CODE', label: 'Tool Code', icon: ClipboardList, section: 'Execution package' }
      ,{ key: 'TOOL DESCRIPTION', label: 'Tool Description', icon: FileText, section: 'Execution package' }
      ,{ key: 'TOOL QTY', label: 'Tool Quantity', icon: Clock, type: 'number', section: 'Execution package' }
      ,{ key: 'TOOL STORE', label: 'Tool Store', icon: ClipboardList, section: 'Execution package' }
      ,{ key: 'SAFETY INSTRUCTIONS', label: 'Safety Instructions', icon: ShieldCheck, type: 'textarea', fullWidth: true, section: 'Execution package' }
      ,{ key: 'CHECKLIST ITEM', label: 'Checklist Item', icon: ListChecks, type: 'textarea', fullWidth: true, section: 'Execution package' }
    ]} mapFormToRow={form => ({ ...form, status: form.status || 'ACTIVE', 'TASK DURATION IN HOUR': Number(form['TASK DURATION IN HOUR'] || 0) })} statusTabs={['DRAFT', 'ACTIVE', 'INACTIVE']} rowKey="JPNUM" onRowClick={row=>{setSelectedJobPlan(row);window.history.pushState({},'',`/job-plans/${row.JPNUM}`)}} columns={[
      {key:'JPNUM',label:'Plan',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Plan description'},{key:'taskCount',label:'Tasks'},{key:'totalMinutes',label:'Duration',render:v=>`${v} min`},{key:'status',label:'Status',render:v=>v||'ACTIVE'}
    ]}/>,
    'Failure Library': selectedFailureClass ? <FailureLibraryDetailPage failureClass={selectedFailureClass} rows={failureCodeRecords.filter(row=>row['FAILURE CLASS ID']===selectedFailureClass['FAILURE CLASS ID'])} workOrders={relatedFailureWorkOrders.rows} onBack={()=>{setSelectedFailureClass(null);window.history.pushState({},'','/failure-library')}}/> : <RegisterPage title="Failure library" eyebrow="RELIABILITY" description="Search the bilingual Maximo problem, cause, and remedy hierarchy." rows={failureClassRows.map(row=>({...row, problemCount: failureCodeRecords.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['PROBLEM CODE']).length, causeCount: failureCodeRecords.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['CAUSE CODE']).length, remedyCount: failureCodeRecords.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['REMEDY CODE']).length}))} search={search} setSearch={setSearch} action="Add code" modalTitle="Add failure code" modalNote="Create a failure hierarchy record. Cause and remedy can stay optional." modalFields={[
      { key: 'FAILURE CLASS ID', label: 'Failure Class ID', icon: ShieldCheck, required: true, suggestions: failureClassOptions(failureCodeRecords), placeholder: 'Select a class or type a new one', section: 'Class', sectionIcon: ShieldCheck, sectionNote: 'The family this failure belongs to - pick an existing class or name a new one' },
      { key: 'DESCRIPTION', label: 'Class Description', icon: FileText, required: true, section: 'Class' },
      { key: 'PROBLEM CODE', label: 'Problem Code', icon: Hash, required: true, section: 'Problem', sectionIcon: AlertTriangle, sectionNote: 'What went wrong - required', sectionTone: 'orange' },
      { key: 'PC - DESCRIPTION', label: 'Problem Description', icon: FileText, required: true, section: 'Problem' },
      { key: 'CAUSE CODE', label: 'Cause Code', icon: Hash, section: 'Cause', sectionIcon: HelpCircle, sectionNote: 'Why it happened - optional', sectionTone: 'purple' },
      { key: 'CC - DESCRIPTION', label: 'Cause Description', icon: FileText, section: 'Cause' },
      { key: 'REMEDY CODE', label: 'Remedy Code', icon: Hash, section: 'Remedy', sectionIcon: Wrench, sectionNote: 'How it was fixed - optional', sectionTone: 'green' },
      { key: 'RC - DESCRIPTION', label: 'Remedy Description', icon: FileText, section: 'Remedy' }
    ]} mapFormToRow={form => ({ ...form })} onCreate={form => saveFailureCodes(rows => [{ ...form }, ...rows])} onImport={importFailureCodes} access={accessFor('Failure Library')} rowKey="FAILURE CLASS ID" onRowClick={row=>{setSelectedFailureClass(row);window.history.pushState({},'',`/failure-library/${encodeURIComponent(row['FAILURE CLASS ID'])}`)}} columns={[
      {key:'FAILURE CLASS ID',label:'Class',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Class description'},{key:'problemCount',label:'Problems'},{key:'causeCount',label:'Causes'},{key:'remedyCount',label:'Remedies'}
    ]}/>,
    'Labor': <LaborPage rows={laborRecords} setRows={saveLabor} workOrders={scopedWorkOrders} departmentRecords={departmentRecords} laborRows={laborRecords}/>,
    'Materials': <MaterialsPage onOpenWorkOrder={openConvertedWorkOrder} rows={materialRecords} setRows={saveMaterials} stockRows={stockRecords} storeRows={storeRecords} workOrders={scopedWorkOrders} resourceRequests={workOrderResourceRecords} purchaseRequests={scopedPurchaseRequests} purchaseOrders={scopedPurchaseOrders} onCreateRequest={createPurchaseRequest} onUpdateStock={(storeCode,itemCode,patch)=>upsertStockRecord(storeCode,itemCode,patch)}/>,
    'Stores': <StoresPage materials={materialRecords} tools={toolRecords} stockRows={stockRecords} storeRows={storeRecords} setStoreRows={saveStores} locationRows={locationRecords} siteRecords={siteRecords} scopeUser={effectiveUser}/>,
    'Purchase Requisitions': <PurchaseRequestsPage rows={scopedPurchaseRequests} purchaseOrders={scopedPurchaseOrders} materials={materialRecords} tools={toolRecords} storeRows={storeRecords} siteRecords={siteRecords} departmentRecords={departmentRecords} workflow={applicationWorkflows.SUPPLY_CHAIN} onOpenWorkOrder={openConvertedWorkOrder} onCreateRequest={createPurchaseRequest} onApproveRequest={createPurchaseOrderFromRequest} onUpdateRequest={updatePurchaseRequest}/>,
    'Purchase Orders': <PurchaseOrdersPage rows={scopedPurchaseOrders} workflow={applicationWorkflows.SUPPLY_CHAIN} onOpenWorkOrder={openConvertedWorkOrder} onUpdateOrder={updatePurchaseOrder}/>,
    'Reservations': <ReservationsPage rows={scopedReservations} stockRows={stockRecords} workOrders={allWorkOrders} workflow={applicationWorkflows.SUPPLY_CHAIN} onOpenWorkOrder={openConvertedWorkOrder} onUpdate={updateReservation}/>,
    'Tools & Equipment': <ToolsPage rows={toolRecords} setRows={saveTools} onOpenWorkOrder={openConvertedWorkOrder} workOrders={scopedWorkOrders} resourceRequests={workOrderResourceRecords} allocations={scopedReservations} storeRows={storeRecords} purchaseRequests={scopedPurchaseRequests} purchaseOrders={scopedPurchaseOrders} onCreateRequest={createPurchaseRequest}/>,
    'Users': <UsersPage rows={userRecords} setRows={saveUsers} roleRows={rolePermissionRecords} laborRows={laborRecords} scopeUser={effectiveUser} siteOptions={siteScopeOptions} departmentOptions={departmentScopeOptions}/>,
    'Roles & Permissions': <RolesPermissionsPage rows={rolePermissionRecords} setRows={saveRoles} siteOptions={siteScopeOptions} departmentOptions={departmentScopeOptions}/>,
    'Sites': <SitesSettingsPage rows={siteRecords} setRows={saveSites}/>,
    'Departments': <DepartmentsSettingsPage rows={departmentRecords} setRows={saveDepartments}/>,
    'Work Order Workflow': <WorkOrderWorkflowSettingsPage workflow={workOrderWorkflow} applicationWorkflows={applicationWorkflows} onSave={saveWorkOrderWorkflow} onSaveApplication={saveApplicationWorkflow} canEdit={canDo('Work Order Workflow', 'edit')}/>,
    'Notifications': <NotificationsSettingsPage rows={notificationRuleRecords} setRows={saveNotificationRules}/>,
    'SMTP & SMS': <ConnectorsSettingsPage rows={connectorRecords} setRows={saveConnectors} notify={notify}/>,
    'PM Schedule Rules': <PmRulesSettingsPage rows={pmRuleRecords} setRows={savePmRules} pmSchedules={pmScheduleRecords} workOrders={scopedWorkOrders} workflow={workOrderWorkflow}/>
  }
  if (!isAuthenticated) return <LoginPage />
  if (workspaceLoading) {
    return <AppState eyebrow="Backend" title="Loading CAFM data" />
  }
  if (workspaceError) {
    return <AppState eyebrow="Backend connection" title="Unable to load data" description={workspaceError} tone="error" />
  }
  if (!activePage) return <LoginPage />

  return (
    <>
      <AppShell
        active={activePage}
        navigation={allowedNavigation}
        projectName={projectName}
        counters={{ workOrders: Number(workOrderPageMeta.summary?.total ?? workOrderPageMeta.total ?? scopedWorkOrders.length) }}
        overdueCount={workOrderNotifications.filter(item => item.type === 'overdue').length}
        notifications={workOrderNotifications}
        statusRuleCount={statusMatrix.length}
        mobileOpen={mobileOpen}
        onMobileOpen={() => setMobileOpen(true)}
        onMobileClose={() => setMobileOpen(false)}
        onNavigate={navigate}
        onOpenWorkOrders={() => navigate('Work Orders')}
      >
        <Suspense fallback={<AppState eyebrow="Workspace" title="Opening page" />}>
          {activePage === 'Overview' ? <OverviewPage onNavigate={navigate} onOpenWorkOrderTab={openWorkOrderTab} currentUser={effectiveUser} projectName={projectName} snapshot={overviewSnapshot} workOrders={scopedWorkOrders} /> : pages[activePage]}
        </Suspense>
      </AppShell>
      <Toast message={toast?.message} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </>
  )
}



























