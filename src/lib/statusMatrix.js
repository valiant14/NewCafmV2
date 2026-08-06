import { workOrderWorkflowSteps } from './workOrderWorkflow'

export const STATUS_MATRIX = {
  serviceRequest: {
    NEW: 'New request created',
    WAPPR: 'Department Review / Waiting Approval',
    INPRG: 'CM Work Order In Progress',
    CLOSED: 'Closed',
    CAN: 'Cancelled'
  },
  workOrder: {
    WAPPR: 'Waiting for Approval',
    APPR: 'Approved',
    WSCH: 'Waiting for Schedule',
    SCHED: 'Scheduled',
    INPRG: 'In Progress',
    COMP: 'Completed',
    CLOSE: 'Closed',
    CAN: 'Cancelled',
    HOLD: 'On Hold',
    ON_HOLD_MATERIAL: 'Waiting for Material',
    ON_HOLD_PERMIT: 'Waiting for Permit'
  },
  preventiveMaintenance: {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    DRAFT: 'Draft'
  },
  asset: {
    OPERATING: 'Operating',
    'NOT READY': 'Not Ready',
    DECOMMISSIONED: 'Decommissioned',
    RETIRED: 'Retired',
    BROKEN: 'Broken'
  },
  location: {
    OPERATING: 'Operating',
    PLANNED: 'Planned',
    DECOMMISSIONED: 'Decommissioned'
  },
  jobPlan: {
    DRAFT: 'Draft',
    ACTIVE: 'Active',
    INACTIVE: 'Inactive'
  },
  purchaseRequisition: {
    WAPPR: 'Waiting for Approval',
    APPR: 'Approved',
    CLOSE: 'Closed',
    CAN: 'Cancelled'
  },
  purchaseOrder: {
    WAPPR: 'Waiting for Approval',
    APPR: 'Approved',
    INPRG: 'In Progress',
    CLOSE: 'Closed',
    CAN: 'Cancelled'
  },
  inventoryUsage: {
    ENTERED: 'Entered',
    STAGED: 'Staged',
    COMPLETE: 'Complete',
    CANCELLED: 'Cancelled'
  },
  incident: {
    NEW: 'New',
    INPRG: 'In Progress',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed'
  }
}

export const statusOptions = application => Object.keys(STATUS_MATRIX[application] || {})

const STATUS_ALIASES = {
  serviceRequest: { APPROVED: 'INPRG', CONVERTED: 'INPRG', RESOLVED: 'CLOSED', QUEUED: 'WAPPR' },
  preventiveMaintenance: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', DRAFT: 'DRAFT' },
  incident: { OPEN: 'NEW', 'UNDER REVIEW': 'INPRG' },
  purchaseRequisition: { 'PURCHASE REQUESTED': 'WAPPR', REQUESTED: 'WAPPR', APPROVED: 'APPR', CLOSED: 'CLOSE', CANCELLED: 'CAN' },
  inventoryUsage: { RESERVED: 'ENTERED', ALLOCATED: 'ENTERED', ARRANGED: 'STAGED', 'PARTIALLY ARRANGED': 'STAGED', RELEASED: 'STAGED', DELIVERED: 'COMPLETE', 'PARTIALLY DELIVERED': 'STAGED', CANCELLED: 'CANCELLED' }
}

const GENERIC_STATUS_ALIASES = {
  APPROVED: 'APPR',
  'IN PROGRESS': 'INPRG',
  SCHEDULED: 'SCHED',
  COMPLETED: 'COMP',
  CANCELLED: 'CAN',
  CANCELED: 'CAN',
  'ON HOLD': 'HOLD',
  'WAITING FOR MATERIAL': 'ON_HOLD_MATERIAL',
  'WAITING FOR PERMIT': 'ON_HOLD_PERMIT',
  'WAITING FOR APPROVAL': 'WAPPR',
  'WAITING FOR SCHEDULE': 'WSCH'
}

export const statusCode = (application, value) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const upper = text.toUpperCase()
  const matrix = STATUS_MATRIX[application] || {}
  if (matrix[upper]) return upper
  const mapped = STATUS_ALIASES[application]?.[upper]
  if (mapped) return mapped
  const descriptionMatch = Object.entries(matrix).find(([, description]) => description.toUpperCase() === upper)
  if (descriptionMatch) return descriptionMatch[0]
  return GENERIC_STATUS_ALIASES[upper] || upper
}

const holdStatuses = ['HOLD', 'ON_HOLD_MATERIAL', 'ON_HOLD_PERMIT']

export const workOrderTransitions = (current, heldFrom = '', workflow = {}) => {
  const status = String(current || '').toUpperCase()
  const steps = workOrderWorkflowSteps(workflow)
  const terminal = steps.at(-1)?.statusCode || 'CLOSE'
  if ([terminal, 'CLOSE', 'CAN'].includes(status)) return []
  if (holdStatuses.includes(status)) {
    const heldStatus = String(heldFrom).toUpperCase()
    const resume = steps.some(step => step.statusCode === heldStatus) ? heldStatus : (workflow.initialStatus || steps[0]?.statusCode || 'WAPPR')
    return [resume, ...(workflow.allowCancelBeforeStart === false ? [] : ['CAN'])]
  }
  const index = steps.findIndex(step => step.statusCode === status)
  if (index === -1) return [workflow.initialStatus || 'WAPPR']
  const next = []
  if (workflow.allowBackwardTransition !== false && index > 0) next.push(steps[index - 1].statusCode)
  if (index < steps.length - 1) next.push(steps[index + 1].statusCode)
  const completionIndex = steps.findIndex(step => step.statusCode === 'COMP')
  if (workflow.allowHold !== false && (completionIndex < 0 || index < completionIndex)) next.push(...holdStatuses)
  const startIndex = steps.findIndex(step => step.statusCode === 'INPRG')
  if (workflow.allowCancelBeforeStart !== false && (startIndex < 0 || index < startIndex)) next.push('CAN')
  return next
}

export const canTransitionWorkOrder = (from, to, heldFrom, workflow) => (
  String(from || '').toUpperCase() === String(to || '').toUpperCase() ||
  workOrderTransitions(from, heldFrom, workflow).includes(String(to || '').toUpperCase())
)

export const statusDescription = (application, status) => {
  const code = statusCode(application, status)
  return STATUS_MATRIX[application]?.[code] || String(status ?? '').trim()
}

export const normalizeStatus = (application, value, fallback) => {
  const code = statusCode(application, value)
  return statusOptions(application).includes(code) ? code : fallback
}

export const statusTone = status => {
  const code = String(status ?? '').trim().toUpperCase()
  if (['ACTIVE', 'AVAILABLE', 'OPERATING', 'APPR', 'COMP', 'CLOSE', 'CLOSED', 'COMPLETE', 'RESOLVED', 'POSTED'].includes(code)) return 'green'
  if (['INPRG', 'IN PROGRESS', 'SCHED', 'SCHEDULED', 'STAGED', 'CONVERTED'].includes(code)) return 'blue'
  if (['WSCH', 'DRAFT', 'PLANNED', 'ENTERED', 'NEW'].includes(code)) return 'purple'
  if (['CAN', 'CANCELLED', 'CANCELED', 'BROKEN', 'DECOMMISSIONED', 'RETIRED'].includes(code)) return 'red'
  if (['WAPPR', 'HOLD', 'ON HOLD', 'ON_HOLD_MATERIAL', 'ON_HOLD_PERMIT', 'NOT READY', 'INACTIVE', 'LOW STOCK', 'NO STOCK'].includes(code)) return 'orange'
  return 'neutral'
}
