import { toLocalDateTimeInput } from '../lib/datetime'
import { DEFAULT_WORK_ORDER_WORKFLOW, mapWorkOrderWorkflow } from '../lib/workOrderWorkflow'
import { mapApplicationWorkflows } from '../lib/applicationWorkflow'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'
const tokenKey = 'seder-cafm-auth-token'

export const getAuthToken = () => localStorage.getItem(tokenKey) || ''
export const setAuthToken = token => token ? localStorage.setItem(tokenKey, token) : localStorage.removeItem(tokenKey)

const handleUnauthorized = (status, path) => {
  if (status !== 401 || path === '/auth/login') return
  setAuthToken('')
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cafm:unauthorized'))
}

const request = async (path, options = {}) => {
  const token = getAuthToken()
  const method = String(options.method || 'GET').toUpperCase()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: method === 'GET' ? 'no-cache' : 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    handleUnauthorized(response.status, path)
    const error = new Error(body?.message || `API request failed: ${response.status}`)
    error.status = response.status
    throw error
  }
  return body
}

const requestPage = async path => {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-cache',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    handleUnauthorized(response.status, path)
    const error = new Error(body?.message || `API request failed: ${response.status}`)
    error.status = response.status
    throw error
  }
  return {
    rows: Array.isArray(body) ? body : [],
    total: Number(response.headers.get('X-Total-Count') || 0),
    pageSize: Number(response.headers.get('X-Page-Size') || 0),
    offset: Number(response.headers.get('X-Page-Offset') || 0)
  }
}

export const api = {
  login: credentials => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  me: () => request('/auth/me'),
  get: path => request(path),
  getPage: path => requestPage(path),
  post: (path, payload) => request(path, { method: 'POST', body: JSON.stringify(payload) }),
  put: (path, payload) => request(path, { method: 'PUT', body: JSON.stringify(payload) }),
  delete: path => request(path, { method: 'DELETE' })
}

const safeGet = path => api.get(path).catch(error => {
  if (error.status === 403 || error.status === 404) return []
  throw error
})

const dateValue = value => value || ''
const numberValue = value => value === null || value === undefined ? '' : Number(value)
const jsonArrayValue = value => {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const mapSite = row => ({
  code: row.site_code,
  name: row.site_name,
  region: row.region || '',
  city: row.city || '',
  status: row.status || 'Active'
})

const mapDepartment = row => ({
  subDepartmentCode: row.sub_department_code,
  department: row.department_name,
  description: row.description,
  status: row.status || 'Active'
})

const mapUser = (row, roles = []) => {
  const dataScope = row.effective_data_scope || row.role_data_scope || 'DEPARTMENT'
  return {
    userId: row.user_id,
    username: row.username,
    password: '',
    name: row.display_name,
    email: row.email || '',
    // The role master is only readable by roles that can open Roles & Permissions. Without the
    // row's own role_name as a fallback, every user mapped to a blank role for everyone else.
    role: roles.find(role => role.roleId === row.role_id)?.role || row.role_name || '',
    roleId: row.role_id,
    laborId: row.labor_id || '',
    site: row.site_scope ?? (dataScope === 'GLOBAL' ? 'All Sites' : ''),
    department: row.department_scope ?? (dataScope === 'GLOBAL' ? 'All Departments' : ''),
    status: row.status || 'Active',
    lastLogin: row.last_login_at || '',
    dataScopeOverride: row.data_scope_override || 'ROLE',
    dataScope
  }
}

const mapRole = row => ({
  roleId: row.role_id,
  role: row.role_name,
  roleCode: row.role_code,
  user: '',
  site: 'All Sites',
  department: 'All Departments',
  scope: row.scope_description || '',
  dataScope: row.data_scope || 'DEPARTMENT',
  status: row.status || 'Active',
  permissions: row.permissions || {}
})

const mapAsset = row => ({
  assetnum: row.asset_num,
  description: row.description || '',
  location: row.location_code || '',
  parent: row.parent_asset_num || '',
  department: row.department_name || '',
  'sub department': row.sub_department_code || '',
  prioity: row.priority || '',
  site: row.site_code,
  status: row.status || '',
  modelnum: row.model_num || '',
  serialnum: row.serial_num || '',
  installdate: row.install_date || '',
  quantity: row.quantity || 1
})

const mapLocation = row => ({
  location: row.location_code,
  description: row.description || '',
  type: row.location_type || '',
  status: row.status || '',
  priority: row.priority || '',
  'priority  description': row.priority_description || '',
  site: row.site_code,
  department: row.department_name || '',
  building: row.building || '',
  buildingCategory: row.building_category || '',
  builiding: row.building || '',
  'builiding category': row.building_category || ''
})

const mapLabor = row => ({
  personId: row.labor_id,
  name: row.display_name,
  craftCode: row.craft_code || '',
  craft: row.craft_name || '',
  department: row.department_name || '',
  subDepartment: row.sub_department_code || '',
  site: row.site_code || '',
  availability: row.availability || '',
  status: row.status || 'Active'
})

const mapMaterial = row => ({
  itemNumber: row.item_code,
  description: row.description,
  category: row.category || '',
  unit: row.unit_of_measure || '',
  status: row.status || 'Active'
})

const mapStoreroom = row => ({
  code: row.store_code,
  name: row.store_name,
  site: row.site_code || '',
  status: row.status || 'Active'
})

const mapInventoryStock = row => ({
  stockKey: `${row.store_code}/${row.item_code}`,
  storeroom: row.store_code,
  itemNumber: row.item_code,
  balance: numberValue(row.balance),
  reserved: numberValue(row.reserved_quantity),
  reorderLevel: numberValue(row.reorder_point)
})

const mapTool = row => ({
  toolNumber: row.tool_code,
  description: row.description,
  category: row.category || '',
  location: row.location_code || '',
  site: row.site_code || '',
  quantity: numberValue(row.quantity) || 1,
  lowLevel: numberValue(row.low_level),
  inspectionDue: row.inspection_due || '',
  status: row.status || 'Available'
})

const mapFailureCode = row => ({
  failureLibraryId: row.failure_library_id,
  'FAILURE CLASS ID': row.failure_class_id,
  DESCRIPTION: row.description || '',
  'PROBLEM CODE': row.problem_code || '',
  'PC - DESCRIPTION': row.problem_description || '',
  'CAUSE CODE': row.cause_code || '',
  'CC - DESCRIPTION': row.cause_description || '',
  'REMEDY CODE': row.remedy_code || '',
  'RC - DESCRIPTION': row.remedy_description || ''
})

const typedTransactionRefs = row => {
  const ref = row.transaction_ref || ''
  const text = String(ref).toUpperCase()
  const status = String(row.supply_chain_status || '').toUpperCase()
  return {
    purchaseRequest: row.purchase_request_num || (text.startsWith('PR-') ? ref : ''),
    purchaseOrder: row.purchase_order_num || (text.startsWith('PO-') ? ref : ''),
    reservation: row.reservation_num || (text.startsWith('RSV-') || text.startsWith('ALC-') || status.includes('RESERVATION') ? ref : '')
  }
}

export const mapResourceRequest = row => ({
  resourceRequestId: row.resource_request_id,
  workOrder: row.work_order_num,
  type: row.resource_type,
  itemCode: row.item_code || '',
  item: row.item_description || row.item_code || '',
  quantity: numberValue(row.requested_quantity),
  requestedQuantity: numberValue(row.requested_quantity),
  availableQuantity: numberValue(row.available_quantity),
  source: row.store_code || '',
  site: row.site_code || '',
  department: row.department_name || '',
  sourceType: row.source_type || '',
  availabilityStatus: row.availability_status || '',
  requestStatus: row.request_status || '',
  transactionRef: row.transaction_ref || '',
  ...typedTransactionRefs(row),
  supplyChainStatus: row.supply_chain_status || ''
})

const mapPlannedLabor = row => ({
  plannedLaborId: row.planned_labor_id,
  workOrder: row.work_order_num,
  lineOrder: row.line_order,
  craft: row.craft_name || '',
  hours: numberValue(row.estimated_hours),
  crew: row.assigned_crew || '',
  site: row.site_code || '',
  department: row.department_name || ''
})

const mapWorkOrderTask = row => ({
  workOrderTaskId: row.work_order_task_id,
  workOrder: row.work_order_num,
  sequence: row.task_sequence,
  description: row.task_description || '',
  duration: numberValue(row.duration_minutes),
  site: row.site_code || '',
  department: row.department_name || ''
})

const latestMeter = (meterRows = []) => meterRows.reduce((latest, meter) => (
  !latest || String(meter.readingDate || '').localeCompare(String(latest.readingDate || '')) > 0 ? meter : latest
), null)

export const mapWorkOrder = (row, resourceRequests = [], plannedLabor = [], workOrderTasks = [], meterRows = []) => {
  const meter = latestMeter(meterRows)
  return {
  WORKORDER: row.work_order_num,
  'DESCRIPITION ': row.description,
  'LONG DESCRIPTION': row.long_description || '',
  'LOCATION ': row.location_code || '',
  ASSET: row.asset_num || '',
  STATUS: row.status,
  'WORK TYPE ': row.work_type,
  PRIORTY: row.priority || '',
  SITE: row.site_code,
  'DEPARTMENT ': row.department_name || '',
  'SUB DEPARTMENT  NAME': row.sub_department_code || '',
  'ASSIGNED DEPARTMENT': row.assigned_department_name || '',
  'WORK GROUP': row.work_group || '',
  SYSTEM: row.system_name || '',
  SUPERVISOR: row.supervisor || '',
  'LABOR CRAFT CODE': row.labor_craft_code || '',
  'TARGET START ': dateValue(row.target_start_at),
  'TARGET FINISH ': dateValue(row.target_finish_at),
  'ACTUAL START ': dateValue(row.actual_start_at),
  'ACTUAL FINISH ': dateValue(row.actual_finish_at),
  'COMPLETED AT': dateValue(row.completed_at),
  'CLOSED AT': dateValue(row.closed_at),
  'CLOSED BY': row.closed_by_name || row.closed_by_user_id || '',
  'REPORTED DATE ': dateValue(row.reported_at),
  'SOURCE SR': row.source_sr_num || '',
  'PM NUMBER': row.pm_num || '',
  'PM CYCLE': row.pm_cycle || '',
  'JOB PLAN': row.job_plan_num || '',
  'PM RULE': row.schedule_rule_name || '',
  'ESTIMATED DURATION': numberValue(row.estimated_duration_minutes),
  'SAFETY INSTRUCTIONS': row.safety_instructions || '',
  CHECKLIST: jsonArrayValue(row.checklist_json),
  'FAILURE CODE': row.failure_code || '',
  'PROBLEM CODE': row.problem_code || '',
  'CAUSE CODE': row.cause_code || '',
  'REMEDY CODE': row.remedy_code || '',
  'PTW REQUIRED': Boolean(row.ptw_required),
  'PTW FILES': [],
  'GENERAL FILES': [],
  'TECHNICIAN REMARKS': row.technician_remarks || '',
  'COMPLETION NOTES': row.completion_notes || '',
  'ACTUAL LABOR': row.actual_labor || '',
  'ACTUAL HOURS': row.actual_hours ?? '',
  'ACTUAL MATERIALS': jsonArrayValue(row.actual_materials_json),
  'ACTUAL TOOLS': jsonArrayValue(row.actual_tools_json),
  'HELD FROM': row.held_from_status || '',
  holdPeriods: jsonArrayValue(row.hold_periods_json),
  createdBy: row.created_by_user_id || '',
  'METER ID': meter?.meterId || '',
  'METER READING': meter?.reading ?? '',
  'METER READING UNIT': meter?.unit || '',
  'METER READING DATE': meter?.readingDate || '',
  'PLANNED LABOR': plannedLabor
    .slice()
    .sort((left, right) => Number(left.lineOrder || 0) - Number(right.lineOrder || 0)),
  'JOB PLAN TASKS': workOrderTasks
    .slice()
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0)),
  'PLANNED RESOURCES': resourceRequests
  }
}

const mapServiceRequest = row => ({
  sr: row.sr_num,
  description: row.description,
  longDescription: row.long_description || '',
  site: row.site_code,
  location: row.location_code || '',
  asset: row.asset_num || '',
  department: row.department_name || '',
  subDepartment: row.sub_department_code || '',
  assignedDepartment: row.assigned_department_name || '',
  reportedBy: row.reported_by || '',
  reportedDate: row.reported_at || '',
  priority: row.priority || '',
  requestType: row.request_type || '',
  failureCode: row.failure_code || '',
  problemCode: row.problem_code || '',
  status: row.status,
  convertedWorkOrder: row.converted_work_order_num || '',
  createdBy: row.created_by_user_id || ''
})

export const mapPurchaseRequest = row => ({
  purchaseRequest: row.pr_num,
  workOrder: row.work_order_num || '',
  resourceRequestId: row.resource_request_id,
  type: row.request_type,
  item: row.item_description || row.item_code,
  itemCode: row.item_code || '',
  quantity: numberValue(row.requested_quantity),
  plannedQuantity: numberValue(row.planned_quantity),
  availableQuantity: numberValue(row.available_quantity),
  source: row.store_code || '',
  site: row.site_code,
  department: row.department_name || '',
  status: row.status,
  purchaseOrder: row.po_num || '',
  createdAt: row.created_at || '',
  approvedAt: row.approved_at || '',
  closedAt: row.closed_at || '',
  cancelledAt: row.cancelled_at || '',
  createdBy: row.created_by_user_id || ''
})

export const mapPurchaseOrder = row => ({
  purchaseOrder: row.po_num,
  purchaseRequest: row.pr_num,
  workOrder: row.work_order_num || '',
  resourceRequestId: row.resource_request_id,
  type: row.request_type,
  item: row.item_description || row.item_code,
  itemCode: row.item_code || '',
  quantity: numberValue(row.ordered_quantity),
  source: row.store_code || '',
  site: row.site_code,
  department: row.department_name || '',
  status: row.status,
  createdAt: row.created_at || '',
  approvedAt: row.approved_at || '',
  receivedAt: row.received_at || '',
  closedAt: row.closed_at || '',
  cancelledAt: row.cancelled_at || '',
  createdBy: row.created_by_user_id || ''
})

export const mapReservation = row => ({
  reservation: row.reservation_num,
  workOrder: row.work_order_num,
  resourceRequestId: row.resource_request_id,
  purchaseRequest: row.pr_num || '',
  purchaseOrder: row.po_num || '',
  type: row.request_type || (String(row.reservation_num || '').startsWith('ALC-') ? 'Tool' : 'Material'),
  item: row.item_description || row.item_code,
  itemCode: row.item_code || '',
  quantity: numberValue(row.reserved_quantity),
  arrangedQuantity: numberValue(row.arranged_quantity),
  releasedQuantity: numberValue(row.released_quantity),
  deliveredQuantity: numberValue(row.delivered_quantity),
  source: row.store_code || '',
  site: row.site_code,
  department: row.department_name || '',
  status: row.status,
  createdAt: row.created_at || '',
  createdBy: row.created_by_user_id || ''
})

const mapPm = row => ({
  pmNumber: row.pm_num,
  description: row.description,
  asset: row.asset_num || '',
  route: row.route_code || '',
  location: row.location_code || '',
  site: row.site_code,
  jobPlan: row.job_plan_num,
  startDate: toLocalDateTimeInput(row.next_date) || '',
  leadTime: row.lead_time_days || 0,
  frequency: row.frequency || 1,
  freqUnit: row.frequency_unit || 'MONTHS',
  scheduleRule: row.schedule_rule_name || '',
  pmCounter: row.pm_counter || 0,
  workType: row.work_type || 'PM',
  woStatus: row.wo_status || '',
  storeLocation: row.store_code || '',
  supervisor: row.supervisor || '',
  lead: row.lead_person || '',
  personGroup: row.person_group || '',
  department: row.department_name || '',
  subDepartment: row.sub_department_code || '',
  pmStatus: row.pm_status || 'ACTIVE',
  lastGeneratedCycle: row.last_generated_cycle || '',
  createdBy: row.created_by_user_id || ''
})

const mapPmRule = row => ({
  name: row.rule_name,
  frequency: numberValue(row.frequency) || 1,
  freqUnit: row.frequency_unit || 'MONTHS',
  leadTimeDays: numberValue(row.lead_time_days) || 0,
  horizonDays: numberValue(row.horizon_days) || 30,
  triggerHour: numberValue(row.trigger_hour) || 0,
  woPrefix: row.wo_prefix || 'PMWO-',
  defaultWoStatus: row.default_wo_status || '',
  notes: row.notes || '',
  status: row.status || 'Active',
  createdDate: row.created_at || ''
})

const mapConnector = row => ({
  name: row.connector_name,
  type: row.connector_type || 'SMTP',
  host: row.host_endpoint || '',
  port: row.port ?? '',
  encryption: row.encryption || 'TLS',
  username: row.username_value || '',
  password: row.secret_value || '',
  sender: row.sender_value || '',
  notes: row.notes || '',
  status: row.status || 'Active',
  createdDate: row.created_at || ''
})

const mapNotificationRule = row => ({
  id: row.rule_id,
  event: row.event_name,
  channel: row.channel_name,
  recipients: row.recipients || '',
  notes: row.notes || '',
  status: row.status || 'Active',
  createdDate: row.created_at || ''
})

const mapIncident = row => ({
  incidentNumber: row.incident_num,
  description: row.description,
  site: row.site_code,
  location: row.location_code || '',
  asset: row.asset_num || '',
  department: row.department_name || '',
  severity: row.severity || 'Medium',
  status: row.status,
  reportedBy: row.reported_by || '',
  reportedDate: row.reported_at || '',
  createdBy: row.created_by_user_id || ''
})

const mapMeter = row => ({
  meterReadingId: row.meter_reading_id,
  meterId: row.meter_id || row.meter_reading_id,
  asset: row.asset_num || '',
  workOrder: row.work_order_num || '',
  site: row.site_code,
  department: row.department_name || '',
  reading: row.reading_value,
  unit: row.reading_unit || '',
  meterType: row.reading_unit === 'm3' ? 'Water' : row.reading_unit === 'kWh' ? 'Energy' : 'General',
  readingDate: row.reading_at || '',
  status: row.status || 'Active',
  createdBy: row.created_by_user_id || ''
})

const mapJobTask = row => ({
  JOBTASKID: row.job_plan_task_id,
  JPNUM: row.job_plan_num,
  'JOB TASK SEQUENCE': row.task_sequence,
  'JOB TASK DESCRIPTION': row.task_description || '',
  'TASK DURATION IN HOUR': row.duration_hours || 0,
  DESCRIPTION: row.task_description || '',
  status: 'ACTIVE'
})

const mapJobPlan = row => ({
  JPNUM: row.job_plan_num,
  DESCRIPTION: row.description,
  status: row.status || 'ACTIVE',
  estimatedDurationMinutes: numberValue(row.estimated_duration_minutes),
  requiredLabor: jsonArrayValue(row.required_labor_json),
  requiredMaterials: jsonArrayValue(row.required_materials_json),
  requiredTools: jsonArrayValue(row.required_tools_json),
  safetyInstructions: row.safety_instructions || '',
  checklist: jsonArrayValue(row.checklist_json)
})

const workOrderSortColumns = {
  WORKORDER: 'work_order_num',
  DESCRIPITION: 'description',
  LOCATION: 'location_code',
  ASSET: 'asset_num',
  STATUS: 'status',
  'WORK TYPE': 'work_type',
  PRIORTY: 'priority',
  SITE: 'site_code',
  DEPARTMENT: 'department_name',
  'ASSIGNED DEPARTMENT': 'assigned_department_name',
  'SUB DEPARTMENT NAME': 'sub_department_code',
  'TARGET START': 'target_start_at',
  'TARGET FINISH': 'target_finish_at',
  'ACTUAL START': 'actual_start_at',
  'ACTUAL FINISH': 'actual_finish_at',
  'REPORTED DATE': 'reported_at',
  'SOURCE SR': 'source_sr_num'
}

const pathWithQuery = (path, values = {}) => {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `${path}?${text}` : path
}

export async function loadWorkOrderPage({ page = 1, pageSize = 10, search = '', sort = {}, type = 'All', filters = {} } = {}) {
  const query = {
    page,
    limit: pageSize,
    includeTotal: true,
    q: search,
    sortBy: workOrderSortColumns[sort.key] || 'reported_at',
    sortDirection: sort.direction || 'desc',
    work_type: type && type !== 'All' ? type : '',
    site_code: filters.site || '',
    department: filters.department || '',
    status: filters.status || '',
    dateFrom: filters.from || '',
    dateTo: filters.to || ''
  }
  const [result, summary] = await Promise.all([
    api.getPage(pathWithQuery('/work-orders', query)),
    safeGet('/work-order-summary')
  ])
  return {
    rows: result.rows.map(row => mapWorkOrder(row)),
    page: Math.max(1, Number(page)),
    pageSize: result.pageSize || Number(pageSize),
    total: result.total,
    summary: Array.isArray(summary) ? { total: result.total, byType: {} } : summary
  }
}

export async function loadRelatedWorkOrders(filters = {}, { limit = 100 } = {}) {
  const result = await api.getPage(pathWithQuery('/work-orders', {
    ...filters,
    limit,
    includeTotal: true,
    sortBy: 'reported_at',
    sortDirection: 'desc'
  }))
  return { rows: result.rows.map(row => mapWorkOrder(row)), total: result.total }
}

const workOrderChildPath = (path, workOrderNumber) => pathWithQuery(path, { work_order_num: workOrderNumber, limit: 500 })

export async function loadWorkOrderDetail(workOrderNumber) {
  const id = encodeURIComponent(String(workOrderNumber))
  const row = await api.get(`/work-orders/${id}`)
  const relatedMeterQueries = [workOrderChildPath('/meter-readings', workOrderNumber)]
  if (row.asset_num) relatedMeterQueries.push(pathWithQuery('/meter-readings', { asset_num: row.asset_num, limit: 500 }))
  const [resources, plannedLabor, tasks, purchaseRequests, purchaseOrders, reservations, ...meterGroups] = await Promise.all([
    safeGet(workOrderChildPath('/work-order-resource-requests', workOrderNumber)),
    safeGet(workOrderChildPath('/work-order-planned-labor', workOrderNumber)),
    safeGet(workOrderChildPath('/work-order-tasks', workOrderNumber)),
    safeGet(workOrderChildPath('/purchase-requisitions', workOrderNumber)),
    safeGet(workOrderChildPath('/purchase-orders', workOrderNumber)),
    safeGet(workOrderChildPath('/reservations', workOrderNumber)),
    ...relatedMeterQueries.map(safeGet)
  ])
  const meters = [...new Map(meterGroups.flat().map(meter => [String(meter.meter_reading_id), meter])).values()].map(mapMeter)
  const mappedResources = resources.map(mapResourceRequest)
  const mappedLabor = plannedLabor.map(mapPlannedLabor)
  const mappedTasks = tasks.map(mapWorkOrderTask)
  return {
    order: mapWorkOrder(row, mappedResources, mappedLabor, mappedTasks, meters),
    context: {
      workOrderResources: mappedResources,
      plannedLabor: mappedLabor,
      tasks: mappedTasks,
      meters,
      purchaseRequests: purchaseRequests.map(mapPurchaseRequest),
      purchaseOrders: purchaseOrders.map(mapPurchaseOrder),
      reservations: reservations.map(mapReservation)
    }
  }
}

const resourceDefinitions = {
  overviewSnapshot: ['/overview-snapshot', value => ({
    ...value,
    preventiveMaintenance: {
      ...(value.preventiveMaintenance || {}),
      rows: (value.preventiveMaintenance?.rows || []).map(mapPm)
    },
    meters: {
      ...(value.meters || {}),
      rows: (value.meters?.rows || []).map(mapMeter),
      history: (value.meters?.history || []).map(mapMeter)
    }
  })],
  sites: ['/sites', rows => rows.map(mapSite)],
  departments: ['/departments', rows => rows.map(mapDepartment)],
  roles: ['/roles', rows => rows.map(mapRole)],
  users: ['/users', rows => rows],
  assets: ['/assets', rows => rows.map(mapAsset)],
  locations: ['/locations', rows => rows.map(mapLocation)],
  labor: ['/labor', rows => rows.map(mapLabor)],
  materials: ['/materials', rows => rows.map(mapMaterial)],
  storerooms: ['/storerooms', rows => rows.map(mapStoreroom)],
  inventoryStock: ['/inventory-stock', rows => rows.map(mapInventoryStock)],
  tools: ['/tools-equipment', rows => rows.map(mapTool)],
  failureCodes: ['/failure-library', rows => rows.map(mapFailureCode)],
  workOrderResources: ['/work-order-resource-requests', rows => rows.map(mapResourceRequest)],
  workOrderPlannedLabor: ['/work-order-planned-labor', rows => rows.map(mapPlannedLabor)],
  workOrderTasks: ['/work-order-tasks', rows => rows.map(mapWorkOrderTask)],
  serviceRequests: ['/service-requests', rows => rows.map(mapServiceRequest)],
  purchaseRequests: ['/purchase-requisitions', rows => rows.map(mapPurchaseRequest)],
  purchaseOrders: ['/purchase-orders', rows => rows.map(mapPurchaseOrder)],
  reservations: ['/reservations', rows => rows.map(mapReservation)],
  pmSchedules: ['/preventive-maintenance', rows => rows.map(mapPm)],
  pmRules: ['/pm-schedule-rules', rows => rows.map(mapPmRule)],
  connectors: ['/smtp-sms-connectors', rows => rows.map(mapConnector)],
  notificationRules: ['/notification-rules', rows => rows.map(mapNotificationRule)],
  jobPlans: ['/job-plans', rows => rows.map(mapJobPlan)],
  jobTasks: ['/job-plan-tasks', rows => rows.map(mapJobTask)],
  incidents: ['/incidents', rows => rows.map(mapIncident)],
  meters: ['/meter-readings', rows => rows.map(mapMeter)],
  workOrderWorkflow: ['/work-order-workflow', value => Array.isArray(value) ? DEFAULT_WORK_ORDER_WORKFLOW : mapWorkOrderWorkflow(value)],
  applicationWorkflows: ['/application-workflows', mapApplicationWorkflows]
}

export const WORKSPACE_RESOURCE_KEYS = ['overviewSnapshot', 'sites', 'departments', 'roles', 'users', 'assets', 'locations', 'labor', 'materials', 'storerooms', 'inventoryStock', 'tools', 'failureCodes', 'workOrders', 'workOrderResources', 'workOrderPlannedLabor', 'workOrderTasks', 'serviceRequests', 'purchaseRequests', 'purchaseOrders', 'reservations', 'pmSchedules', 'pmRules', 'connectors', 'notificationRules', 'jobPlans', 'jobTasks', 'incidents', 'meters', 'workOrderWorkflow', 'applicationWorkflows']

export async function loadWorkspace({ resources = [], workOrderQuery = {} } = {}) {
  const selected = [...new Set(resources)].filter(resource => resourceDefinitions[resource] || resource === 'workOrders')
  const entries = await Promise.all(selected.map(async resource => {
    if (resource === 'workOrders') return [resource, await loadWorkOrderPage(workOrderQuery)]
    const [path] = resourceDefinitions[resource]
    return [resource, await safeGet(path)]
  }))
  const raw = Object.fromEntries(entries)
  const output = {}
  selected.forEach(resource => {
    if (resource === 'workOrders') {
      output.workOrders = raw.workOrders.rows
      output.workOrderPage = raw.workOrders
      return
    }
    if (resource === 'users') return
    output[resource] = resourceDefinitions[resource][1](raw[resource])
  })
  if (selected.includes('users')) {
    const roles = output.roles || []
    output.users = raw.users.map(row => mapUser(row, roles))
  }
  return output
}

export const supplyChainApi = {
  createPurchaseRequest: async payload => {
    const result = await api.post('/supply-chain/purchase-requisitions', payload)
    return { ...result, purchaseRequisition: mapPurchaseRequest(result.purchaseRequisition) }
  },
  approveAndCreatePurchaseOrder: async purchaseRequestNumber => {
    const result = await api.post(`/supply-chain/purchase-requisitions/${encodeURIComponent(purchaseRequestNumber)}/approve-create-po`, {})
    return {
      ...result,
      purchaseRequisition: mapPurchaseRequest(result.purchaseRequisition),
      purchaseOrder: mapPurchaseOrder(result.purchaseOrder)
    }
  },
  transitionPurchaseRequest: async (purchaseRequestNumber, payload) => {
    const result = await api.post(`/supply-chain/purchase-requisitions/${encodeURIComponent(purchaseRequestNumber)}/transition`, payload)
    return mapPurchaseRequest(result.purchaseRequisition)
  },
  transitionPurchaseOrder: async (purchaseOrderNumber, payload) => {
    const result = await api.post(`/supply-chain/purchase-orders/${encodeURIComponent(purchaseOrderNumber)}/transition`, payload)
    return mapPurchaseOrder(result.purchaseOrder)
  },
  createReservation: async payload => {
    const result = await api.post('/supply-chain/reservations', payload)
    return mapReservation(result.reservation)
  },
  receivePurchaseOrder: async purchaseOrderNumber => {
    const result = await api.post(`/supply-chain/purchase-orders/${encodeURIComponent(purchaseOrderNumber)}/receive`, {})
    return {
      ...result,
      purchaseOrder: mapPurchaseOrder(result.purchaseOrder),
      purchaseRequisition: result.purchaseRequisition ? mapPurchaseRequest(result.purchaseRequisition) : null,
      reservation: result.reservation ? mapReservation(result.reservation) : null,
      inventoryStock: result.inventoryStock ? mapInventoryStock(result.inventoryStock) : null,
      tool: result.tool ? mapTool(result.tool) : null
    }
  },
  transitionReservation: async (reservationNumber, payload) => {
    const result = await api.post(`/supply-chain/reservations/${encodeURIComponent(reservationNumber)}/transition`, payload)
    return {
      ...mapReservation(result.reservation),
      inventoryStock: result.inventoryStock ? mapInventoryStock(result.inventoryStock) : null
    }
  },
  cancelWorkOrder: async (workOrderNumber, payload = {}) => {
    const result = await api.post(`/supply-chain/work-orders/${encodeURIComponent(workOrderNumber)}/cancel`, payload)
    return {
      ...result,
      workOrder: mapWorkOrder(result.workOrder),
      inventoryStocks: (result.inventoryStocks || []).map(mapInventoryStock)
    }
  }
}

export const serviceRequestApi = {
  convertToCorrectiveWorkOrder: async serviceRequestNumber => {
    const result = await api.post(`/service-requests/${encodeURIComponent(serviceRequestNumber)}/convert`, {})
    return {
      ...result,
      serviceRequest: mapServiceRequest(result.serviceRequest),
      workOrder: mapWorkOrder(result.workOrder)
    }
  }
}

const attachmentFromApi = row => ({
  attachmentId: row.attachment_id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  category: row.category || 'General',
  name: row.original_name || 'Attachment',
  type: row.mime_type || 'application/octet-stream',
  sizeBytes: Number(row.size_bytes || 0),
  size: Number(row.size_bytes || 0) >= 1048576
    ? `${(Number(row.size_bytes) / 1048576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(Number(row.size_bytes || 0) / 1024))} KB`,
  uploadedBy: row.uploaded_by_user_id || '',
  createdAt: row.created_at || ''
})

const attachmentFetch = async (path, options = {}) => {
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: options.accept || 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })
  if (!response.ok) {
    handleUnauthorized(response.status, path)
    const body = await response.json().catch(() => null)
    const error = new Error(body?.message || `Attachment request failed: ${response.status}`)
    error.status = response.status
    throw error
  }
  return response
}

export const attachmentApi = {
  list: async (entityType, entityId) => {
    const query = new URLSearchParams({ entity_type: entityType, entity_id: entityId })
    const response = await attachmentFetch(`/attachments?${query}`)
    return (await response.json()).map(attachmentFromApi)
  },
  upload: async (entityType, entityId, file, category = 'General') => {
    const response = await attachmentFetch(`/attachments/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?category=${encodeURIComponent(category)}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name || 'attachment')
      },
      body: file
    })
    return attachmentFromApi(await response.json())
  },
  remove: async attachmentId => {
    const response = await attachmentFetch(`/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' })
    return response.json()
  },
  download: async attachment => {
    const response = await attachmentFetch(`/attachments/${encodeURIComponent(attachment.attachmentId)}/download`, { accept: '*/*' })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = attachment.name || 'attachment'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }
}
