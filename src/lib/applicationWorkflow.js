const tones = new Set(['neutral', 'green', 'blue', 'purple', 'orange', 'red'])
const cleanCode = value => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 40)
const unique = values => [...new Set(values)]

export const APPLICATION_WORKFLOW_DEFINITIONS = {
  JOB_REQUEST: {
    key: 'JOB_REQUEST',
    label: 'Job Requests',
    description: 'Control request intake, department review, CM conversion, and closure with the linked work order.',
    protectedStatuses: ['NEW', 'WAPPR', 'INPRG', 'CLOSED'],
    presets: [
      { code: 'NEW', label: 'New', tone: 'purple' },
      { code: 'WAPPR', label: 'Department Review / Waiting Approval', tone: 'orange' },
      { code: 'INPRG', label: 'CM Work Order In Progress', tone: 'blue' },
      { code: 'CLOSED', label: 'Closed', tone: 'green' }
    ],
    requirements: [
      { id: 'request_details', label: 'Request details', section: 'Request', description: 'Description, priority, request type, and reporter are complete.' },
      { id: 'site_location', label: 'Site and location', section: 'Request', description: 'A valid site and service location are selected.' },
      { id: 'responsible_department', label: 'Responsible department', section: 'Request', description: 'The department responsible for reviewing the request is selected.' },
      { id: 'department_routing', label: 'Department routing', section: 'Review', description: 'Department and assigned department routing are complete; sub-department is optional.' },
      { id: 'asset', label: 'Related asset', section: 'Review', description: 'A maintainable asset is linked to the request.' },
      { id: 'failure_classification', label: 'Failure classification', section: 'Review', description: 'The reviewer selected matching failure and problem codes.' },
      { id: 'linked_work_order', label: 'Linked work order', section: 'Conversion', description: 'A corrective work order has been created and linked.' },
      { id: 'linked_work_order_closed', label: 'Work order closed', section: 'Resolution', description: 'The linked work order reached its closed stage.' }
    ]
  },
  SUPPLY_CHAIN: {
    key: 'SUPPLY_CHAIN',
    label: 'Supply Chain',
    description: 'Control the connected requisition, purchasing, receipt, staging, and delivery path.',
    protectedStatuses: ['REQUESTED', 'PR_APPROVED', 'ORDERED', 'PO_APPROVED', 'RECEIVED', 'STAGED', 'DELIVERED'],
    presets: [
      { code: 'REQUESTED', label: 'Requisition Requested', tone: 'orange' },
      { code: 'PR_APPROVED', label: 'Requisition Approved', tone: 'green' },
      { code: 'ORDERED', label: 'Purchase Order Created', tone: 'purple' },
      { code: 'PO_APPROVED', label: 'Purchase Order Approved', tone: 'blue' },
      { code: 'RECEIVED', label: 'Goods Received', tone: 'blue' },
      { code: 'STAGED', label: 'Store Staged', tone: 'purple' },
      { code: 'DELIVERED', label: 'Delivered to Work Order', tone: 'green' }
    ],
    requirements: [
      { id: 'requested_quantity', label: 'Requested quantity', section: 'Requisition', description: 'A positive requested quantity is recorded.' },
      { id: 'source_store', label: 'Source warehouse', section: 'Requisition', description: 'A valid source warehouse is selected.' },
      { id: 'requisition_approval', label: 'Requisition approval', section: 'Procurement', description: 'An authorized user approves the requisition.' },
      { id: 'linked_purchase_order', label: 'Purchase order', section: 'Procurement', description: 'The approval creates and links a purchase order.' },
      { id: 'purchase_order_approval', label: 'Purchase order approval', section: 'Procurement', description: 'The purchase order is approved before receipt.' },
      { id: 'goods_receipt', label: 'Goods receipt', section: 'Receipt', description: 'The ordered quantity has been received.' },
      { id: 'stock_posting', label: 'Stock posting', section: 'Receipt', description: 'Received stock is posted to the selected warehouse.' },
      { id: 'reservation', label: 'Reservation or allocation', section: 'Store', description: 'The received item is reserved or allocated to the work order.' },
      { id: 'delivery', label: 'Store delivery', section: 'Store', description: 'The full arranged quantity is released and delivered.' }
    ]
  }
}

const defaults = {
  JOB_REQUEST: {
    workflowKey: 'JOB_REQUEST',
    moduleName: 'Job Requests',
    workflowName: 'Job Request Lifecycle',
    initialStatus: 'NEW',
    allowManualStatusChange: true,
    allowBackwardTransition: false,
    allowCancel: true,
    isActive: true,
    steps: [
      { stepId: 'STEP-NEW', statusCode: 'NEW', stepName: 'New', sequence: 10, isAutomatic: false, requirements: ['request_details', 'site_location', 'responsible_department'], badgeTone: 'purple' },
      { stepId: 'STEP-WAPPR', statusCode: 'WAPPR', stepName: 'Department Review / Waiting Approval', sequence: 20, isAutomatic: false, requirements: ['request_details', 'site_location', 'responsible_department'], badgeTone: 'orange' },
      { stepId: 'STEP-INPRG', statusCode: 'INPRG', stepName: 'CM Work Order In Progress', sequence: 30, isAutomatic: false, requirements: ['department_routing', 'asset', 'failure_classification', 'linked_work_order'], badgeTone: 'blue' },
      { stepId: 'STEP-CLOSED', statusCode: 'CLOSED', stepName: 'Closed', sequence: 40, isAutomatic: true, requirements: ['linked_work_order_closed'], badgeTone: 'green' }
    ]
  },
  SUPPLY_CHAIN: {
    workflowKey: 'SUPPLY_CHAIN',
    moduleName: 'Supply Chain',
    workflowName: 'Supply Chain Fulfilment',
    initialStatus: 'REQUESTED',
    allowManualStatusChange: false,
    allowBackwardTransition: false,
    allowCancel: true,
    isActive: true,
    steps: [
      { stepId: 'STEP-REQUESTED', statusCode: 'REQUESTED', stepName: 'Requisition Requested', sequence: 10, isAutomatic: false, requirements: ['requested_quantity', 'source_store'], badgeTone: 'orange' },
      { stepId: 'STEP-PR-APPROVED', statusCode: 'PR_APPROVED', stepName: 'Requisition Approved', sequence: 20, isAutomatic: false, requirements: ['requisition_approval'], badgeTone: 'green' },
      { stepId: 'STEP-ORDERED', statusCode: 'ORDERED', stepName: 'Purchase Order Created', sequence: 30, isAutomatic: true, requirements: ['linked_purchase_order'], badgeTone: 'purple' },
      { stepId: 'STEP-PO-APPROVED', statusCode: 'PO_APPROVED', stepName: 'Purchase Order Approved', sequence: 40, isAutomatic: false, requirements: ['purchase_order_approval'], badgeTone: 'blue' },
      { stepId: 'STEP-RECEIVED', statusCode: 'RECEIVED', stepName: 'Goods Received', sequence: 50, isAutomatic: false, requirements: ['goods_receipt', 'stock_posting'], badgeTone: 'blue' },
      { stepId: 'STEP-STAGED', statusCode: 'STAGED', stepName: 'Store Staged', sequence: 60, isAutomatic: true, requirements: ['reservation'], badgeTone: 'purple' },
      { stepId: 'STEP-DELIVERED', statusCode: 'DELIVERED', stepName: 'Delivered to Work Order', sequence: 70, isAutomatic: false, requirements: ['delivery'], badgeTone: 'green' }
    ]
  }
}

const normalizeStep = (row, index, definition) => ({
  stepId: String(row?.stepId ?? row?.step_id ?? `STEP-${index + 1}`),
  statusCode: cleanCode(row?.statusCode ?? row?.status_code),
  stepName: String(row?.stepName ?? row?.step_name ?? row?.statusCode ?? row?.status_code ?? '').trim(),
  sequence: Number(row?.sequence ?? row?.sequence_no) || (index + 1) * 10,
  isAutomatic: Boolean(row?.isAutomatic ?? row?.is_automatic),
  requirements: unique((Array.isArray(row?.requirements) ? row.requirements : [])
    .map(String)
    .filter(requirement => definition.requirements.some(item => item.id === requirement))),
  badgeTone: tones.has(String(row?.badgeTone ?? row?.badge_tone)) ? String(row?.badgeTone ?? row?.badge_tone) : 'neutral'
})

export const normalizeApplicationWorkflow = (value, key) => {
  const normalizedKey = cleanCode(key || value?.workflowKey || value?.workflow_key)
  const definition = APPLICATION_WORKFLOW_DEFINITIONS[normalizedKey]
  const fallback = defaults[normalizedKey]
  if (!definition || !fallback) return null
  const source = { ...fallback, ...(value || {}) }
  const sourceSteps = Array.isArray(value?.steps) && value.steps.length ? value.steps : fallback.steps
  const steps = sourceSteps.map((step, index) => normalizeStep(step, index, definition)).sort((left, right) => left.sequence - right.sequence)
  const initialStatus = cleanCode(value?.initialStatus ?? value?.initial_status ?? source.initialStatus)
  return {
    workflowKey: normalizedKey,
    moduleName: String(value?.moduleName ?? value?.module_name ?? source.moduleName),
    workflowName: String(value?.workflowName ?? value?.workflow_name ?? source.workflowName),
    initialStatus: steps.some(step => step.statusCode === initialStatus) ? initialStatus : steps[0]?.statusCode || fallback.initialStatus,
    allowManualStatusChange: Boolean(value?.allowManualStatusChange ?? value?.allow_manual_status_change ?? source.allowManualStatusChange),
    allowBackwardTransition: Boolean(value?.allowBackwardTransition ?? value?.allow_backward_transition ?? source.allowBackwardTransition),
    allowCancel: Boolean(value?.allowCancel ?? value?.allow_cancel ?? source.allowCancel),
    isActive: Boolean(value?.isActive ?? value?.is_active ?? source.isActive),
    steps
  }
}

export const DEFAULT_APPLICATION_WORKFLOWS = Object.freeze(Object.fromEntries(
  Object.keys(defaults).map(key => [key, normalizeApplicationWorkflow(defaults[key], key)])
))

export const mapApplicationWorkflows = rows => {
  const source = Array.isArray(rows) ? rows : []
  return Object.fromEntries(Object.keys(defaults).map(key => [
    key,
    normalizeApplicationWorkflow(source.find(row => cleanCode(row?.workflow_key ?? row?.workflowKey) === key), key)
  ]))
}

export const applicationWorkflowToApi = value => {
  const workflow = normalizeApplicationWorkflow(value, value?.workflowKey)
  return {
    workflow_name: workflow.workflowName,
    initial_status: workflow.steps[0]?.statusCode || workflow.initialStatus,
    allow_manual_status_change: workflow.allowManualStatusChange,
    allow_backward_transition: workflow.allowBackwardTransition,
    allow_cancel: workflow.allowCancel,
    is_active: workflow.isActive,
    steps: workflow.steps.map((step, index) => ({
      step_id: step.stepId,
      status_code: step.statusCode,
      step_name: step.stepName,
      sequence_no: (index + 1) * 10,
      is_automatic: index > 0 && step.isAutomatic,
      requirements: step.requirements,
      badge_tone: step.badgeTone
    }))
  }
}

export const applicationWorkflowStep = (workflow, status) => workflow?.steps?.find(step => step.statusCode === cleanCode(status)) || null
export const applicationWorkflowNextStep = (workflow, status) => {
  const index = workflow?.steps?.findIndex(step => step.statusCode === cleanCode(status)) ?? -1
  return index >= 0 ? workflow.steps[index + 1] || null : workflow?.steps?.[0] || null
}
export const applicationWorkflowStatusOptions = workflow => (workflow?.steps || []).map(step => ({ value: step.statusCode, label: `${step.statusCode} · ${step.stepName}` }))
export const applicationWorkflowLabel = (workflow, status) => applicationWorkflowStep(workflow, status)?.stepName || String(status || '')
export const applicationWorkflowTone = (workflow, status) => applicationWorkflowStep(workflow, status)?.badgeTone || 'neutral'

export const supplyChainMilestone = (recordType, status) => {
  const type = String(recordType || '').toUpperCase()
  const code = cleanCode(status)
  if (['CAN', 'CANCELLED'].includes(code)) return 'CAN'
  if (type === 'PURCHASE_REQUISITION') return ({ WAPPR: 'REQUESTED', APPR: 'PR_APPROVED', CLOSE: 'RECEIVED' })[code] || code
  if (type === 'PURCHASE_ORDER') return ({ WAPPR: 'ORDERED', APPR: 'PO_APPROVED', INPRG: 'PO_APPROVED', CLOSE: 'RECEIVED' })[code] || code
  if (type === 'RESERVATION') return ({ ENTERED: 'RECEIVED', STAGED: 'STAGED', COMPLETE: 'DELIVERED' })[code] || code
  return code
}
