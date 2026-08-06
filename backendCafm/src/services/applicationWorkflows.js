import { getPool } from '../db/pool.js'

export const APPLICATION_WORKFLOW_DEFINITIONS = Object.freeze({
  JOB_REQUEST: Object.freeze({
    workflow_key: 'JOB_REQUEST',
    module_name: 'Job Requests',
    workflow_name: 'Job Request Lifecycle',
    initial_status: 'NEW',
    allow_manual_status_change: true,
    allow_backward_transition: false,
    allow_cancel: true,
    is_active: true,
    protected_statuses: ['NEW', 'WAPPR', 'INPRG', 'CLOSED'],
    requirement_ids: [
      'request_details', 'site_location', 'responsible_department', 'department_routing', 'asset',
      'failure_classification', 'linked_work_order', 'linked_work_order_closed'
    ],
    steps: [
      { step_id: 'STEP-NEW', status_code: 'NEW', step_name: 'New', sequence_no: 10, is_automatic: false, requirements: ['request_details', 'site_location', 'responsible_department'], badge_tone: 'purple' },
      { step_id: 'STEP-WAPPR', status_code: 'WAPPR', step_name: 'Department Review / Waiting Approval', sequence_no: 20, is_automatic: false, requirements: ['request_details', 'site_location', 'responsible_department'], badge_tone: 'orange' },
      { step_id: 'STEP-INPRG', status_code: 'INPRG', step_name: 'CM Work Order In Progress', sequence_no: 30, is_automatic: false, requirements: ['department_routing', 'asset', 'failure_classification', 'linked_work_order'], badge_tone: 'blue' },
      { step_id: 'STEP-CLOSED', status_code: 'CLOSED', step_name: 'Closed', sequence_no: 40, is_automatic: true, requirements: ['linked_work_order_closed'], badge_tone: 'green' }
    ]
  }),
  SUPPLY_CHAIN: Object.freeze({
    workflow_key: 'SUPPLY_CHAIN',
    module_name: 'Supply Chain',
    workflow_name: 'Supply Chain Fulfilment',
    initial_status: 'REQUESTED',
    allow_manual_status_change: false,
    allow_backward_transition: false,
    allow_cancel: true,
    is_active: true,
    protected_statuses: ['REQUESTED', 'PR_APPROVED', 'ORDERED', 'PO_APPROVED', 'RECEIVED', 'STAGED', 'DELIVERED'],
    requirement_ids: [
      'requested_quantity', 'source_store', 'requisition_approval',
      'linked_purchase_order', 'purchase_order_approval', 'goods_receipt',
      'stock_posting', 'reservation', 'delivery'
    ],
    steps: [
      { step_id: 'STEP-REQUESTED', status_code: 'REQUESTED', step_name: 'Requisition Requested', sequence_no: 10, is_automatic: false, requirements: ['requested_quantity', 'source_store'], badge_tone: 'orange' },
      { step_id: 'STEP-PR-APPROVED', status_code: 'PR_APPROVED', step_name: 'Requisition Approved', sequence_no: 20, is_automatic: false, requirements: ['requisition_approval'], badge_tone: 'green' },
      { step_id: 'STEP-ORDERED', status_code: 'ORDERED', step_name: 'Purchase Order Created', sequence_no: 30, is_automatic: true, requirements: ['linked_purchase_order'], badge_tone: 'purple' },
      { step_id: 'STEP-PO-APPROVED', status_code: 'PO_APPROVED', step_name: 'Purchase Order Approved', sequence_no: 40, is_automatic: false, requirements: ['purchase_order_approval'], badge_tone: 'blue' },
      { step_id: 'STEP-RECEIVED', status_code: 'RECEIVED', step_name: 'Goods Received', sequence_no: 50, is_automatic: false, requirements: ['goods_receipt', 'stock_posting'], badge_tone: 'blue' },
      { step_id: 'STEP-STAGED', status_code: 'STAGED', step_name: 'Store Staged', sequence_no: 60, is_automatic: true, requirements: ['reservation'], badge_tone: 'purple' },
      { step_id: 'STEP-DELIVERED', status_code: 'DELIVERED', step_name: 'Delivered to Work Order', sequence_no: 70, is_automatic: false, requirements: ['delivery'], badge_tone: 'green' }
    ]
  })
})

export const APPLICATION_WORKFLOW_KEYS = Object.freeze(Object.keys(APPLICATION_WORKFLOW_DEFINITIONS))
const validTones = new Set(['neutral', 'green', 'blue', 'purple', 'orange', 'red'])
const cacheTtlMs = 5000
let cachedWorkflows = null
let cacheExpiresAt = 0

const text = value => String(value ?? '').trim()
const statusCode = value => text(value).toUpperCase().replace(/[^A-Z0-9_]/g, '')
const serviceRequestPriorities = new Set(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'])
const serviceRequestTypes = new Set(['CORRECTIVE', 'SERVICE', 'INSPECTION'])
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

const normalizeStep = (row, index, definition) => ({
  step_id: text(row?.step_id) || `STEP-${index + 1}`,
  status_code: statusCode(row?.status_code),
  step_name: text(row?.step_name) || statusCode(row?.status_code),
  sequence_no: Number(row?.sequence_no) || (index + 1) * 10,
  is_automatic: Boolean(row?.is_automatic),
  requirements: [...new Set(listFromJson(row?.requirements ?? row?.requirements_json)
    .map(text)
    .filter(id => definition.requirement_ids.includes(id)))],
  badge_tone: validTones.has(text(row?.badge_tone)) ? text(row.badge_tone) : 'neutral'
})

const normalizeWorkflow = (key, row, stepRows = []) => {
  const definition = APPLICATION_WORKFLOW_DEFINITIONS[key]
  const sourceSteps = stepRows.length ? stepRows : definition.steps
  const steps = sourceSteps.map((step, index) => normalizeStep(step, index, definition))
    .sort((left, right) => left.sequence_no - right.sequence_no)
  const initialStatus = statusCode(row?.initial_status || definition.initial_status)
  return {
    ...definition,
    ...(row || {}),
    workflow_key: key,
    initial_status: steps.some(step => step.status_code === initialStatus) ? initialStatus : steps[0]?.status_code || definition.initial_status,
    allow_manual_status_change: Boolean(row?.allow_manual_status_change ?? definition.allow_manual_status_change),
    allow_backward_transition: Boolean(row?.allow_backward_transition ?? definition.allow_backward_transition),
    allow_cancel: Boolean(row?.allow_cancel ?? definition.allow_cancel),
    is_active: Boolean(row?.is_active ?? definition.is_active),
    protected_statuses: definition.protected_statuses,
    requirement_ids: definition.requirement_ids,
    steps
  }
}

const defaultWorkflows = () => APPLICATION_WORKFLOW_KEYS.map(key => normalizeWorkflow(key, null, []))

export const clearApplicationWorkflowCache = () => {
  cachedWorkflows = null
  cacheExpiresAt = 0
}

export const getApplicationWorkflows = async providedPool => {
  if (cachedWorkflows && cacheExpiresAt > Date.now()) return cachedWorkflows
  const pool = providedPool || await getPool()
  try {
    const result = await pool.request().query(`
      select * from dbo.application_workflows order by workflow_key;
      select * from dbo.application_workflow_steps order by workflow_key, sequence_no;
    `)
    const rows = result.recordsets[0] || []
    const stepRows = result.recordsets[1] || []
    cachedWorkflows = APPLICATION_WORKFLOW_KEYS.map(key => normalizeWorkflow(
      key,
      rows.find(row => row.workflow_key === key),
      stepRows.filter(step => step.workflow_key === key)
    ))
  } catch (error) {
    if (Number(error?.number) !== 208) throw error
    cachedWorkflows = defaultWorkflows()
  }
  cacheExpiresAt = Date.now() + cacheTtlMs
  return cachedWorkflows
}

export const getApplicationWorkflow = async (key, providedPool) => {
  const normalizedKey = statusCode(key)
  const workflows = await getApplicationWorkflows(providedPool)
  return workflows.find(workflow => workflow.workflow_key === normalizedKey) || null
}

export const applicationWorkflowStep = (workflow, value) => workflow?.steps?.find(step => step.status_code === statusCode(value)) || null

export const allowedApplicationTransitions = (currentValue, workflow) => {
  const current = statusCode(currentValue)
  const steps = workflow?.steps || []
  if (!workflow?.is_active) return steps.map(step => step.status_code)
  const index = steps.findIndex(step => step.status_code === current)
  if (index < 0) return [workflow.initial_status]
  if (index === steps.length - 1) return []
  const transitions = []
  const next = steps[index + 1]
  if (workflow.allow_manual_status_change || next?.is_automatic) transitions.push(next.status_code)
  if (workflow.allow_backward_transition && index > 0) transitions.push(steps[index - 1].status_code)
  if (workflow.allow_cancel) transitions.push('CAN')
  return [...new Set(transitions)]
}

const workflowError = (message, details = []) => {
  const error = new Error(details.length ? `${message}: ${details.join(', ')}` : message)
  error.name = 'WorkflowBlocked'
  error.status = 409
  error.details = details
  return error
}

const jobRequestRequirementGaps = async (pool, request, requirements) => {
  const missing = []
  const add = (condition, label) => {
    if (condition) missing.push(label)
  }
  for (const requirement of requirements) {
    if (requirement === 'request_details') {
      add(!text(request.description), 'Description')
      add(!text(request.priority), 'Priority')
      add(!text(request.request_type), 'Request type')
      add(!text(request.reported_by), 'Reported by')
      add(text(request.priority) && !serviceRequestPriorities.has(text(request.priority).toUpperCase()), 'Valid priority')
      add(text(request.request_type) && !serviceRequestTypes.has(text(request.request_type).toUpperCase()), 'Valid request type')
    }
    if (requirement === 'site_location') {
      add(!text(request.site_code), 'Site')
      add(!text(request.location_code), 'Location')
    }
    if (requirement === 'responsible_department') add(!text(request.department_name), 'Department')
    if (requirement === 'department_routing') {
      add(!text(request.department_name), 'Department')
      add(!text(request.assigned_department_name), 'Assigned department')
    }
    if (requirement === 'asset') add(!text(request.asset_num), 'Asset')
    if (requirement === 'failure_classification') {
      add(!text(request.failure_code), 'Failure code')
      add(!text(request.problem_code), 'Problem code')
    }
    if (requirement === 'linked_work_order') add(!text(request.converted_work_order_num), 'Linked work order')
    if (requirement === 'linked_work_order_closed') {
      if (!text(request.converted_work_order_num)) {
        missing.push('Linked work order')
      } else {
        const linked = await pool.request()
          .input('workOrderNumber', request.converted_work_order_num)
          .query('select top 1 status from dbo.work_orders where work_order_num = @workOrderNumber;')
        add(String(linked.recordset[0]?.status || '').toUpperCase() !== 'CLOSE', 'Linked work order must be closed')
      }
    }
  }
  return [...new Set(missing)]
}

export const prepareServiceRequestCreate = async ({ pool, payload }) => {
  const workflow = await getApplicationWorkflow('JOB_REQUEST', pool)
  if (!workflow) return payload
  const effectiveStatus = workflow.initial_status
  const prepared = {
    ...payload,
    assigned_department_name: text(payload.assigned_department_name) || text(payload.department_name),
    converted_work_order_num: null,
    reported_at: new Date(),
    status: effectiveStatus
  }
  const initialStep = applicationWorkflowStep(workflow, effectiveStatus)
  const missing = await jobRequestRequirementGaps(pool, prepared, initialStep?.requirements || [])
  if (missing.length) {
    const error = workflowError('Cannot create Job Request', missing)
    error.status = 400
    throw error
  }
  return prepared
}

export const validateServiceRequestUpdate = async ({ pool, payload, current }) => {
  if (!Object.hasOwn(payload, 'status')) return payload
  const workflow = await getApplicationWorkflow('JOB_REQUEST', pool)
  if (!workflow?.is_active) return payload
  const previous = statusCode(current.status)
  const next = statusCode(payload.status)
  if (!next || next === previous) return payload
  const semanticConversion = applicationWorkflowStep(workflow, next)?.requirements.includes('linked_work_order')
    && text(payload.converted_work_order_num || current.converted_work_order_num)
  if (!semanticConversion && !allowedApplicationTransitions(previous, workflow).includes(next)) {
    throw workflowError(`Job Request transition ${previous} to ${next} is not allowed`)
  }
  if (next === 'CAN') return { ...payload, status: next }
  const step = applicationWorkflowStep(workflow, next)
  const missing = await jobRequestRequirementGaps(pool, { ...current, ...payload, status: next }, step?.requirements || [])
  if (missing.length) throw workflowError(`Cannot move Job Request to ${next}`, missing)
  return { ...payload, status: next }
}
