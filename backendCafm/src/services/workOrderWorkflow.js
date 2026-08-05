import { getPool } from '../db/pool.js'

export const WORK_ORDER_REQUIREMENT_IDS = Object.freeze([
  'overview',
  'planned_labor',
  'planned_materials_cm',
  'planned_tools_cm',
  'ptw',
  'store_issue',
  'failure',
  'actual_labor',
  'execution_notes',
  'actual_resources',
  'returns'
])

export const DEFAULT_WORK_ORDER_WORKFLOW_STEPS = Object.freeze([
  { step_id: 'STEP-WAPPR', status_code: 'WAPPR', step_name: 'Waiting Approval', sequence_no: 10, is_automatic: false, requirements: [], badge_tone: 'orange' },
  { step_id: 'STEP-APPR', status_code: 'APPR', step_name: 'Approved', sequence_no: 20, is_automatic: true, requirements: ['overview'], badge_tone: 'green' },
  { step_id: 'STEP-WSCH', status_code: 'WSCH', step_name: 'Waiting Schedule', sequence_no: 30, is_automatic: true, requirements: ['overview', 'planned_labor', 'planned_materials_cm', 'planned_tools_cm'], badge_tone: 'purple' },
  { step_id: 'STEP-SCHED', status_code: 'SCHED', step_name: 'Scheduled', sequence_no: 40, is_automatic: true, requirements: ['overview', 'planned_labor', 'planned_materials_cm', 'planned_tools_cm'], badge_tone: 'blue' },
  { step_id: 'STEP-INPRG', status_code: 'INPRG', step_name: 'In Progress', sequence_no: 50, is_automatic: true, requirements: ['overview', 'planned_labor', 'planned_materials_cm', 'planned_tools_cm', 'ptw', 'store_issue'], badge_tone: 'blue' },
  { step_id: 'STEP-COMP', status_code: 'COMP', step_name: 'Completed', sequence_no: 60, is_automatic: true, requirements: ['store_issue', 'failure', 'actual_labor', 'execution_notes', 'actual_resources'], badge_tone: 'green' },
  { step_id: 'STEP-CLOSE', status_code: 'CLOSE', step_name: 'Closed', sequence_no: 70, is_automatic: false, requirements: ['store_issue', 'failure', 'actual_labor', 'execution_notes', 'actual_resources', 'returns'], badge_tone: 'green' }
])

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
const holdStatuses = ['HOLD', 'ON_HOLD_MATERIAL']
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

const normalizeStep = (row, index) => ({
  step_id: text(row?.step_id) || `STEP-${index + 1}`,
  status_code: statusCode(row?.status_code),
  step_name: text(row?.step_name) || statusCode(row?.status_code),
  sequence_no: Number(row?.sequence_no) || (index + 1) * 10,
  is_automatic: Boolean(row?.is_automatic),
  requirements: [...new Set(listFromJson(row?.requirements ?? row?.requirements_json).map(text).filter(id => WORK_ORDER_REQUIREMENT_IDS.includes(id)))],
  badge_tone: ['neutral', 'green', 'blue', 'purple', 'orange', 'red'].includes(text(row?.badge_tone)) ? text(row.badge_tone) : 'neutral'
})

export const workflowSteps = workflow => {
  const source = Array.isArray(workflow?.steps) && workflow.steps.length
    ? workflow.steps
    : DEFAULT_WORK_ORDER_WORKFLOW_STEPS
  return source.map(normalizeStep).sort((a, b) => a.sequence_no - b.sequence_no)
}

const stepForStatus = (workflow, value) => workflowSteps(workflow).find(step => step.status_code === statusCode(value))
const nextStepForStatus = (workflow, value) => {
  const steps = workflowSteps(workflow)
  const index = steps.findIndex(step => step.status_code === statusCode(value))
  return index >= 0 ? steps[index + 1] || null : null
}

const withLegacyFlags = workflow => {
  const steps = workflowSteps(workflow)
  const target = code => steps.find(step => step.status_code === code)
  const hasRequirement = id => steps.some(step => step.requirements.includes(id))
  return {
    ...workflow,
    steps,
    initial_status: steps.some(step => step.status_code === statusCode(workflow.initial_status))
      ? statusCode(workflow.initial_status)
      : steps[0]?.status_code || WORK_ORDER_WORKFLOW_DEFAULTS.initial_status,
    auto_approve: Boolean(target('APPR')?.is_automatic),
    auto_schedule: Boolean(target('WSCH')?.is_automatic || target('SCHED')?.is_automatic),
    auto_start: Boolean(target('INPRG')?.is_automatic),
    auto_complete: Boolean(target('COMP')?.is_automatic),
    auto_close: Boolean(target('CLOSE')?.is_automatic),
    require_overview_for_approval: hasRequirement('overview'),
    require_planned_labor_for_schedule: hasRequirement('planned_labor'),
    require_materials_for_cm: hasRequirement('planned_materials_cm'),
    require_tools_for_cm: hasRequirement('planned_tools_cm'),
    require_ptw_for_start: hasRequirement('ptw'),
    require_store_issue_for_start: hasRequirement('store_issue'),
    require_failure_for_complete: hasRequirement('failure'),
    require_actual_labor_for_complete: hasRequirement('actual_labor'),
    require_execution_notes_for_complete: hasRequirement('execution_notes'),
    require_actual_resources_for_complete: hasRequirement('actual_resources'),
    require_returns_for_close: hasRequirement('returns')
  }
}

const normalizeWorkflow = (row, stepRows = []) => {
  const normalized = { ...WORK_ORDER_WORKFLOW_DEFAULTS, ...(row || {}), steps: stepRows.length ? stepRows : row?.steps }
  for (const column of booleanColumns) normalized[column] = Boolean(normalized[column])
  return withLegacyFlags(normalized)
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
    where workflow_key = 'DEFAULT';

    if object_id('dbo.work_order_workflow_steps', 'U') is not null
      select *
      from dbo.work_order_workflow_steps
      where workflow_key = 'DEFAULT'
      order by sequence_no;
  `)
  cachedWorkflow = normalizeWorkflow(result.recordsets[0]?.[0], result.recordsets[1] || [])
  cacheExpiresAt = Date.now() + cacheTtlMs
  return cachedWorkflow
}

export const allowedWorkOrderTransitions = (currentValue, workflow, heldFromValue = '') => {
  const current = statusCode(currentValue)
  const heldFrom = statusCode(heldFromValue)
  const steps = workflowSteps(workflow)
  const terminal = steps.at(-1)?.status_code || 'CLOSE'
  if ([terminal, 'CLOSE', 'CAN'].includes(current)) return []
  if (holdStatuses.includes(current)) {
    const resume = steps.some(step => step.status_code === heldFrom) ? heldFrom : ''
    return [...new Set([...(resume ? [resume] : [workflow.initial_status]), ...(workflow.allow_cancel_before_start ? ['CAN'] : [])])]
  }
  const index = steps.findIndex(step => step.status_code === current)
  if (index === -1) return [workflow.initial_status]
  const next = []
  if (workflow.allow_backward_transition && index > 0) next.push(steps[index - 1].status_code)
  if (index < steps.length - 1) next.push(steps[index + 1].status_code)
  const completionIndex = steps.findIndex(step => step.status_code === 'COMP')
  if (workflow.allow_hold && (completionIndex < 0 || index < completionIndex)) next.push(...holdStatuses)
  const startIndex = steps.findIndex(step => step.status_code === 'INPRG')
  if (workflow.allow_cancel_before_start && (startIndex < 0 || index < startIndex)) next.push('CAN')
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

const resourceIsReturned = row => {
  const quantity = Number(row.quantity || row.issuedQuantity || row.taken || 0)
  const actual = Number(row.actualQuantity || 0)
  if (statusCode(row.type) === 'MATERIAL') return Math.max(0, quantity - actual) <= Number(row.returnedQuantity || 0) || Boolean(row.returned)
  return quantity <= 0 || Number(row.returnedQuantity || 0) >= quantity || Boolean(row.returned)
}

const missingRequirements = (order, context, workflow, requirements) => {
  const missing = []
  const isCorrective = statusCode(order.work_type || 'CM') === 'CM'
  const actualMaterials = listFromJson(order.actual_materials_json)
  const actualTools = listFromJson(order.actual_tools_json)
  const add = values => missing.push(...values.filter(Boolean))

  for (const requirement of requirements) {
    if (requirement === 'overview') add(missingOverview(order))
    if (requirement === 'planned_labor' && !context.labor.some(row => text(row.craft_name) && text(row.assigned_crew) && positive(row.estimated_hours))) add(['Planned labor, hours, and crew'])
    if (requirement === 'planned_materials_cm' && isCorrective && !context.resources.some(row => statusCode(row.resource_type) === 'MATERIAL' && text(row.item_description) && positive(row.requested_quantity))) add(['Planned material'])
    if (requirement === 'planned_tools_cm' && isCorrective && !context.resources.some(row => ['TOOL', 'EQUIPMENT'].includes(statusCode(row.resource_type)) && text(row.item_description) && positive(row.requested_quantity))) add(['Planned tool or equipment'])
    if (requirement === 'ptw' && (!workflow.allow_ptw_override || order.ptw_required) && !listFromJson(order.ptw_files_json).length) add(['Approved PTW attachment'])
    if (requirement === 'store_issue') {
      for (const resource of namedRows(context.resources)) {
        if (!text(resource.reservation_num) || statusCode(resource.request_status) !== 'COMPLETE') add([`Store issue for ${text(resource.item_description)}`])
      }
    }
    if (requirement === 'failure' && isCorrective) {
      if (!text(order.failure_code)) add(['Failure code'])
      if (!text(order.problem_code)) add(['Problem code'])
    }
    if (requirement === 'actual_labor') {
      if (!text(order.actual_labor)) add(['Actual labor'])
      if (!positive(order.actual_hours)) add(['Actual labor hours'])
    }
    if (requirement === 'execution_notes') {
      if (!text(order.technician_remarks)) add(['Technician remarks'])
      if (!text(order.completion_notes)) add(['Completion notes'])
    }
    if (requirement === 'actual_resources' && isCorrective) {
      if (!actualMaterials.some(row => text(row.item) && positive(row.actualQuantity))) add(['Actual material usage'])
      if (!actualTools.some(row => text(row.item))) add(['Actual tools used'])
    }
    if (requirement === 'returns') {
      if ([...actualMaterials, ...actualTools].some(row => !resourceIsReturned(row))) add(['Material and tool returns'])
    }
  }
  return [...new Set(missing)]
}

const missingForStatus = async (pool, workOrderNumber, order, target, workflow) => {
  const step = stepForStatus(workflow, target)
  if (!step?.requirements.length) return []
  const context = await readWorkOrderContext(pool, workOrderNumber)
  return missingRequirements(order, context, workflow, step.requirements)
}

export const prepareWorkOrderCreate = async ({ pool, payload }) => {
  const workflow = await getWorkOrderWorkflow(pool)
  const requestedStatus = statusCode(payload.status)
  if (requestedStatus && !stepForStatus(workflow, requestedStatus)) {
    const error = new Error(`Status ${requestedStatus} is not part of the active work-order workflow.`)
    error.status = 400
    throw error
  }
  return {
    ...payload,
    status: requestedStatus || workflow.initial_status,
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
    const targetStep = nextStepForStatus(workflow, previous)
    next = targetStep?.is_automatic ? targetStep.status_code : ''
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
  if (missing.length) throw workflowError(`Cannot move work order to ${next}`, missing)
  return payload
}
