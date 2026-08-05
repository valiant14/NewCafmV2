import { getPool } from '../db/pool.js'

export const WORK_ORDER_WORKFLOW_DEFAULTS = Object.freeze({
  workflow_key: 'DEFAULT',
  workflow_name: 'Standard Work Order Lifecycle',
  initial_status: 'WAPPR',
  ptw_required_default: true,
  allow_ptw_override: true,
  allow_manual_status_change: true,
  allow_backward_transition: true,
  allow_hold: true,
  allow_cancel_before_start: true,
  auto_approve: true,
  auto_schedule: true,
  auto_start: true,
  auto_complete: true,
  auto_close: false,
  require_overview_for_approval: true,
  require_planned_labor_for_schedule: true,
  require_materials_for_cm: true,
  require_tools_for_cm: true,
  require_ptw_for_start: true,
  require_store_issue_for_start: true,
  require_failure_for_complete: true,
  require_actual_labor_for_complete: true,
  require_execution_notes_for_complete: true,
  require_actual_resources_for_complete: true,
  require_returns_for_close: true
})

export const WORK_ORDER_WORKFLOW_COLUMNS = Object.keys(WORK_ORDER_WORKFLOW_DEFAULTS)
const booleanColumns = WORK_ORDER_WORKFLOW_COLUMNS.filter(column => typeof WORK_ORDER_WORKFLOW_DEFAULTS[column] === 'boolean')
const statusChain = ['WAPPR', 'APPR', 'WSCH', 'SCHED', 'INPRG', 'COMP', 'CLOSE']
const holdStatuses = ['HOLD', 'ON_HOLD_MATERIAL']
const terminalStatuses = ['CLOSE', 'CAN']
const cacheTtlMs = 5000
let cachedWorkflow = null
let cacheExpiresAt = 0

const text = value => String(value ?? '').trim()
const statusCode = value => {
  const upper = text(value).toUpperCase()
  return ({ COMPLETED: 'COMP', CLOSED: 'CLOSE', CANCELLED: 'CAN', CANCELED: 'CAN', 'ON HOLD': 'HOLD' })[upper] || upper
}
const listFromJson = value => {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
const positive = value => Number(value || 0) > 0
const namedRows = rows => rows.filter(row => text(row.item_description) && positive(row.requested_quantity))
const automaticNextStatus = (current, workflow) => ({
  WAPPR: workflow.auto_approve ? 'APPR' : '',
  APPR: workflow.auto_schedule ? 'WSCH' : '',
  WSCH: workflow.auto_schedule ? 'SCHED' : '',
  SCHED: workflow.auto_start ? 'INPRG' : '',
  INPRG: workflow.auto_complete ? 'COMP' : '',
  COMP: workflow.auto_close ? 'CLOSE' : ''
})[current] || ''

const normalizeWorkflow = row => {
  const normalized = { ...WORK_ORDER_WORKFLOW_DEFAULTS, ...(row || {}) }
  for (const column of booleanColumns) normalized[column] = Boolean(normalized[column])
  normalized.initial_status = ['WAPPR', 'APPR', 'WSCH', 'SCHED'].includes(statusCode(normalized.initial_status))
    ? statusCode(normalized.initial_status)
    : WORK_ORDER_WORKFLOW_DEFAULTS.initial_status
  return normalized
}

export const clearWorkOrderWorkflowCache = () => {
  cachedWorkflow = null
  cacheExpiresAt = 0
}

export const getWorkOrderWorkflow = async providedPool => {
  if (cachedWorkflow && cacheExpiresAt > Date.now()) return cachedWorkflow
  const pool = providedPool || await getPool()
  const result = await pool.request().query(`
    select top 1 *
    from dbo.work_order_workflow_settings
    where workflow_key = 'DEFAULT'
  `)
  cachedWorkflow = normalizeWorkflow(result.recordset[0])
  cacheExpiresAt = Date.now() + cacheTtlMs
  return cachedWorkflow
}

export const allowedWorkOrderTransitions = (currentValue, workflow, heldFromValue = '') => {
  const current = statusCode(currentValue)
  const heldFrom = statusCode(heldFromValue)
  if (terminalStatuses.includes(current)) return []
  if (holdStatuses.includes(current)) {
    const resume = statusChain.includes(heldFrom) ? heldFrom : ''
    return [...new Set([...(resume ? [resume] : statusChain.slice(0, 5)), ...(workflow.allow_cancel_before_start ? ['CAN'] : [])])]
  }
  const index = statusChain.indexOf(current)
  if (index === -1) return [workflow.initial_status]
  const next = []
  if (workflow.allow_backward_transition && index > 0) next.push(statusChain[index - 1])
  if (index < statusChain.length - 1) next.push(statusChain[index + 1])
  if (workflow.allow_hold && current !== 'COMP') next.push(...holdStatuses)
  if (workflow.allow_cancel_before_start && index <= statusChain.indexOf('SCHED')) next.push('CAN')
  return [...new Set(next)]
}

const workflowError = (message, details = []) => {
  const error = new Error(details.length ? `${message}: ${details.join(', ')}` : message)
  error.name = 'WorkflowBlocked'
  error.status = 409
  error.details = details
  return error
}

const readWorkOrderContext = async (pool, workOrderNumber) => {
  const result = await pool.request()
    .input('workOrderNumber', workOrderNumber)
    .query(`
      select resource_type, item_description, requested_quantity, request_status, reservation_num
      from dbo.work_order_resource_requests
      where work_order_num = @workOrderNumber;

      select craft_name, estimated_hours, assigned_crew
      from dbo.work_order_planned_labor
      where work_order_num = @workOrderNumber;
    `)
  return {
    resources: result.recordsets[0] || [],
    labor: result.recordsets[1] || []
  }
}

const missingOverview = order => [
  !text(order.description) && 'Description',
  !text(order.site_code) && 'Site',
  !text(order.location_code) && 'Location',
  !text(order.department_name) && 'Department',
  !text(order.assigned_department_name) && 'Assigned department',
  !order.target_start_at && 'Target start',
  !order.target_finish_at && 'Target finish',
  order.target_start_at && order.target_finish_at && new Date(order.target_finish_at) < new Date(order.target_start_at) && 'Target finish before target start'
].filter(Boolean)

const missingPlanning = (order, context, workflow) => {
  const missing = []
  const isCorrective = statusCode(order.work_type || 'CM') === 'CM'
  if (workflow.require_planned_labor_for_schedule && !context.labor.some(row => text(row.craft_name) && text(row.assigned_crew) && positive(row.estimated_hours))) {
    missing.push('Planned labor, hours, and crew')
  }
  if (isCorrective && workflow.require_materials_for_cm && !context.resources.some(row => statusCode(row.resource_type) === 'MATERIAL' && text(row.item_description) && positive(row.requested_quantity))) {
    missing.push('Planned material')
  }
  if (isCorrective && workflow.require_tools_for_cm && !context.resources.some(row => ['TOOL', 'EQUIPMENT'].includes(statusCode(row.resource_type)) && text(row.item_description) && positive(row.requested_quantity))) {
    missing.push('Planned tool or equipment')
  }
  return missing
}

const missingStart = (order, context, workflow) => {
  const missing = []
  if (workflow.require_ptw_for_start && (!workflow.allow_ptw_override || order.ptw_required) && !listFromJson(order.ptw_files_json).length) missing.push('Approved PTW attachment')
  if (workflow.require_store_issue_for_start) {
    for (const resource of namedRows(context.resources)) {
      if (!text(resource.reservation_num) || statusCode(resource.request_status) !== 'COMPLETE') {
        missing.push(`Store issue for ${text(resource.item_description)}`)
      }
    }
  }
  return missing
}

const resourceIsReturned = row => {
  const quantity = Number(row.quantity || row.issuedQuantity || row.taken || 0)
  const actual = Number(row.actualQuantity || 0)
  if (statusCode(row.type) === 'MATERIAL') return Math.max(0, quantity - actual) <= Number(row.returnedQuantity || 0) || Boolean(row.returned)
  return quantity <= 0 || Number(row.returnedQuantity || 0) >= quantity || Boolean(row.returned)
}

const missingCompletion = (order, workflow, includeReturns = false) => {
  const missing = []
  const isCorrective = statusCode(order.work_type || 'CM') === 'CM'
  const actualMaterials = listFromJson(order.actual_materials_json)
  const actualTools = listFromJson(order.actual_tools_json)
  if (isCorrective && workflow.require_failure_for_complete) {
    if (!text(order.failure_code)) missing.push('Failure code')
    if (!text(order.problem_code)) missing.push('Problem code')
  }
  if (workflow.require_actual_labor_for_complete) {
    if (!text(order.actual_labor)) missing.push('Actual labor')
    if (!positive(order.actual_hours)) missing.push('Actual labor hours')
  }
  if (workflow.require_execution_notes_for_complete) {
    if (!text(order.technician_remarks)) missing.push('Technician remarks')
    if (!text(order.completion_notes)) missing.push('Completion notes')
  }
  if (isCorrective && workflow.require_actual_resources_for_complete) {
    if (!actualMaterials.some(row => text(row.item) && positive(row.actualQuantity))) missing.push('Actual material usage')
    if (!actualTools.some(row => text(row.item))) missing.push('Actual tools used')
  }
  if (includeReturns && workflow.require_returns_for_close) {
    const outstanding = [...actualMaterials, ...actualTools].filter(row => !resourceIsReturned(row))
    if (outstanding.length) missing.push('Material and tool returns')
  }
  return missing
}

const missingForStatus = async (pool, workOrderNumber, order, target, workflow) => {
  const context = await readWorkOrderContext(pool, workOrderNumber)
  const overview = workflow.require_overview_for_approval ? missingOverview(order) : []
  const planning = missingPlanning(order, context, workflow)
  const start = missingStart(order, context, workflow)
  if (target === 'APPR') return overview
  if (target === 'WSCH' || target === 'SCHED') return [...overview, ...planning]
  if (target === 'INPRG') return [...overview, ...planning, ...start]
  if (target === 'COMP') return [...start, ...missingCompletion(order, workflow)]
  if (target === 'CLOSE') return [...start, ...missingCompletion(order, workflow, true)]
  return []
}

export const prepareWorkOrderCreate = async ({ pool, payload }) => {
  const workflow = await getWorkOrderWorkflow(pool)
  return {
    ...payload,
    status: statusCode(payload.status) || workflow.initial_status,
    ptw_required: payload.ptw_required === undefined ? workflow.ptw_required_default : payload.ptw_required,
    held_from_status: payload.held_from_status || null,
    hold_periods_json: payload.hold_periods_json || null
  }
}

export const validateWorkOrderUpdate = async ({ pool, payload, current, id }) => {
  const workflow = await getWorkOrderWorkflow(pool)
  const previous = statusCode(current.status)
  let next = statusCode(payload.status ?? current.status)
  if (!next || next === previous) {
    next = automaticNextStatus(previous, workflow)
    if (!next) return payload
    const automaticOrder = { ...current, ...payload, status: next }
    const automaticMissing = await missingForStatus(pool, id, automaticOrder, next, workflow)
    if (automaticMissing.length) return payload
    const timestampPatch = next === 'INPRG' && !automaticOrder.actual_start_at
      ? { actual_start_at: new Date() }
      : ['COMP', 'CLOSE'].includes(next) && !automaticOrder.actual_finish_at
        ? { actual_finish_at: new Date() }
        : {}
    return { ...payload, ...timestampPatch, status: next }
  }
  const allowed = allowedWorkOrderTransitions(previous, workflow, current.held_from_status)
  if (!allowed.includes(next)) throw workflowError(`Transition ${previous} to ${next} is not allowed`)
  const merged = { ...current, ...payload, status: next }
  const missing = await missingForStatus(pool, id, merged, next, workflow)
  if (missing.length) throw workflowError(`Cannot move work order to ${next}`, [...new Set(missing)])
  return payload
}
