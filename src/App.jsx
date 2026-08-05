import { useEffect, useMemo, useRef, useState } from 'react'
import ServiceRequestsPage from './pages/ServiceRequestsPage'
import { useCallback } from 'react'
import WorkOrdersPage from './pages/WorkOrdersPage'
import LaborPage from './pages/LaborPage'
import MaterialsPage from './pages/MaterialsPage'
import StoresPage from './pages/StoresPage'
import ToolsPage from './pages/ToolsPage'
import PreventiveMaintenancePage from './pages/PreventiveMaintenancePage'
import AssetsPage from './pages/AssetsPage'
import RegisterPage from './pages/RegisterPage'
import LocationsPage from './pages/LocationsPage'
import OverviewPage from './pages/OverviewPage'
import NotificationsSettingsPage from './pages/NotificationsSettingsPage'
import ConnectorsSettingsPage from './pages/ConnectorsSettingsPage'
import PmRulesSettingsPage from './pages/PmRulesSettingsPage'
import WorkOrderWorkflowSettingsPage from './pages/WorkOrderWorkflowSettingsPage'
import IncidentsPage from './pages/IncidentsPage'
import RolesPermissionsPage from './pages/RolesPermissionsPage'
import MetersPage from './pages/MetersPage'
import LoginPage from './pages/LoginPage'
import PurchaseRequestsPage from './pages/PurchaseRequestsPage'
import PurchaseOrdersPage from './pages/PurchaseOrdersPage'
import ReservationsPage from './pages/ReservationsPage'
import UsersPage from './pages/UsersPage'
import SitesSettingsPage from './pages/SitesSettingsPage'
import DepartmentsSettingsPage from './pages/DepartmentsSettingsPage'
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
import AppState from './components/ui/AppState'
import Alert from './components/ui/Alert'
import Toast from './components/ui/Toast'
import { navigationItems, pathForPage, routeToPage } from './config/navigation'
import { assets, departments, excelDate, failureCodes, incidentSeed, jobPlans as jobPlanSeed, jobTasks, labor as laborMaster, locations, materials as materialMaster, pmRecords, rolePermissionRows, serviceRequestSeed, slaBreached, statusMatrix, toDateTimeInput, tools as toolMaster, users as userSeed, workOrders, workOrderSeeds } from './config/runtimeDefaults'
import { useAuth } from './providers/AuthProvider'
import { nowLocalDate, nowLocalDateTime } from './lib/datetime'
import { printWithoutBrowserTitle } from './lib/print'
import { sameDepartment, systemNamesForDepartment, workGroupsForDepartment } from './lib/departments'
import { storeLabel, storesHolding, totalAvailable } from './lib/inventory'
import { readProjectName } from './lib/projectSettings'
import { canTransitionWorkOrder, statusCode, statusDescription, statusOptions, workOrderTransitions } from './lib/statusMatrix'
import { HOLD_MATERIAL, effectiveTargetTime, endHold, holdSince, isOnHold, startHold } from './lib/holdPeriods'
import { describeOutstanding, markReturned, outstandingReturns } from './lib/resourceReturns'
import { canUseAction, canViewPage, filterNavigationForUser, firstAllowedPage, scopeRowsForUser } from './lib/accessControl'
import { failureClassOptions, jobPlanOptions } from './lib/masterOptions'
import { deriveDepartmentOptions, deriveSiteOptions } from './lib/referenceFallbacks'
import { readNotificationRules } from './lib/settingsStore'
import { api, loadWorkspace } from './services/api'
import { subscribeWorkspaceChanges } from './services/realtime'
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
  workflowStepByStatus
} from './lib/workOrderWorkflow'


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
const splitNotificationRecipients = value => {
  const source = Array.isArray(value) ? value.join(',') : String(value || '')
  return source.split(/[,;\n]+/).map(item => item.trim()).filter(Boolean)
}
const notificationEventForWorkOrderStatus = status => {
  const code = String(status || '').toUpperCase()
  if (code === 'HOLD' || code === HOLD_MATERIAL) return 'Work order on hold'
  return ''
}
const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim()
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
const fileMetadata = rows => (Array.isArray(rows) ? rows : []).map(file => ({
  name: file.name || 'Attachment',
  size: file.size || '',
  type: file.type || 'Document',
  dataUrl: file.dataUrl || ''
}))
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
  persistenceQueues.set(queueKey, next.finally(() => {
    if (persistenceQueues.get(queueKey) === next) persistenceQueues.delete(queueKey)
  }))
  return next
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
  const existing = (await safeApiList('/work-order-planned-labor'))
    .filter(row => String(row.work_order_num) === workOrderNum)
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
  const existing = (await safeApiList('/work-order-tasks'))
    .filter(row => String(row.work_order_num) === workOrderNum)
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
  const existing = (await safeApiList('/work-order-resource-requests'))
    .filter(row => String(row.work_order_num) === workOrderNum)
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
  const rows = await safeApiList('/meter-readings')
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
    toApi: row => ({ tool_code: toText(row.toolNumber), description: toText(row.description), category: row.category || '', location_code: row.location || null, quantity: toNumberOrNull(row.quantity) || 1, low_level: toNumberOrNull(row.lowLevel) || 0, status: statusText(row.status, 'Available'), inspection_due: toDateOrNull(row.inspectionDue) })
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
    toApi: row => ({ work_order_num: toText(row.WORKORDER), description: toText(row['DESCRIPITION '] || row.DESCRIPTION), long_description: row['LONG DESCRIPTION'] || '', location_code: row['LOCATION '] || '', asset_num: row.ASSET || null, status: statusText(row.STATUS, 'WAPPR'), work_type: row['WORK TYPE '] || row['WORK TYPE'] || 'CM', priority: toNumberOrNull(row.PRIORTY || row.priority), site_code: row.SITE || null, department_name: row['DEPARTMENT '] || '', sub_department_code: row['SUB DEPARTMENT  NAME'] || '', assigned_department_name: row['ASSIGNED DEPARTMENT'] || row['DEPARTMENT '] || '', target_start_at: toDateOrNull(row['TARGET START ']), target_finish_at: toDateOrNull(row['TARGET FINISH ']), actual_start_at: toDateOrNull(row['ACTUAL START ']), actual_finish_at: toDateOrNull(row['ACTUAL FINISH ']), reported_at: toDateOrNull(row['REPORTED DATE ']) || new Date(), source_sr_num: row['SOURCE SR'] || null, pm_num: row['PM NUMBER'] || null, pm_cycle: row['PM CYCLE'] || null, job_plan_num: row['JOB PLAN'] || null, schedule_rule_name: row['PM RULE'] || null, failure_code: row['FAILURE CODE'] || '', problem_code: row['PROBLEM CODE'] || '', cause_code: row['CAUSE CODE'] || '', remedy_code: row['REMEDY CODE'] || '', ...(row['PTW REQUIRED'] === undefined ? {} : { ptw_required: Boolean(row['PTW REQUIRED']) }), ptw_files_json: JSON.stringify(fileMetadata(row['PTW FILES'])), general_files_json: JSON.stringify(fileMetadata(row['GENERAL FILES'])), technician_remarks: row['TECHNICIAN REMARKS'] || '', completion_notes: row['COMPLETION NOTES'] || '', actual_labor: row['ACTUAL LABOR'] || '', actual_hours: toNumberOrNull(row['ACTUAL HOURS']), actual_materials_json: JSON.stringify(actualResourceMetadata(row['ACTUAL MATERIALS'])), actual_tools_json: JSON.stringify(actualResourceMetadata(row['ACTUAL TOOLS'])), held_from_status: row['HELD FROM'] || null, hold_periods_json: JSON.stringify(Array.isArray(row.holdPeriods) ? row.holdPeriods : []) }),
    beforeRow: persistWorkOrderChildren,
    afterRow: (row, saved, context) => context?.existed ? undefined : persistWorkOrderChildren(row)
  },
  serviceRequests: {
    endpoint: '/service-requests',
    key: 'sr',
    apiKey: 'sr_num',
    toApi: row => ({ ...(row.__isNew ? { __forcePost: true } : {}), sr_num: row.__isNew ? 'AUTO' : toText(row.sr), description: toText(row.description), long_description: row.longDescription || '', site_code: row.site || null, location_code: row.location || '', asset_num: row.asset || null, department_name: row.department || '', sub_department_code: row.subDepartment || '', assigned_department_name: row.assignedDepartment || '', reported_by: row.reportedBy || '', reported_at: toDateOrNull(row.reportedDate) || new Date(), priority: row.priority || '', request_type: row.requestType || 'Service', failure_code: row.failureCode || '', status: statusText(row.status, 'NEW'), converted_work_order_num: row.convertedWorkOrder || null }),
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
    toApi: row => ({ incident_num: toText(row.incidentNumber || row.incident), description: toText(row.description), site_code: row.site || null, location_code: row.location || '', asset_num: row.asset || null, department_name: row.department || '', severity: row.severity || 'Medium', status: statusText(row.status, 'NEW'), reported_by: row.reportedBy || '', reported_at: toDateOrNull(row.reportedDate) || new Date() })
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
    toApi: row => ({ rule_name: toText(row.name), frequency: toNumberOrNull(row.frequency) || 1, frequency_unit: row.freqUnit || 'MONTHS', lead_time_days: toNumberOrNull(row.leadTimeDays) || 0, horizon_days: toNumberOrNull(row.horizonDays) || 30, trigger_hour: ['MINUTES', 'HOURS'].includes(row.freqUnit) ? 0 : Math.max(0, Math.min(23, toNumberOrNull(row.triggerHour) || 0)), wo_prefix: row.woPrefix || 'PMWO-', default_wo_status: row.defaultWoStatus || 'WSCH', notes: row.notes || '', status: row.status || 'Active' })
  },
  connectors: {
    endpoint: '/smtp-sms-connectors',
    key: 'name',
    apiKey: 'connector_name',
    toApi: row => ({ connector_name: toText(row.name), connector_type: row.type || 'SMTP', host_endpoint: toText(row.host), port: toNumberOrNull(row.port), encryption: row.encryption || 'TLS', username_value: row.username || '', secret_value: row.password || '', sender_value: row.sender || '', notes: row.notes || '', status: row.status || 'Active' })
  },
  meters: {
    endpoint: '/meter-readings',
    key: 'meterReadingId',
    apiKey: 'meter_reading_id',
    toApi: row => ({ ...(row.meterReadingId ? { meter_reading_id: row.meterReadingId } : {}), meter_id: toText(row.meterId), asset_num: row.asset || null, work_order_num: row.workOrder || null, site_code: row.site || null, department_name: row.department || '', reading_value: toNumberOrNull(row.reading) || 0, reading_unit: row.unit || '', reading_at: toDateOrNull(row.readingDate) || new Date() })
  },
  purchaseRequests: {
    endpoint: '/purchase-requisitions',
    key: 'purchaseRequest',
    apiKey: 'pr_num',
    toApi: row => ({ pr_num: toText(row.purchaseRequest), work_order_num: row.workOrder || null, resource_request_id: row.resourceRequestId || null, request_type: row.type || 'Material', item_code: row.itemCode || row.item || '', item_description: row.item || '', requested_quantity: toNumberOrNull(row.quantity) || 0, planned_quantity: toNumberOrNull(row.plannedQuantity), available_quantity: toNumberOrNull(row.availableQuantity), store_code: row.type === 'Material' ? row.source || null : null, site_code: row.site || null, department_name: row.department || '', status: statusText(row.status, 'WAPPR'), po_num: row.purchaseOrder || null, created_at: toDateOrNull(row.createdAt) || new Date(), approved_at: toDateOrNull(row.approvedAt), closed_at: toDateOrNull(row.closedAt), cancelled_at: toDateOrNull(row.cancelledAt) })
  },
  purchaseOrders: {
    endpoint: '/purchase-orders',
    key: 'purchaseOrder',
    apiKey: 'po_num',
    toApi: row => ({ po_num: toText(row.purchaseOrder), pr_num: row.purchaseRequest || null, work_order_num: row.workOrder || null, resource_request_id: row.resourceRequestId || null, request_type: row.type || 'Material', item_code: row.itemCode || row.item || '', item_description: row.item || '', ordered_quantity: toNumberOrNull(row.quantity) || 0, store_code: row.type === 'Material' ? row.source || null : null, site_code: row.site || null, department_name: row.department || '', status: statusText(row.status, 'WAPPR'), created_at: toDateOrNull(row.createdAt) || new Date(), approved_at: toDateOrNull(row.approvedAt), received_at: toDateOrNull(row.receivedAt), closed_at: toDateOrNull(row.closedAt), cancelled_at: toDateOrNull(row.cancelledAt) })
  },
  reservations: {
    endpoint: '/reservations',
    key: 'reservation',
    apiKey: 'reservation_num',
    toApi: row => ({ reservation_num: toText(row.reservation), work_order_num: row.workOrder || null, resource_request_id: row.resourceRequestId || null, pr_num: row.purchaseRequest || null, po_num: row.purchaseOrder || null, item_code: row.itemCode || row.item || '', item_description: row.item || '', reserved_quantity: toNumberOrNull(row.quantity) || 0, arranged_quantity: toNumberOrNull(row.arrangedQuantity) || 0, released_quantity: toNumberOrNull(row.releasedQuantity) || 0, delivered_quantity: toNumberOrNull(row.deliveredQuantity) || 0, store_code: row.type === 'Material' ? row.source || null : null, site_code: row.site || null, department_name: row.department || '', status: statusText(row.status, 'ENTERED'), created_at: toDateOrNull(row.createdAt) || new Date() })
  },
  jobPlans: {
    endpoint: '/job-plans',
    key: 'JPNUM',
    apiKey: 'job_plan_num',
    toApi: row => ({ job_plan_num: toText(row.JPNUM || row.number), description: toText(row.DESCRIPTION || row.description), status: statusText(row.status, 'ACTIVE') })
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
  duration: task.duration ?? Math.max(5, Math.round(Number(task['TASK DURATION IN HOUR'] || 0) * 1440))
})
const assetFromMaster = (assetNumber, masterAssets = []) => masterAssets.find(asset => cleanText(asset.assetnum) === cleanText(assetNumber))
const assetDescriptionFromMaster = (assetNumber, masterAssets = []) => masterAssets.find(asset => cleanText(asset.assetnum) === cleanText(assetNumber))?.description?.trim() || ''
const initialSiteRecords = () => [...new Set([
  ...assets.map(asset => asset.site),
  ...locations.map(location => location.site),
  ...workOrders.map(order => order.SITE)
].filter(Boolean).map(site => String(site).trim()))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(code => ({
  code,
  name: `Site ${code}`,
  region: '',
  city: '',
  status: 'Active'
}))
const initialDepartmentRecords = () => {
  const rows = departments.flatMap(department => (department.subDepartments || []).map(subDepartment => ({
    subDepartmentCode: subDepartment.code,
    department: department.name,
    description: subDepartment.name,
    status: 'Active'
  })))
  return [...new Map(rows.map(row => [row.subDepartmentCode, row])).values()]
}

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

function WorkOrderEditor({ order, onClose, page = false, projectName, initialTab, workflow: workflowValue = DEFAULT_WORK_ORDER_WORKFLOW, siteRecords = [], departmentRecords = [], assetRecords = [], workOrderRows = [], laborRecords = [], materialRecords = [], stockRecords = [], storeRecords = [], toolRecords = [], jobTaskRecords = [], failureCodeRecords = [], reservationRecords = [], purchaseRequestRecords = [], purchaseOrderRecords = [], meterRecords = [], onCreatePurchaseRequest, onCreateReservation, onUpdateWorkOrder, onNotifyWorkOrderStatus }) {
  const { user } = useAuth()
  const workflow = useMemo(()=>normalizeWorkOrderWorkflow(workflowValue),[workflowValue])
  // Pausing the SLA clock is an administrative decision, so the hold controls belong to
  // the Facility Manager rather than to whoever is executing the job.
  const canManageHold = workflow.allowHold && user?.role === 'Facility Manager'
  const canEditWorkOrder = canUseAction(user, 'Work Orders', 'edit')
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
  const [assignedDepartment,setAssignedDepartment]=useState(String(order['DEPARTMENT ']||''))
  const [workGroup,setWorkGroup]=useState(isPM?'C1-HVAC':'')
  const [supervisor,setSupervisor]=useState('')
  const [laborCraft,setLaborCraft]=useState(isPM?'HVAC-TECH':'')
  const [siteValue,setSiteValue]=useState(String(order.SITE || ''))
  const [assetValue,setAssetValue]=useState(order.ASSET||'')
  const [assetDescription,setAssetDescription]=useState(assetDescriptionFromMaster(order.ASSET, assetRecords) || order['ASSET DESCRIPTION'] || order['ASSET DESCRIPTION '] || '')
  const [locationValue,setLocationValue]=useState(order['LOCATION '] || assetFromMaster(order.ASSET, assetRecords)?.location || '')
  const [systemValue,setSystemValue]=useState(order['SYSTEM']||assetFromMaster(order.ASSET, assetRecords)?.system||'')
  const [failureClass,setFailureClass]=useState(order['FAILURE CODE']||'')
  const [problemCode,setProblemCode]=useState(order['PROBLEM CODE']||'')
  const [causeCode,setCauseCode]=useState(order['CAUSE CODE']||'')
  const [remedyCode,setRemedyCode]=useState(order['REMEDY CODE']||'')
  const jobPlanNumber = getWorkOrderJobPlan(order)
  const jobPlanTaskRows = order['JOB PLAN TASKS']?.length ? order['JOB PLAN TASKS'] : jobPlanNumber ? jobTaskRecords.filter(task => cleanText(task.JPNUM) === jobPlanNumber) : []
  // saveChanges writes these back onto the order, so reopening a saved work order must
  // read them again - otherwise planned rows silently vanish on every revisit.
  const [plannedLabor,setPlannedLabor]=useState(order['PLANNED LABOR']?.length?order['PLANNED LABOR']:isPM?[{craft:'HVAC Technician',hours:'2',crew:'HVAC Team A'}]:[{craft:'',hours:'',crew:''}])
  const [plannedResources,setPlannedResources]=useState(order['PLANNED RESOURCES']?.length?order['PLANNED RESOURCES']:[])
  const [plannedTasks,setPlannedTasks]=useState(isPM?jobPlanTaskRows.map(taskToPlanRow):[{sequence:10,description:'',duration:''}])
  const tasksFromJobPlan=isPM&&jobPlanTaskRows.length>0
  // Written by convertRequest but, until now, never read anywhere except its own dedupe guard.
  const sourceRequest=order['SOURCE SR']?{sr:order['SOURCE SR'],reportedBy:order['REPORTED BY']||'',reportedDate:toDateTimeInput(order['REPORTED DATE '])||'',priority:order['SOURCE SR PRIORITY']||'',requestType:order['SOURCE SR TYPE']||''}:null
  const [ptwRequired,setPtwRequired]=useState(order['PTW REQUIRED'] === undefined ? workflow.ptwRequiredDefault : Boolean(order['PTW REQUIRED']))
  const [ptwFiles,setPtwFiles]=useState(order['PTW FILES']||[])
  const [generalFiles,setGeneralFiles]=useState(order['GENERAL FILES']||[])
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
  const overviewRequirementMissing=[!description.trim()&&'Description',!siteValue&&'Site',!locationValue&&'Location',!department&&'Department',!assignedDepartment&&'Assigned Department',!targetStart&&'Target Start',!targetFinish&&'Target Finish',targetOutOfOrder&&'Target Finish must be on or after Target Start',targetStartBeforeReport&&'Target Start cannot be before the reported date'].filter(Boolean)
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
      'STATUS DESCRIPITION': workflowStatusLabel(workflow,next)||maximoWorkOrderStatusDescriptions[next]||next
    })
  }
  const changeStatus=value=>{
    const next=normalizeWoStatus(value)
    // The select disables invalid options, but guard here too so no other caller can
    // drive the work order off the workflow.
    if(!canTransitionWorkOrder(selectedStatus,next,heldFrom,workflow)) return
    notifyStatusChange(next)
    const wasHold=['HOLD',HOLD_MATERIAL].includes(selectedStatus)
    if(['HOLD',HOLD_MATERIAL].includes(next)) setHeldFrom(selectedStatus)
    else if(wasHold) setHeldFrom('')
    // Only the material hold stops the SLA clock, so only it opens a hold period. Going
    // via the status select and via the header buttons must produce the same record.
    if(next===HOLD_MATERIAL) setHoldPeriods(current=>startHold({holdPeriods:current}))
    else if(selectedStatus===HOLD_MATERIAL) setHoldPeriods(current=>endHold({holdPeriods:current}))
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
  const workflowMissing=['HOLD',HOLD_MATERIAL].includes(status)?holdMissing
    :missingFor(status).length?missingFor(status)
    :nextInChain?missingFor(nextInChain):[]
  const allowedStatuses=workOrderTransitions(status,heldFrom,workflow)
  const configuredStatusOptions=workflowStatusOptions(workflow)
  const exceptionalStatusOptions=statusOptions('workOrder')
    .filter(value=>['HOLD',HOLD_MATERIAL,'CAN'].includes(value))
    .map(value=>({value,label:maximoWorkOrderStatusDescriptions[value]||value}))
  const allStatusOptions=[...configuredStatusOptions,...exceptionalStatusOptions]
  if(!allStatusOptions.some(option=>option.value===status)) allStatusOptions.push({value:status,label:workflowStatusLabel(workflow,status)||status})
  const statusSelectOptions=allStatusOptions.map(option=>({
    value:option.value,
    label:`${option.value} · ${option.label}`,
    disabled:option.value!==status&&(!allowedStatuses.includes(option.value)||missingFor(option.value).length>0)
  }))
  const workflowNextStepText=['HOLD',HOLD_MATERIAL].includes(status)
    ?(status===HOLD_MATERIAL?'SLA is paused. Resume once material is available':'Resolve the hold before continuing')
    :!configuredNextStep
      ?'Workflow complete'
      :missingFor(configuredNextStep.statusCode).length
        ?`Complete the configured requirements before ${configuredNextStep.stepName}`
        :configuredNextStep.isAutomatic
          ?`Moving automatically to ${configuredNextStep.stepName}`
          :`Ready to move to ${configuredNextStep.stepName}`

  const autoAdvanceTo=configuredNextStep?.isAutomatic&&!missingFor(configuredNextStep.statusCode).length
    ?configuredNextStep.statusCode
    :''
  useEffect(()=>{
    if(!autoAdvanceTo) return
    // Deferred a tick so a keystroke that completes the last required field is committed
    // before the status moves underneath the field being typed in.
    const timer=setTimeout(()=>changeStatus(autoAdvanceTo),0)
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
  const closeWork=()=>changeStatus('CLOSE')
  const actualsEditable = true
  const number = order.WORKORDER || 'AUTO'
  const rawTargetFinishTime=targetFinish?new Date(targetFinish).getTime():null
  const actualFinishTime=actualFinish?new Date(actualFinish).getTime():null
  const onMaterialHold=status===HOLD_MATERIAL||isOnHold({holdPeriods})
  // The deadline moves forward by whatever time this order has already spent on hold, so
  // waiting on stock never eats into the SLA.
  const targetFinishTime=effectiveTargetTime(rawTargetFinishTime,{holdPeriods})
  const slaBreachedNow=Boolean(!onMaterialHold&&targetFinishTime&&((actualFinishTime&&actualFinishTime>targetFinishTime)||(!actualFinishTime&&Date.now()>targetFinishTime)))
  const slaLabel=onMaterialHold?'SLA Paused'
    :!targetFinishTime?'Not defined'
    :actualFinishTime?(slaBreachedNow?'No – SLA Breached':'Yes – SLA Met')
    :(slaBreachedNow?'No – SLA Breached':'Pending – Within SLA')
  const putOnMaterialHold=()=>{
    const periods=startHold({holdPeriods})
    notifyStatusChange(HOLD_MATERIAL)
    setHoldPeriods(periods); setHeldFrom(status); setSelectedStatus(HOLD_MATERIAL)
    // Pushed straight to the shared list so the badge updates without waiting for Save.
    onUpdateWorkOrder?.(number,{STATUS:HOLD_MATERIAL,'STATUS DESCRIPITION':statusDescription('workOrder',HOLD_MATERIAL),'HELD FROM':status,holdPeriods:periods})
  }
  const resumeFromMaterialHold=()=>{
    const periods=endHold({holdPeriods})
    const resume=workOrderTransitions(HOLD_MATERIAL,heldFrom,workflow)[0]||workflow.initialStatus
    notifyStatusChange(resume)
    setHoldPeriods(periods); setHeldFrom(''); setSelectedStatus(resume)
    onUpdateWorkOrder?.(number,{STATUS:resume,'STATUS DESCRIPITION':statusDescription('workOrder',resume),'HELD FROM':'',holdPeriods:periods})
  }
  const close = () => onClose()
  const reroute=()=>{setTab('Overview');setAssignedDepartment('');setSupervisor('');setWorkStarted(false);setWorkScheduled(false);setWorkWaitingSchedule(false);setWorkApproved(false)}
  const readAttachment=file=>new Promise(resolve=>{
    const reader=new FileReader()
    reader.onload=()=>resolve({name:file.name,size:file.size>1048576?`${(file.size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(file.size/1024))} KB`,type:file.type||'Document',dataUrl:String(reader.result||'')})
    reader.onerror=()=>resolve({name:file.name,size:file.size>1048576?`${(file.size/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(file.size/1024))} KB`,type:file.type||'Document',dataUrl:''})
    reader.readAsDataURL(file)
  })
  const addFiles=(setter)=>async event=>{const selected=Array.from(event.target.files||[]);const files=await Promise.all(selected.map(readAttachment));setter(current=>[...current,...files]);event.target.value=''}
  const downloadFile=file=>{
    const link=document.createElement('a')
    link.download=file.name?.includes('.')?file.name:`${file.name||'attachment'}.txt`
    if(file.dataUrl){
      link.href=file.dataUrl
      document.body.appendChild(link);link.click();link.remove()
      return
    }
    const blob=new Blob([`CAFM attachment metadata\n\nName: ${file.name}\nType: ${file.type||'Document'}\nSize: ${file.size||'Unknown'}\n\nThis record was saved before file-content storage was enabled. Re-upload the file to make the original document downloadable.`],{type:'text/plain'})
    const url=URL.createObjectURL(blob)
    link.href=url
    document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)
  }
  // Planned labour already names the craft, the hours and who is doing it, so the actual
  // fields start from it rather than being re-keyed. Planned rows store the craft *name*
  // ("HVAC Technician") while the actual field wants the *code* ("HVAC-TECH"), so the crew
  // member is looked up first and the craft name used as a fallback.
  const plannedCraftCode=()=>{
    const named=plannedLabor.find(row=>row.crew||row.craft)
    if(!named) return ''
    const person=laborMaster.find(entry=>entry.name===named.crew)
    if(person?.craftCode) return person.craftCode
    return laborMaster.find(entry=>entry.craft===named.craft)?.craftCode||''
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
    'STATUS DESCRIPITION': workflowStatusLabel(workflow,status)||maximoWorkOrderStatusDescriptions[status]||status,
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
    'PTW FILES': ptwFiles,
    'GENERAL FILES': generalFiles,
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
  },[description,longDescription,priority,department,subDepartment,assignedDepartment,workGroup,supervisor,laborCraft,siteValue,assetValue,assetDescription,locationValue,targetStart,targetFinish,failureClass,problemCode,causeCode,remedyCode,plannedLabor,plannedResources,plannedTasks,ptwRequired,ptwFiles,generalFiles,technicianRemarks,completionNotes,actualLabor,actualHours,actualMaterials,actualTools,actualStart,actualFinish,meterId,waterMeterId,energyMeterId,meterReading,waterConsumption,energyConsumption,meterReadingDate,selectedStatus,workApproved,workWaitingSchedule,workScheduled,workStarted,workCompleted,workClosed])
  return <div className={page?'w-full':'fixed inset-0 z-50 overflow-auto bg-[color:color-mix(in_srgb,var(--app-sidebar-bg)_72%,transparent)] p-6 backdrop-blur-sm'}><div className={`${page?'mx-auto w-full max-w-[1400px] space-y-3 bg-transparent p-0':'mx-auto max-w-7xl space-y-4 rounded-3xl bg-[var(--app-panel)] p-0 shadow-2xl'} wo-screen`}>
    <WorkOrderHeader number={number} workType={workType} status={status} statusDescription={workflowStatusLabel(workflow,status)||maximoWorkOrderStatusDescriptions[status]||status} statusTone={workflowStepByStatus(workflow,status)?.badgeTone} description={description || order.DESCRIPTION || 'Enter work order information'} isPM={isPM} statusOptions={statusSelectOptions} onStatusChange={changeStatus} close={close} printWorkOrder={printWorkOrder} workClosed={workClosed} statusLocked={!canEditWorkOrder||!workflow.allowManualStatusChange} />
    <WorkOrderTabs tabs={visibleWorkOrderTabs} active={tab} onChange={setTab} alertTabs={tabAlerts} />
    <WorkOrderWorkflowNotice status={status} missing={workflowMissing} nextStep={workflowNextStepText} />
    <div className={workOrderBodyClass}>
      {tab==='Overview' && <WorkOrderOverviewTab projectName={projectName} sourceRequest={sourceRequest} number={number} status={status} workType={workType} priority={priority} setPriority={setPriority} description={description} setDescription={setDescription} siteValue={siteValue} changeSite={changeSite} siteOptions={siteOptions} longDescription={longDescription} setLongDescription={setLongDescription} assetValue={assetValue} changeAsset={changeAsset} assetOptions={assetOptions} locationValue={locationValue} setLocationValue={setLocationValue} locationOptions={locationOptions} assetDescription={assetDescription} setAssetDescription={setAssetDescription} department={department} setDepartment={setDepartment} departmentOptions={departmentOptions} subDepartment={subDepartment} setSubDepartment={setSubDepartment} subDepartmentOptions={subDepartmentOptions} assignedDepartment={assignedDepartment} setAssignedDepartment={setAssignedDepartment} setWorkGroup={setWorkGroup} setSupervisor={setSupervisor} workGroup={workGroup} workGroupOptions={workGroupOptions} systemValue={systemValue} setSystemValue={setSystemValue} systemOptions={systemOptions} supervisor={supervisor} supervisorOptions={supervisorOptions} laborCraft={laborCraft} setLaborCraft={setLaborCraft} laborCraftOptions={laborCraftOptions} reportedDate={reportedDateValue} targetStart={targetStart} setTargetStart={setTargetStart} targetFinish={targetFinish} setTargetFinish={setTargetFinish} actualStart={actualStart} setActualStart={setActualStart} actualFinish={actualFinish} setActualFinish={setActualFinish} slaLabel={slaLabel} isPM={isPM} />}
      {tab==='Plan' && <WorkOrderPlanTab isPM={isPM} tasksLocked={tasksFromJobPlan} jobPlanNumber={jobPlanNumber} plannedLabor={plannedLabor} setPlannedLabor={setPlannedLabor} plannedResources={plannedResources} setPlannedResources={setPlannedResources} plannedTasks={plannedTasks} setPlannedTasks={setPlannedTasks} plannedCraftOptions={plannedCraftOptions} plannedCrewOptions={plannedCrewOptions} materialMaster={materialRecords} toolMaster={toolRecords} updatePlanRow={updatePlanRow} updatePlannedResource={updatePlannedResource} updatePlannedResourceField={updatePlannedResourceField} />}
      {tab==='Actual' && <WorkOrderActualTab actualsEditable={actualsEditable} status={status} nextStatus={nextInChain} preparationReady={startReady} planReady={planReady} setTab={setTab} setWorkStarted={value=>{if(value&&startReady)changeStatus('INPRG')}} completeWork={completeWork} showStartAction={!workflowStepByStatus(workflow,'INPRG')?.isAutomatic} showCompleteAction={!workflowStepByStatus(workflow,'COMP')?.isAutomatic} showCloseAction={!workflowStepByStatus(workflow,'CLOSE')?.isAutomatic} completionReady={completionReady} completionBlocked={missingFor('COMP').join(', ')} startBlocked={missingFor('INPRG').join(', ')} outlineButtonClass={workOrderOutlineButtonClass} primaryButtonClass={workOrderPrimaryButtonClass} targetStart={targetStart} targetFinish={targetFinish} actualFinish={actualFinish} setActualFinish={changeActualFinish} slaBreachedNow={slaBreachedNow} slaLabel={slaLabel} technicianRemarks={technicianRemarks} setTechnicianRemarks={setTechnicianRemarks} completionNotes={completionNotes} setCompletionNotes={setCompletionNotes} actualLabor={actualLabor} setActualLabor={setActualLabor} actualHours={actualHours} setActualHours={changeActualHours} actualStart={actualStart} setActualStart={changeActualStart} actualMaterials={actualMaterials} setActualMaterials={setActualMaterials} actualTools={actualTools} setActualTools={setActualTools} updateActualRow={updateActualRow} workClosed={workClosed} actualReady={actualReady} closeWork={closeWork} returnResource={returnResource} outstanding={outstandingReturnRows} currentUser={user} />}
      {tab==='Failure' && <WorkOrderFailureTab isCM={isCM} causeApplicable={causeApplicable} remedyApplicable={remedyApplicable} failureClass={failureClass} changeFailure={changeFailure} failureClassOptions={failureClassOptions} problemCode={problemCode} setProblemCode={setProblemCode} setCauseCode={setCauseCode} setRemedyCode={setRemedyCode} problemOptions={problemOptions} causeCode={causeCode} causeOptions={causeOptions} remedyCode={remedyCode} remedyOptions={remedyOptions} failureDescription={failureDescription} problemDescription={problemDescription} causeDescription={causeDescription} remedyDescription={remedyDescription} failureCount={failureCodeRecords.length} />}
      {tab==='Material Requests' && <WorkOrderMaterialRequestsTab resourceRequests={resourceRequests} plannedResources={plannedResources} setPlannedResources={setPlannedResources} updatePlanRow={updatePlanRow} getAvailability={resourceAvailability} materialBlocked={materialBlocked} primaryButtonClass={workOrderPrimaryButtonClass} outlineButtonClass={workOrderOutlineButtonClass} setTab={setTab} materials={materialRecords} reservations={reservationRecords} purchaseRequests={purchaseRequestRecords} purchaseOrders={purchaseOrderRecords} workOrderContext={{ number, site: siteValue, department: department || assignedDepartment, assignedDepartment }} onCreatePurchaseRequest={onCreatePurchaseRequest} onCreateReservation={onCreateReservation} onUpdateWorkOrder={onUpdateWorkOrder} />}
      {tab==='PTW & Files' && <WorkOrderDocumentsTab ptwRequired={ptwRequired} setPtwRequired={setPtwRequired} allowPtwOverride={workflow.allowPtwOverride} ptwFiles={ptwFiles} setPtwFiles={setPtwFiles} generalFiles={generalFiles} setGeneralFiles={setGeneralFiles} addFiles={addFiles} downloadFile={downloadFile} />}
      {tab==='Meters' && <WorkOrderMetersTab workOrderNumber={number} assetValue={assetValue} siteValue={siteValue} department={department} meterRows={meterRecords} meterId={meterId} setMeterId={setMeterId} meterReading={meterReading} setMeterReading={setMeterReading} meterReadingDate={meterReadingDate} setMeterReadingDate={setMeterReadingDate} />}
    </div>
  </div><WorkOrderPrintReport sourceRequest={sourceRequest} systemValue={systemValue} number={number} description={description || order['DESCRIPITION '] || 'Work order'} workType={workType} status={status} priority={priority} siteValue={siteValue} department={department} subDepartment={subDepartment} assignedDepartment={assignedDepartment} locationValue={locationValue} assetValue={assetValue} assetDescription={assetDescription} targetStart={targetStart} targetFinish={targetFinish} actualStart={actualStart} actualFinish={actualFinish} slaLabel={slaLabel} jobPlan={jobPlanNumber} estimatedDuration={order['ESTIMATED DURATION']} pmNumber={order['PM NUMBER']} pmCycle={order['PM CYCLE']} plannedTasks={plannedTasks} plannedLabor={plannedLabor} plannedResources={plannedResources} ptwRequired={ptwRequired} ptwFiles={ptwFiles} generalFiles={generalFiles} meterReading={meterReading} waterConsumption={waterConsumption} energyConsumption={energyConsumption} meterReadingDate={meterReadingDate} failureClass={failureClass} problemCode={problemCode} causeCode={causeCode} remedyCode={remedyCode} technicianRemarks={technicianRemarks} completionNotes={completionNotes} actualLabor={actualLabor} actualHours={actualHours} actualMaterials={actualMaterials} actualTools={actualTools} /></div>
}

export default function App() {
  const { isAuthenticated, user, logout, refreshSession, applySessionUpdate } = useAuth()
  const [active, setActive] = useState(()=>routeToPage(window.location.pathname))
  const [search, setSearch] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [assetRecords,setAssetRecords]=useState(assets)
  const [locationRecords,setLocationRecords]=useState(locations)
  const [laborRecords,setLaborRecords]=useState(laborMaster)
  const [materialRecords,setMaterialRecords]=useState(materialMaster)
  const [stockRecords,setStockRecords]=useState([])
  const [storeRecords,setStoreRecords]=useState([])
  const [toolRecords,setToolRecords]=useState(toolMaster)
  const [meterRecords,setMeterRecords]=useState([])
  const [allWorkOrders,setAllWorkOrders]=useState(workOrders)
  const [serviceRequests,setServiceRequests]=useState(serviceRequestSeed)
  const [incidents,setIncidents]=useState(incidentSeed)
  const [jobTaskRecords,setJobTaskRecords]=useState(jobTasks.map(task => ({ ...task, status: task.status || 'ACTIVE' })))
  const [jobPlanRecords,setJobPlanRecords]=useState(jobPlanSeed)
  const [pmScheduleRecords,setPmScheduleRecords]=useState([])
  const [pmRuleRecords,setPmRuleRecords]=useState([])
  const [connectorRecords,setConnectorRecords]=useState([])
  const [workOrderWorkflow,setWorkOrderWorkflow]=useState(DEFAULT_WORK_ORDER_WORKFLOW)
  const [purchaseRequests,setPurchaseRequests]=useState([])
  const [purchaseOrders,setPurchaseOrders]=useState([])
  const [reservations,setReservations]=useState([])
  const [rolePermissionRecords,setRolePermissionRecords]=useState(rolePermissionRows)
  const [userRecords,setUserRecords]=useState(userSeed)
  const [siteRecords,setSiteRecords]=useState([])
  const [departmentRecords,setDepartmentRecords]=useState([])
  const [failureCodeRecords,setFailureCodeRecords]=useState(failureCodes)
  const [workspaceLoading,setWorkspaceLoading]=useState(false)
  const [workspaceError,setWorkspaceError]=useState('')
  const [toast,setToast]=useState(null)
  const [projectName]=useState(readProjectName)
  const notify = useCallback((message, tone = 'info') => {
    if (!message) return
    setToast({ id: Date.now(), message, tone })
  }, [])
  const sendWorkOrderStatusNotification = useCallback(order => {
    const eventName = notificationEventForWorkOrderStatus(order.STATUS)
    if (!eventName) return
    const emailRules = readNotificationRules()
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
  }, [notify, projectName])
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(timer)
  }, [toast])
  const applyWorkspaceData = useCallback(data => {
    setAssetRecords(data.assets)
    setLocationRecords(data.locations)
    setLaborRecords(data.labor)
    setMaterialRecords(data.materials)
    setStockRecords(data.inventoryStock)
    setStoreRecords(data.storerooms)
    setToolRecords(data.tools)
    setAllWorkOrders(data.workOrders)
    setServiceRequests(data.serviceRequests)
    setIncidents(data.incidents)
    setJobTaskRecords(data.jobTasks)
    setJobPlanRecords(data.jobPlans)
    setPmScheduleRecords(data.pmSchedules)
    setPmRuleRecords(data.pmRules || [])
    setConnectorRecords(data.connectors || [])
    setWorkOrderWorkflow(normalizeWorkOrderWorkflow(data.workOrderWorkflow))
    setPurchaseRequests(data.purchaseRequests)
    setPurchaseOrders(data.purchaseOrders)
    setReservations(data.reservations)
    setMeterRecords(data.meters)
    setRolePermissionRecords(data.roles)
    setUserRecords(data.users)
    setSiteRecords(data.sites)
    setDepartmentRecords(data.departments)
    setFailureCodeRecords(data.failureCodes)
  }, [])
  const refreshWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated) return
    if (!silent) setWorkspaceLoading(true)
    setWorkspaceError('')
    try {
      applyWorkspaceData(await loadWorkspace())
      await refreshSession()
    } catch (error) {
      if (error.status === 401) {
        logout()
        return
      }
      setWorkspaceError(error.message || 'Unable to load backend data.')
    } finally {
      if (!silent) setWorkspaceLoading(false)
    }
  }, [applyWorkspaceData, isAuthenticated, logout, refreshSession])
  useEffect(() => {
    refreshWorkspace()
  }, [refreshWorkspace])
  useEffect(() => {
    if (!isAuthenticated) return undefined
    let timer
    const unsubscribe = subscribeWorkspaceChanges(change => {
      clearTimeout(timer)
      timer = setTimeout(() => refreshWorkspace({ silent: true }), 250)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [isAuthenticated, refreshWorkspace])
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
  const guardSave = useCallback((moduleName, saveFn) => update => {
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
      : moduleName === 'Purchase Requisitions' ? purchaseRequests
      : moduleName === 'Purchase Orders' ? purchaseOrders
      : moduleName === 'Reservations' ? reservations
      : moduleName === 'Sites' ? siteRecords
      : moduleName === 'Departments' ? departmentRecords
      : moduleName === 'Job Plans' ? jobPlanRecords
      : moduleName === 'Users' ? userRecords
      : moduleName === 'Roles & Permissions' ? rolePermissionRecords
      : []
    const nextRows = typeof update === 'function' ? update(beforeRows) : update
    const beforeCount = Array.isArray(beforeRows) ? beforeRows.length : 0
    const nextCount = Array.isArray(nextRows) ? nextRows.length : 0
    const action = nextCount > beforeCount ? 'create' : nextCount < beforeCount ? 'edit' : 'edit'
    if (!canDo(moduleName, action)) {
      notify(`No ${action} access for ${moduleName}. Ask an administrator to update your role permissions.`, 'error')
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
  }, [assetRecords, locationRecords, laborRecords, materialRecords, storeRecords, toolRecords, failureCodeRecords, meterRecords, allWorkOrders, serviceRequests, incidents, pmScheduleRecords, pmRuleRecords, connectorRecords, purchaseRequests, purchaseOrders, reservations, siteRecords, departmentRecords, jobPlanRecords, userRecords, rolePermissionRecords, canDo, notify, refreshWorkspace])
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
  const rawSavePurchaseRequests = useMemo(() => backendSetter(setPurchaseRequests, apiMappers.purchaseRequests), [])
  const rawSavePurchaseOrders = useMemo(() => backendSetter(setPurchaseOrders, apiMappers.purchaseOrders), [])
  const rawSaveReservations = useMemo(() => backendSetter(setReservations, apiMappers.reservations), [])
  const rawSaveSites = useMemo(() => backendSetter(setSiteRecords, apiMappers.sites), [])
  const rawSaveDepartments = useMemo(() => backendSetter(setDepartmentRecords, apiMappers.departments), [])
  const rawSaveJobPlans = useMemo(() => backendSetter(setJobPlanRecords, apiMappers.jobPlans), [])
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
  const savePmRules = useMemo(() => guardSave('PM Schedule Rules', rawSavePmRules), [guardSave, rawSavePmRules])
  const saveConnectors = useMemo(() => guardSave('SMTP & SMS', rawSaveConnectors), [guardSave, rawSaveConnectors])
  const savePurchaseRequests = useMemo(() => guardSave('Purchase Requisitions', rawSavePurchaseRequests), [guardSave, rawSavePurchaseRequests])
  const savePurchaseOrders = useMemo(() => guardSave('Purchase Orders', rawSavePurchaseOrders), [guardSave, rawSavePurchaseOrders])
  const saveReservations = useMemo(() => guardSave('Reservations', rawSaveReservations), [guardSave, rawSaveReservations])
  const saveSites = useMemo(() => guardSave('Sites', rawSaveSites), [guardSave, rawSaveSites])
  const saveDepartments = useMemo(() => guardSave('Departments', rawSaveDepartments), [guardSave, rawSaveDepartments])
  const saveJobPlans = useMemo(() => guardSave('Job Plans', rawSaveJobPlans), [guardSave, rawSaveJobPlans])
  const saveUsers = useMemo(() => guardSave('Users', rawSaveUsers), [guardSave, rawSaveUsers])
  const saveRoles = useMemo(() => guardSave('Roles & Permissions', rawSaveRoles), [guardSave, rawSaveRoles])
  useEffect(() => {
    const nextStatuses = new Map()
    serviceRequests.forEach(request => {
      if (!request.convertedWorkOrder || ['CLOSED', 'CAN'].includes(String(request.status || '').toUpperCase())) return
      const linkedWorkOrder = allWorkOrders.find(order => String(order.WORKORDER) === String(request.convertedWorkOrder))
      if (!linkedWorkOrder) return
      const nextStatus = String(linkedWorkOrder.STATUS || '').toUpperCase() === 'CLOSE' ? 'RESOLVED' : 'CONVERTED'
      if (request.status !== nextStatus) nextStatuses.set(request.sr, nextStatus)
    })
    if (!nextStatuses.size) return
    saveServiceRequests(rows => rows.map(request => nextStatuses.has(request.sr) ? { ...request, status: nextStatuses.get(request.sr) } : request))
  }, [serviceRequests, allWorkOrders, saveServiceRequests])
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
  const navigate = name => {
    if (!canNavigate(name)) {
      const fallback = fallbackPage || 'Overview'
      setActive(fallback)
      setSearch('')
      setMobileOpen(false)
      window.history.replaceState({}, '', pathForPage(fallback))
      return
    }
    setActive(name); setSearch(''); setMobileOpen(false); window.history.pushState({},'',pathForPage(name))
  }
  useEffect(() => {
    if (!isAuthenticated || !effectiveUser) return
    const syncRouteAccess = () => {
      const routePage = routeToPage(window.location.pathname)
      if (canViewPage(effectiveUser, routePage)) {
        setActive(routePage)
        return
      }
      if (fallbackPage) {
        setActive(fallbackPage)
        window.history.replaceState({}, '', pathForPage(fallbackPage))
      }
    }
    syncRouteAccess()
    window.addEventListener('popstate', syncRouteAccess)
    return () => window.removeEventListener('popstate', syncRouteAccess)
  }, [isAuthenticated, effectiveUser, fallbackPage])
  const jobPlanRouteId = decodeURIComponent(window.location.pathname.split('/job-plans/')[1] || '')
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
        totalMinutes: tasks.reduce((sum, row) => sum + Math.max(1, Math.round(Number(row['TASK DURATION IN HOUR'] || 0) * 1440)), 0)
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
  const failureRouteId = decodeURIComponent(window.location.pathname.split('/failure-library/')[1] || '')
  const failureClassRows = useMemo(() => [...new Map(failureCodeRecords.map(row => [row['FAILURE CLASS ID'], row])).values()], [failureCodeRecords])
  const [selectedFailureClass,setSelectedFailureClass]=useState(failureClassRows.find(row => row['FAILURE CLASS ID'] === failureRouteId) || null)
  const requestFailureOptions = useMemo(() => uniqueCodeOptions(failureCodeRecords, 'FAILURE CLASS ID', 'DESCRIPTION'), [failureCodeRecords])
  useEffect(() => {
    if (!jobPlanRouteId) return
    const latest = jobPlanSummaryRows.find(plan => plan.JPNUM === jobPlanRouteId)
    if (latest) setSelectedJobPlan(latest)
  }, [jobPlanSummaryRows, jobPlanRouteId])
  useEffect(() => {
    if (!failureRouteId) return
    const latest = failureClassRows.find(row => row['FAILURE CLASS ID'] === failureRouteId)
    if (latest) setSelectedFailureClass(latest)
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
  const nextCorrectiveWorkOrderNumber = () => String(
    Math.max(56545134, ...allWorkOrders.map(order => Number(order.WORKORDER) || 0)) + 1
  )
  const convertRequest = async request => {
    const existing = allWorkOrders.find(order =>
      String(order['SOURCE SR']) === String(request.sr) ||
      (request.convertedWorkOrder && String(order.WORKORDER) === String(request.convertedWorkOrder))
    )
    if (existing) {
      const failureFields = failureFieldsFromRequest(request)
      const updated = {
        ...existing,
        ...failureFields,
        'DEPARTMENT ': request.assignedDepartment || request.department || existing['DEPARTMENT '] || '',
        'SUB DEPARTMENT  NAME': request.subDepartment || existing['SUB DEPARTMENT  NAME'] || '',
        'ASSIGNED DEPARTMENT': request.assignedDepartment || request.department || existing['ASSIGNED DEPARTMENT'] || ''
      }
      await saveWorkOrders(rows => rows.map(order => String(order.WORKORDER) === String(existing.WORKORDER) ? updated : order))
      return updated
    }
    const number=nextCorrectiveWorkOrderNumber()
    const cm={'WORKORDER':number,'DESCRIPITION ':request.description,'LOCATION ':request.location,'LOCATION PRIORTY':toLocationPriority(request.priority),'ASSET':request.asset||'Unassigned','STATUS':workOrderWorkflow.initialStatus,'WORK TYPE ':'CM','STATUS DESCRIPITION':workflowStatusLabel(workOrderWorkflow,workOrderWorkflow.initialStatus)||workOrderWorkflow.initialStatus,'DEPARTMENT ':request.assignedDepartment||request.department,'SUB DEPARTMENT  NAME':request.subDepartment||'','PRIORTY':request.priority==='Emergency'?1:request.priority==='High'?2:3,'SITE':request.site,'TARGET START ':null,'TARGET FINISH ':null,'REPORTED DATE ':request.reportedDate||nowLocalDateTime(),'SOURCE SR':request.sr,'REPORTED BY':request.reportedBy||'','SOURCE SR PRIORITY':request.priority||'','SOURCE SR TYPE':request.requestType||'','PTW REQUIRED':workOrderWorkflow.ptwRequiredDefault,...failureFieldsFromRequest(request)}
    await saveWorkOrders(rows=>[...rows,cm])
    return cm
  }
  const openConvertedWorkOrder=(number, sourceRequest)=>{if(!canNavigate('Work Orders')) return navigate(fallbackPage);syncWorkOrderFailureFromRequest(number, sourceRequest);setActive('Work Orders');setSearch('');window.history.pushState({},'',`/work-orders/${number}`)}
  // Deep link carries the target number so the tab only applies to that order, never
  // to whichever work order the user opens next.
  const [workOrderDeepLink,setWorkOrderDeepLink]=useState(null)
  const openWorkOrderTab=(number,tab)=>{setWorkOrderDeepLink({number:String(number),tab});openConvertedWorkOrder(number)}
  const deepLinkTabFor=order=>String(order?.WORKORDER)===workOrderDeepLink?.number?workOrderDeepLink.tab:undefined
  const todayStamp=()=>nowLocalDate()
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
  const receivePurchaseOrderStock=order=>{
    const quantity=Number(order.quantity||0)
    if(!quantity) return
    if(order.type==='Material') {
      const storeCode=preferredStoreFor(order)
      const itemCode=itemCodeFor(order.type,order.itemCode||order.item)
      upsertStockRecord(storeCode,itemCode,{balanceDelta:quantity})
      return
    }
    const toolNumber=itemCodeFor(order.type,order.itemCode||order.item)
    const existing=toolRecords.find(tool=>cleanText(tool.toolNumber)===cleanText(toolNumber)||cleanText(tool.description)===cleanText(order.item))
    if(existing) {
      saveTools(rows=>rows.map(tool=>cleanText(tool.toolNumber)===cleanText(existing.toolNumber)?{...tool,quantity:Number(tool.quantity||0)+quantity,status:tool.status==='Maintenance'?'Maintenance':'Available'}:tool))
      return
    }
    saveTools(rows=>[{toolNumber,description:order.item||toolNumber,category:order.type||'Tool',location:order.source||'',quantity,status:'Available',inspectionDue:''},...rows])
  }
  const resourceMatches = (resource, record, index) => {
    if (record.resourceRequestId) return String(resource.resourceRequestId || '') === String(record.resourceRequestId)
    if (record.resourceIndex !== undefined) return Number(index) === Number(record.resourceIndex)
    return String(resource.item || '').trim() === String(record.item || '').trim()
  }
  const linkWorkOrderResourceTransaction = (record, patch) => {
    if (!record?.workOrder || !record.item) return
    saveWorkOrders(rows => rows.map(order => {
      if (String(order.WORKORDER) !== String(record.workOrder)) return order
      const resources = Array.isArray(order['PLANNED RESOURCES']) ? order['PLANNED RESOURCES'] : []
      if (!resources.length) return order
      return {
        ...order,
        'PLANNED RESOURCES': resources.map((resource,index) => resourceMatches(resource, record, index) ? { ...resource, ...patch } : resource)
      }
    }))
  }
  const createPurchaseRequest=record=>{
    if(!canDo('Purchase Requisitions','create')){notify('No create access for Purchase Requisitions.','error');return null}
    // Dedupe only the same planned resource line. Separate lines for the same item are
    // allowed because each line can represent a different shortage/request.
    const existing=record.resourceRequestId?purchaseRequests.find(row=>String(row.resourceRequestId||'')===String(record.resourceRequestId)&&!['CAN'].includes(row.status)):null
    if(existing){notify(`Purchase requisition ${existing.purchaseRequest} already exists.`,'info');return existing}
    const created={purchaseRequest:`PR-2026-${String(purchaseRequests.length+1).padStart(4,'0')}`,status:'WAPPR',statusDescription:statusDescription('purchaseRequisition','WAPPR'),createdAt:todayStamp(),...record,itemCode:itemCodeFor(record.type,record.itemCode||record.item),source:record.type==='Material'?preferredStoreFor(record):record.source}
    savePurchaseRequests(rows=>created.resourceRequestId&&rows.some(row=>String(row.resourceRequestId||'')===String(created.resourceRequestId)&&!['CAN'].includes(row.status))?rows:[created,...rows])
    linkWorkOrderResourceTransaction(created, { requestStatus: 'WAPPR', transactionRef: created.purchaseRequest, purchaseRequest: created.purchaseRequest, supplyChainStatus: 'PR waiting approval' })
    notify(`Purchase requisition ${created.purchaseRequest} created.`,'success')
    return created
  }
  const createPurchaseOrderFromRequest=request=>{
    if(!canDo('Purchase Orders','create')||!canDo('Purchase Requisitions','approve')){notify('No approve/create access for this purchase workflow.','error');return null}
    const existing=purchaseOrders.find(order=>order.purchaseRequest===request.purchaseRequest)
    if(existing){notify(`Purchase order ${existing.purchaseOrder} already exists.`,'info');return existing}
    const created={purchaseOrder:`PO-2026-${String(purchaseOrders.length+1).padStart(4,'0')}`,purchaseRequest:request.purchaseRequest,resourceRequestId:request.resourceRequestId,workOrder:request.workOrder,type:request.type,item:request.item,itemCode:itemCodeFor(request.type,request.itemCode||request.item),quantity:request.quantity,source:request.type==='Material'?preferredStoreFor(request):request.source,site:request.site,department:request.department,status:'WAPPR',statusDescription:statusDescription('purchaseOrder','WAPPR'),createdAt:todayStamp()}
    savePurchaseOrders(rows=>rows.some(order=>order.purchaseRequest===request.purchaseRequest)?rows:[created,...rows])
    savePurchaseRequests(rows=>rows.map(row=>row.purchaseRequest===request.purchaseRequest?{...row,status:'APPR',statusDescription:statusDescription('purchaseRequisition','APPR'),purchaseOrder:created.purchaseOrder,approvedAt:todayStamp()}:row))
    linkWorkOrderResourceTransaction(created, { requestStatus: 'APPR', transactionRef: created.purchaseOrder, purchaseRequest: created.purchaseRequest, purchaseOrder: created.purchaseOrder, supplyChainStatus: 'PO waiting approval' })
    notify(`Purchase order ${created.purchaseOrder} created.`,'success')
    return created
  }
  const updatePurchaseRequest=(reference,patch)=>{
    const source=purchaseRequests.find(row=>row.purchaseRequest===reference)
    const updated=source?{...source,...patch,statusDescription:patch.status?statusDescription('purchaseRequisition',patch.status):source.statusDescription}:null
    savePurchaseRequests(rows=>rows.map(row=>row.purchaseRequest===reference?{...row,...patch,statusDescription:patch.status?statusDescription('purchaseRequisition',patch.status):row.statusDescription}:row))
    if(updated) linkWorkOrderResourceTransaction(updated, { requestStatus: updated.status, purchaseRequest: updated.purchaseRequest, purchaseOrder: updated.purchaseOrder, supplyChainStatus: `PR ${statusDescription('purchaseRequisition', updated.status)}` })
    if(patch.status) notify(`${reference} updated to ${statusDescription('purchaseRequisition', patch.status)}.`,'success')
  }
  const updateJobPlan=(reference,patch)=>{
    saveJobPlans(rows=>rows.map(row=>row.JPNUM===reference?{...row,...patch}:row))
    setJobTaskRecords(rows=>rows.map(row=>row.JPNUM===reference?{...row,...patch}:row))
    setSelectedJobPlan(current=>current?.JPNUM===reference?{...current,...patch}:current)
  }
  const createJobPlan=form=>{
    const jpnum=String(form.JPNUM||'').trim()
    if(!jpnum) return
    saveJobPlans(rows=>rows.some(row=>row.JPNUM===jpnum)?rows:[{JPNUM:jpnum,DESCRIPTION:form.DESCRIPTION||'',status:form.status||'DRAFT'},...rows])
    notify(`Job plan ${jpnum} saved.`,'success')
    // The create modal collects no JOBTASKID, but the tasks table keys rows on it.
    if(form['JOB TASK DESCRIPTION']) setJobTaskRecords(rows=>[...rows,{...form,JPNUM:jpnum,JOBTASKID:form.JOBTASKID||`${jpnum}-${form['JOB TASK SEQUENCE']||rows.filter(row=>row.JPNUM===jpnum).length+1}`}])
  }
  const reservationOpenFor = record => reservation => {
    const status = String(reservation.status || '').toUpperCase()
    if (['CANCELLED', 'COMPLETE'].includes(status)) return false
    if (String(reservation.workOrder || '') !== String(record.workOrder || '')) return false
    if (record.resourceRequestId && String(reservation.resourceRequestId || '') === String(record.resourceRequestId)) return true
    const reservationType = String(reservation.type || 'Material').toLowerCase()
    const recordType = String(record.type || 'Material').toLowerCase()
    const reservationItem = cleanText(reservation.itemCode || reservation.item)
    const recordItem = cleanText(record.itemCode || record.item)
    return reservationType === recordType && reservationItem && recordItem && reservationItem === recordItem
  }
  const createReservation=record=>{
    if(!canDo('Reservations','create')){notify('No create access for Reservations.','error');return null}
    const itemCode=itemCodeFor(record.type,record.itemCode||record.item)
    const existing=reservations.find(reservationOpenFor({ ...record, itemCode }))
    if(existing){
      const updated={
        ...existing,
        resourceRequestId: existing.resourceRequestId || record.resourceRequestId,
        purchaseRequest: existing.purchaseRequest || record.purchaseRequest,
        purchaseOrder: existing.purchaseOrder || record.purchaseOrder,
        source: record.source || existing.source,
        availableQuantity: Number(record.availableQuantity || existing.availableQuantity || record.quantity || existing.quantity || 0),
        quantity: Number(existing.quantity || record.quantity || 0),
        itemCode: existing.itemCode || itemCode,
        item: existing.item || record.item
      }
      saveReservations(rows=>rows.map(row=>row.reservation===existing.reservation?updated:row))
      linkWorkOrderResourceTransaction(updated, { requestStatus: updated.status, transactionRef: updated.reservation, reservation: updated.reservation, purchaseRequest: updated.purchaseRequest, purchaseOrder: updated.purchaseOrder, supplyChainStatus: 'Received against existing reservation' })
      notify(`${existing.reservation} updated from purchase order.`, 'success')
      return updated
    }
    const prefix=record.type==='Material'?'RSV':'ALC'
    const created={reservation:`${prefix}-2026-${String(reservations.length+1).padStart(4,'0')}`,status:'ENTERED',statusDescription:statusDescription('inventoryUsage','ENTERED'),createdAt:todayStamp(),arrangedQuantity:0,releasedQuantity:0,deliveredQuantity:0,...record,itemCode}
    const stockStore=storeCodeFor(created.source)
    const stockItem=itemCodeFor(created.type,created.itemCode||created.item)
    const reservedQuantity=Number(created.quantity||0)
    if(created.type==='Material'&&stockStore&&stockItem&&reservedQuantity) {
      setStockRecords(rows=>rows.map(row=>{
        if(String(row.storeroom)!==String(stockStore)||String(row.itemNumber)!==String(stockItem)) return row
        return { ...row, reserved: Number(row.reserved||0)+reservedQuantity }
      }))
      const stockRow=stockRecords.find(row=>String(row.storeroom)===String(stockStore)&&String(row.itemNumber)===String(stockItem))
      if(stockRow) api.put(`/inventory-stock/${encodeURIComponent(stockStore)}/${encodeURIComponent(stockItem)}`, {
        balance: Number(stockRow.balance||0),
        reserved_quantity: Number(stockRow.reserved||0)+reservedQuantity,
        reorder_point: stockRow.reorderLevel ?? null
      }).catch(error=>notify(error.message||'Unable to update inventory stock.','error'))
    }
    saveReservations(rows=>rows.some(row=>row.reservation===created.reservation)?rows:[created,...rows])
    linkWorkOrderResourceTransaction(created, { requestStatus: created.status, transactionRef: created.reservation, reservation: created.reservation, purchaseRequest: created.purchaseRequest, purchaseOrder: created.purchaseOrder, supplyChainStatus: 'Reservation entered' })
    notify(`${created.reservation} created.`,'success')
    return created
  }
  const updatePurchaseOrder=(reference,patch)=>{
    const source=purchaseOrders.find(order=>order.purchaseOrder===reference)
    const next=source?{...source,...patch,statusDescription:patch.status?statusDescription('purchaseOrder',patch.status):source.statusDescription}:null
    savePurchaseOrders(rows=>rows.map(row=>row.purchaseOrder===reference?{...row,...patch,statusDescription:patch.status?statusDescription('purchaseOrder',patch.status):row.statusDescription}:row))
    if(patch.status) notify(`${reference} updated to ${statusDescription('purchaseOrder', patch.status)}.`,'success')
    if(next) {
      linkWorkOrderResourceTransaction(next, { requestStatus: next.status, purchaseRequest: next.purchaseRequest, purchaseOrder: next.purchaseOrder, transactionRef: next.purchaseOrder, supplyChainStatus: `PO ${statusDescription('purchaseOrder', next.status)}` })
      if(source?.status!=='CLOSE'&&next.status==='CLOSE') {
        receivePurchaseOrderStock(next)
      }
      if(source?.status!=='CLOSE'&&next.status==='CLOSE'&&next.workOrder) {
        const reservation=createReservation({
          workOrder: next.workOrder,
          resourceRequestId: next.resourceRequestId,
          type: next.type,
          item: next.item,
          itemCode: itemCodeFor(next.type,next.itemCode||next.item),
          quantity: next.quantity,
          source: next.type==='Material'?preferredStoreFor(next):next.source,
          availableQuantity: Number(next.quantity || 0),
          site: next.site,
          department: next.department,
          purchaseRequest: next.purchaseRequest,
          purchaseOrder: next.purchaseOrder
        })
        linkWorkOrderResourceTransaction(next, { requestStatus: 'ENTERED', transactionRef: reservation?.reservation || next.purchaseOrder, purchaseRequest: next.purchaseRequest, purchaseOrder: next.purchaseOrder, reservation: reservation?.reservation, supplyChainStatus: 'Received and reserved' })
      }
    }
  }
  const updateReservation=(reference,patch)=>{
    const source=reservations.find(row=>row.reservation===reference)
    const updated=source?{...source,...patch}:null
    const stockStore=storeCodeFor(updated?.source)
    const stockItem=materialCodeFor(updated?.itemCode||updated?.item)
    if(updated?.type==='Material'&&stockStore&&stockItem) {
      const beforeReleased=Number(source?.releasedQuantity||0)
      const afterReleased=Number(updated.releasedQuantity||0)
      const releaseDelta=Math.max(0,afterReleased-beforeReleased)
      if(releaseDelta) {
        setStockRecords(rows=>rows.map(row=>{
          if(String(row.storeroom)!==String(stockStore)||String(row.itemNumber)!==String(stockItem)) return row
          return {
            ...row,
            balance: Math.max(0,Number(row.balance||0)-releaseDelta),
            reserved: Math.max(0,Number(row.reserved||0)-releaseDelta)
          }
        }))
        const stockRow=stockRecords.find(row=>String(row.storeroom)===String(stockStore)&&String(row.itemNumber)===String(stockItem))
        api.put(`/inventory-stock/${encodeURIComponent(stockStore)}/${encodeURIComponent(stockItem)}`, {
          balance: Math.max(0,Number(stockRow?.balance||0)-releaseDelta),
          reserved_quantity: Math.max(0,Number(stockRow?.reserved||0)-releaseDelta),
          reorder_point: stockRow?.reorderLevel ?? null
        }).catch(error=>notify(error.message||'Unable to update inventory stock.','error'))
      }
    }
    saveReservations(rows=>rows.map(row=>row.reservation===reference?{...row,...patch}:row))
    if(updated) linkWorkOrderResourceTransaction(updated, { requestStatus: updated.status, transactionRef: updated.reservation, reservation: updated.reservation, purchaseRequest: updated.purchaseRequest, purchaseOrder: updated.purchaseOrder, supplyChainStatus: `Reservation ${statusDescription('inventoryUsage', updated.status)}` })
    if(patch.status) notify(`${reference} updated to ${statusDescription('inventoryUsage', patch.status)}.`,'success')
  }
  const releaseCancelledReservationStock = reservation => {
    const reservedQuantity = Math.max(0, Number(reservation.quantity || reservation.reservedQuantity || 0) - Number(reservation.releasedQuantity || 0))
    const stockStore = storeCodeFor(reservation.source)
    const stockItem = materialCodeFor(reservation.itemCode || reservation.item)
    if (reservation.type !== 'Material' || !reservedQuantity || !stockStore || !stockItem) return
    setStockRecords(rows => rows.map(row => {
      if (String(row.storeroom) !== String(stockStore) || String(row.itemNumber) !== String(stockItem)) return row
      return { ...row, reserved: Math.max(0, Number(row.reserved || 0) - reservedQuantity) }
    }))
    const stockRow = stockRecords.find(row => String(row.storeroom) === String(stockStore) && String(row.itemNumber) === String(stockItem))
    if (stockRow) api.put(`/inventory-stock/${encodeURIComponent(stockStore)}/${encodeURIComponent(stockItem)}`, {
      balance: Number(stockRow.balance || 0),
      reserved_quantity: Math.max(0, Number(stockRow.reserved || 0) - reservedQuantity),
      reorder_point: stockRow.reorderLevel ?? null
    }).catch(error => notify(error.message || 'Unable to release cancelled reservation stock.', 'error'))
  }
  const cancelWorkOrderSupplyChain = number => {
    const relatedReservations = reservations.filter(row => String(row.workOrder) === String(number) && !['CANCELLED', 'COMPLETE'].includes(String(row.status || '').toUpperCase()))
    const relatedRequests = purchaseRequests.filter(row => String(row.workOrder) === String(number) && !['CAN', 'CLOSE'].includes(String(row.status || '').toUpperCase()))
    const relatedOrders = purchaseOrders.filter(row => String(row.workOrder) === String(number) && !['CAN', 'CLOSE'].includes(String(row.status || '').toUpperCase()))
    if (!relatedReservations.length && !relatedRequests.length && !relatedOrders.length) return

    relatedReservations.forEach(releaseCancelledReservationStock)
    const cancelledAt = todayStamp()
    if (relatedReservations.length) saveReservations(rows => rows.map(row =>
      String(row.workOrder) === String(number) && !['CANCELLED', 'COMPLETE'].includes(String(row.status || '').toUpperCase())
        ? { ...row, status: 'CANCELLED', statusDescription: statusDescription('inventoryUsage', 'CANCELLED'), cancelledAt }
        : row
    ))
    if (relatedRequests.length) savePurchaseRequests(rows => rows.map(row =>
      String(row.workOrder) === String(number) && !['CAN', 'CLOSE'].includes(String(row.status || '').toUpperCase())
        ? { ...row, status: 'CAN', statusDescription: statusDescription('purchaseRequisition', 'CAN'), cancelledAt }
        : row
    ))
    if (relatedOrders.length) savePurchaseOrders(rows => rows.map(row =>
      String(row.workOrder) === String(number) && !['CAN', 'CLOSE'].includes(String(row.status || '').toUpperCase())
        ? { ...row, status: 'CAN', statusDescription: statusDescription('purchaseOrder', 'CAN'), cancelledAt }
        : row
    ))
    notify(`Cancelled ${relatedReservations.length} reservation(s), ${relatedRequests.length} PR(s), and ${relatedOrders.length} PO(s) for WO #${number}.`, 'success')
  }
  const updateWorkOrder=(number,patch)=>{
    const source=allWorkOrders.find(order=>String(order.WORKORDER)===String(number))
    const nextStatus=String(patch?.STATUS || source?.STATUS || '').toUpperCase()
    const wasCancelled=String(source?.STATUS || '').toUpperCase()==='CAN'
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
    if(nextStatus==='CAN'&&!wasCancelled) cancelWorkOrderSupplyChain(number)
    return result
  }
  const createWorkOrder=async form=>{if(!canDo('Work Orders','create')){notify('No create access for Work Orders.','error');return null}const next=Math.max(...allWorkOrders.map(order=>Number(order.WORKORDER)||0),56545134)+1;const created={'WORKORDER':String(next),'DESCRIPITION ':form.description,'LOCATION ':form.location,'LOCATION PRIORTY':toLocationPriority(form.priority),'ASSET':form.asset,'STATUS':workOrderWorkflow.initialStatus,'WORK TYPE ':form.type,'STATUS DESCRIPITION':workflowStatusLabel(workOrderWorkflow,workOrderWorkflow.initialStatus)||workOrderWorkflow.initialStatus,'DEPARTMENT ':form.department||'','SUB DEPARTMENT  NAME':form.subDepartment||'','ASSIGNED DEPARTMENT':form.department||'','ASSET DESCRIPTION':assetDescriptionFromMaster(form.asset, assetRecords),'SYSTEM':assetFromMaster(form.asset, assetRecords)?.system||'','PRIORTY':Number(String(form.priority).charAt(0))||3,'SITE':form.site,'TARGET START ':null,'TARGET FINISH ':null,'REPORTED DATE ':nowLocalDateTime(),'PTW REQUIRED':workOrderWorkflow.ptwRequiredDefault};const result=await saveWorkOrders(rows=>[...rows,created]);if(result?.__saveError)return null;notify(`Work order #${created.WORKORDER} created.`,'success');return created}
  const generatePmWorkOrder=(pm,tasks)=>saveWorkOrders(rows=>{
    if(rows.some(order=>order['PM NUMBER']===pm.pmNumber&&order['PM CYCLE']===pm.cycle)){notify(`PM work order for ${pm.pmNumber} already exists.`,'info');return rows}
    const assetRecord=assetFromMaster(pm.asset, assetRecords)
    const inheritedLocation=pm.location || assetRecord?.location || ''
    const inheritedSite=pm.site || assetRecord?.site || ''
    notify(`PM work order ${pm.workOrder} generated.`,'success')
    return [...rows,{'WORKORDER':pm.workOrder,'DESCRIPITION ':pm.description,'LOCATION ':inheritedLocation,'LOCATION PRIORTY':3,'ASSET':pm.asset,'ASSET DESCRIPTION':assetRecord?.description?.trim() || '','STATUS':pm.woStatus||'WSCH','WORK TYPE ':'PM','STATUS DESCRIPITION':maximoWorkOrderStatusDescriptions[pm.woStatus||'WSCH']||'Waiting for Schedule','DEPARTMENT ':pm.department,'SUB DEPARTMENT  NAME':pm.subDepartment,'ASSIGNED DEPARTMENT':pm.department,'PRIORTY':3,'SITE':inheritedSite,'TARGET START ':pm.startDate,'TARGET FINISH ':pm.startDate,'REPORTED DATE ':nowLocalDateTime(),'PM NUMBER':pm.pmNumber,'PM CYCLE':pm.cycle,'JOB PLAN':pm.jobPlan,'PM RULE':pm.scheduleRule||'','JOB PLAN TASKS':tasks,'ESTIMATED DURATION':tasks.reduce((sum,task)=>sum+Number(task['TASK DURATION IN HOUR']||0),0)*24,'ROUTE':pm.route,'LEAD TIME (DAYS)':pm.leadTime,'FREQUENCY':pm.frequency,'FREQUNIT':pm.freqUnit,'PMCOUNTER':pm.pmCounter,'STORELOC':pm.storeLocation,'SUPERVISOR':pm.supervisor,'LEAD':pm.lead,'PERSONGROUP':pm.personGroup,'PM STATUS':pm.pmStatus}]
  })
  const pages = {
    'Job Requests': <ServiceRequestsPage onConvert={convertRequest} onOpenWorkOrder={openConvertedWorkOrder} requests={scopedServiceRequests} allRequests={serviceRequests} setRequests={saveServiceRequests} assets={scopedAssets} workOrders={scopedWorkOrders} siteRecords={siteRecords} departmentRecords={departmentRecords} failureOptions={requestFailureOptions} access={accessFor('Job Requests')}/>,
    'Incidents': <IncidentsPage rows={scopedIncidents} setRows={saveIncidents} siteRecords={siteRecords} departmentRecords={departmentRecords} locationRows={scopedLocations} laborRows={laborRecords}/>,
    'Work Orders': <WorkOrdersPage rows={scopedWorkOrders} assets={scopedAssets} locationRows={scopedLocations} siteRecords={siteRecords} departmentRecords={departmentRecords} onCreate={createWorkOrder} onImportRows={saveWorkOrders} EditorComponent={props => <WorkOrderEditor {...props} projectName={projectName} initialTab={deepLinkTabFor(props.order)} workflow={workOrderWorkflow} siteRecords={siteRecords} departmentRecords={departmentRecords} assetRecords={assetRecords} workOrderRows={allWorkOrders} laborRecords={laborRecords} materialRecords={materialRecords} stockRecords={stockRecords} storeRecords={storeRecords} toolRecords={toolRecords} jobTaskRecords={jobTaskRecords} failureCodeRecords={failureCodeRecords} reservationRecords={reservations} purchaseRequestRecords={purchaseRequests} purchaseOrderRecords={purchaseOrders} meterRecords={meterRecords} onCreatePurchaseRequest={createPurchaseRequest} onCreateReservation={createReservation} onUpdateWorkOrder={updateWorkOrder} onNotifyWorkOrderStatus={sendWorkOrderStatusNotification} />} excelDate={excelDate} workflow={workOrderWorkflow} slaBreached={slaBreached} access={accessFor('Work Orders')}/>,
    'Assets': <AssetsPage rows={scopedAssets} setRows={saveAssets} workOrders={scopedWorkOrders} siteRecords={siteRecords} departmentRecords={departmentRecords} locationRows={scopedLocations} />,
    'Preventive Maintenance': <PreventiveMaintenancePage rows={pmScheduleRecords} setRows={savePmSchedules} pmRules={pmRuleRecords} assets={scopedAssets} jobTasks={jobTaskRecords} workOrders={scopedWorkOrders} departmentRecords={departmentRecords} locationRows={scopedLocations} storeRows={storeRecords} laborRows={laborRecords} scopeUser={effectiveUser} onGenerate={generatePmWorkOrder} onOpenWorkOrder={openConvertedWorkOrder}/>,
    'Meters': <MetersPage rows={meterRecords} setRows={saveMeters} assets={scopedAssets} workOrders={scopedWorkOrders} siteRecords={siteRecords} departmentRecords={departmentRecords} locationRows={scopedLocations} />,
    'Locations': <LocationsPage rows={scopedLocations} setRows={saveLocations} assets={scopedAssets} workOrders={scopedWorkOrders} siteRecords={siteRecords} departmentRecords={departmentRecords}/>,
    'Job Plans': selectedJobPlan ? <JobPlanDetailPage plan={selectedJobPlan} tasks={jobTaskRecords.filter(task=>task.JPNUM===selectedJobPlan.JPNUM)} workOrders={allWorkOrders.filter(order=>getWorkOrderJobPlan(order)===selectedJobPlan.JPNUM)} onBack={()=>{setSelectedJobPlan(null);window.history.pushState({},'','/job-plans')}} onUpdate={updateJobPlan}/> : <RegisterPage title="Job plans" eyebrow="MAINTENANCE" description="Standard task sequences and estimated durations for technicians." rows={jobPlanSummaryRows} onCreate={createJobPlan} search={search} setSearch={setSearch} action="New job plan" modalTitle="Add job plan" modalNote="Create a job plan task line with sequence, instructions, and estimated duration." modalFields={[
      { key: 'JPNUM', label: 'Job Plan', required: true, suggestions: jobPlanOptions(jobTaskRecords), placeholder: 'Select a plan or type a new number' },
      { key: 'DESCRIPTION', label: 'Plan Description', required: true, full: true },
      { key: 'JOB TASK SEQUENCE', label: 'Task Sequence', required: true, type: 'number', defaultValue: 10 },
      { key: 'JOB TASK DESCRIPTION', label: 'Task Description', required: true, full: true },
      { key: 'TASK DURATION IN HOUR', label: 'Duration in Hours', required: true, type: 'number', defaultValue: 1 },
      { key: 'status', label: 'Status', required: true, options: ['DRAFT', 'ACTIVE', 'INACTIVE'], defaultValue: 'ACTIVE' }
    ]} mapFormToRow={form => ({ ...form, status: form.status || 'ACTIVE', 'TASK DURATION IN HOUR': Number(form['TASK DURATION IN HOUR'] || 0) })} statusTabs={['DRAFT', 'ACTIVE', 'INACTIVE']} rowKey="JPNUM" onRowClick={row=>{setSelectedJobPlan(row);window.history.pushState({},'',`/job-plans/${row.JPNUM}`)}} columns={[
      {key:'JPNUM',label:'Plan',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Plan description'},{key:'taskCount',label:'Tasks'},{key:'totalMinutes',label:'Duration',render:v=>`${v} min`},{key:'status',label:'Status',render:v=>v||'ACTIVE'}
    ]}/>,
    'Failure Library': selectedFailureClass ? <FailureLibraryDetailPage failureClass={selectedFailureClass} rows={failureCodeRecords.filter(row=>row['FAILURE CLASS ID']===selectedFailureClass['FAILURE CLASS ID'])} workOrders={allWorkOrders.filter(order=>order['FAILURE CODE']===selectedFailureClass['FAILURE CLASS ID'])} onBack={()=>{setSelectedFailureClass(null);window.history.pushState({},'','/failure-library')}}/> : <RegisterPage title="Failure library" eyebrow="RELIABILITY" description="Search the bilingual Maximo problem, cause, and remedy hierarchy." rows={failureClassRows.map(row=>({...row, problemCount: failureCodeRecords.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['PROBLEM CODE']).length, causeCount: failureCodeRecords.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['CAUSE CODE']).length, remedyCount: failureCodeRecords.filter(item=>item['FAILURE CLASS ID']===row['FAILURE CLASS ID']&&item['REMEDY CODE']).length}))} search={search} setSearch={setSearch} action="Add code" modalTitle="Add failure code" modalNote="Create a failure hierarchy record. Cause and remedy can stay optional." modalFields={[
      { key: 'FAILURE CLASS ID', label: 'Failure Class ID', required: true, suggestions: failureClassOptions(failureCodeRecords), placeholder: 'Select a class or type a new one' },
      { key: 'DESCRIPTION', label: 'Class Description', required: true, full: true },
      { key: 'PROBLEM CODE', label: 'Problem Code', required: true },
      { key: 'PC - DESCRIPTION', label: 'Problem Description', required: true, full: true },
      { key: 'CAUSE CODE', label: 'Cause Code' },
      { key: 'CC - DESCRIPTION', label: 'Cause Description', full: true },
      { key: 'REMEDY CODE', label: 'Remedy Code' },
      { key: 'RC - DESCRIPTION', label: 'Remedy Description', full: true }
    ]} mapFormToRow={form => ({ ...form })} onCreate={form => saveFailureCodes(rows => [{ ...form }, ...rows])} rowKey="FAILURE CLASS ID" onRowClick={row=>{setSelectedFailureClass(row);window.history.pushState({},'',`/failure-library/${encodeURIComponent(row['FAILURE CLASS ID'])}`)}} columns={[
      {key:'FAILURE CLASS ID',label:'Class',render:v=><strong className="mono">{v}</strong>},{key:'DESCRIPTION',label:'Class description'},{key:'problemCount',label:'Problems'},{key:'causeCount',label:'Causes'},{key:'remedyCount',label:'Remedies'}
    ]}/>,
    'Labor': <LaborPage rows={laborRecords} setRows={saveLabor} workOrders={scopedWorkOrders} departmentRecords={departmentRecords} laborRows={laborRecords}/>,
    'Materials': <MaterialsPage rows={materialRecords} setRows={saveMaterials} stockRows={stockRecords} storeRows={storeRecords} workOrders={scopedWorkOrders} purchaseRequests={scopedPurchaseRequests} purchaseOrders={scopedPurchaseOrders} onCreateRequest={createPurchaseRequest} onUpdateStock={(storeCode,itemCode,patch)=>upsertStockRecord(storeCode,itemCode,patch)}/>,
    'Stores': <StoresPage materials={materialRecords} tools={toolRecords} stockRows={stockRecords} storeRows={storeRecords} setStoreRows={saveStores} locationRows={locationRecords} siteRecords={siteRecords} scopeUser={effectiveUser}/>,
    'Purchase Requisitions': <PurchaseRequestsPage rows={scopedPurchaseRequests} purchaseOrders={scopedPurchaseOrders} materials={materialRecords} tools={toolRecords} storeRows={storeRecords} siteRecords={siteRecords} departmentRecords={departmentRecords} onCreateRequest={createPurchaseRequest} onApproveRequest={createPurchaseOrderFromRequest} onUpdateRequest={updatePurchaseRequest}/>,
    'Purchase Orders': <PurchaseOrdersPage rows={scopedPurchaseOrders} onUpdateOrder={updatePurchaseOrder} onUpdateRequest={updatePurchaseRequest}/>,
    'Reservations': <ReservationsPage rows={scopedReservations} stockRows={stockRecords} workOrders={allWorkOrders} onUpdate={updateReservation}/>,
    'Tools & Equipment': <ToolsPage rows={toolRecords} setRows={saveTools} workOrders={scopedWorkOrders} allocations={scopedReservations} storeRows={storeRecords} purchaseRequests={scopedPurchaseRequests} purchaseOrders={scopedPurchaseOrders} onCreateRequest={createPurchaseRequest}/>,
    'Users': <UsersPage rows={userRecords} setRows={saveUsers} roleRows={rolePermissionRecords} laborRows={laborRecords} scopeUser={effectiveUser} siteOptions={siteScopeOptions} departmentOptions={departmentScopeOptions}/>,
    'Roles & Permissions': <RolesPermissionsPage rows={rolePermissionRecords} setRows={saveRoles} siteOptions={siteScopeOptions} departmentOptions={departmentScopeOptions}/>,
    'Sites': <SitesSettingsPage rows={siteRecords} setRows={saveSites}/>,
    'Departments': <DepartmentsSettingsPage rows={departmentRecords} setRows={saveDepartments}/>,
    'Work Order Workflow': <WorkOrderWorkflowSettingsPage workflow={workOrderWorkflow} onSave={saveWorkOrderWorkflow} canEdit={canDo('Work Order Workflow', 'edit')}/>,
    'Notifications': <NotificationsSettingsPage/>,
    'SMTP & SMS': <ConnectorsSettingsPage rows={connectorRecords} setRows={saveConnectors} notify={notify}/>,
    'PM Schedule Rules': <PmRulesSettingsPage rows={pmRuleRecords} setRows={savePmRules} pmSchedules={pmScheduleRecords} workOrders={scopedWorkOrders}/>
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
        counters={{ workOrders: scopedWorkOrders.length }}
        overdueCount={workOrderNotifications.filter(item => item.type === 'overdue').length}
        notifications={workOrderNotifications}
        statusRuleCount={statusMatrix.length}
        mobileOpen={mobileOpen}
        onMobileOpen={() => setMobileOpen(true)}
        onMobileClose={() => setMobileOpen(false)}
        onNavigate={navigate}
        onOpenWorkOrders={() => navigate('Work Orders')}
      >
        {activePage === 'Overview' ? <OverviewPage onNavigate={navigate} onOpenWorkOrderTab={openWorkOrderTab} currentUser={effectiveUser} projectName={projectName} assets={scopedAssets} incidents={scopedIncidents} workOrders={scopedWorkOrders} pmRecords={pmScheduleRecords} failureCodes={failureCodeRecords} meters={meterRecords} purchaseRequests={scopedPurchaseRequests} purchaseOrders={scopedPurchaseOrders} reservations={scopedReservations} /> : pages[activePage]}
      </AppShell>
      <Toast message={toast?.message} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </>
  )
}



























