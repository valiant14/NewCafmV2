export const STATUS_MATRIX = {
  serviceRequest: {
    NEW: 'New request created',
    QUEUED: 'Waiting for review',
    INPRG: 'In Progress',
    CONVERTED: 'Converted to Work Order',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    CAN: 'Cancelled',
    WAPPR: 'Waiting for Approval'
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
    ON_HOLD_MATERIAL: 'On Hold – Material'
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
  serviceRequest: { APPROVED: 'CONVERTED' },
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

// The work order lifecycle is forward-only, with one step back allowed so a misclick can
// be corrected. HOLD is reachable from any active status and returns to where it came
// from; CAN is only available before work starts; CLOSE is terminal.
const workOrderChain = ['WAPPR', 'APPR', 'WSCH', 'SCHED', 'INPRG', 'COMP', 'CLOSE']
const cancellableBefore = ['WAPPR', 'APPR', 'WSCH', 'SCHED']
// Both holds behave identically in the state machine. They differ in what they mean -
// ON_HOLD_MATERIAL says the job is waiting on stock, and it is the one that pauses SLA.
const holdStatuses = ['HOLD', 'ON_HOLD_MATERIAL']

export const workOrderTransitions = (current, heldFrom = '') => {
  const status = String(current || '').toUpperCase()
  if (status === 'CLOSE' || status === 'CAN') return []
  if (holdStatuses.includes(status)) {
    // Resume where the hold started; fall back to the front of the chain if unknown.
    const resume = workOrderChain.includes(String(heldFrom).toUpperCase()) ? String(heldFrom).toUpperCase() : 'WAPPR'
    return [resume, 'CAN']
  }
  const index = workOrderChain.indexOf(status)
  if (index === -1) return ['WAPPR']
  const next = []
  if (index > 0) next.push(workOrderChain[index - 1])
  if (index < workOrderChain.length - 1) next.push(workOrderChain[index + 1])
  if (status !== 'COMP') next.push(...holdStatuses)
  if (cancellableBefore.includes(status)) next.push('CAN')
  return next
}

export const canTransitionWorkOrder = (from, to, heldFrom) => (
  String(from || '').toUpperCase() === String(to || '').toUpperCase() ||
  workOrderTransitions(from, heldFrom).includes(String(to || '').toUpperCase())
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
  if (['WAPPR', 'HOLD', 'ON HOLD', 'ON_HOLD_MATERIAL', 'NOT READY', 'INACTIVE', 'LOW STOCK', 'NO STOCK'].includes(code)) return 'orange'
  return 'neutral'
}
