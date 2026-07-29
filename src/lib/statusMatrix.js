export const STATUS_MATRIX = {
  serviceRequest: {
    NEW: 'New request created',
    QUEUED: 'Waiting for review',
    INPRG: 'In Progress',
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
    HOLD: 'On Hold'
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

// The work order lifecycle is forward-only, with one step back allowed so a misclick can
// be corrected. HOLD is reachable from any active status and returns to where it came
// from; CAN is only available before work starts; CLOSE is terminal.
const workOrderChain = ['WAPPR', 'APPR', 'WSCH', 'SCHED', 'INPRG', 'COMP', 'CLOSE']
const cancellableBefore = ['WAPPR', 'APPR', 'WSCH', 'SCHED']

export const workOrderTransitions = (current, heldFrom = '') => {
  const status = String(current || '').toUpperCase()
  if (status === 'CLOSE' || status === 'CAN') return []
  if (status === 'HOLD') {
    // Resume where the hold started; fall back to the front of the chain if unknown.
    const resume = workOrderChain.includes(String(heldFrom).toUpperCase()) ? String(heldFrom).toUpperCase() : 'WAPPR'
    return [resume, 'CAN']
  }
  const index = workOrderChain.indexOf(status)
  if (index === -1) return ['WAPPR']
  const next = []
  if (index > 0) next.push(workOrderChain[index - 1])
  if (index < workOrderChain.length - 1) next.push(workOrderChain[index + 1])
  if (status !== 'COMP') next.push('HOLD')
  if (cancellableBefore.includes(status)) next.push('CAN')
  return next
}

export const canTransitionWorkOrder = (from, to, heldFrom) => (
  String(from || '').toUpperCase() === String(to || '').toUpperCase() ||
  workOrderTransitions(from, heldFrom).includes(String(to || '').toUpperCase())
)

export const statusDescription = (application, status) => STATUS_MATRIX[application]?.[status] || status || ''

export const normalizeStatus = (application, value, fallback) => {
  const text = String(value || '').trim()
  const upper = text.toUpperCase()
  const aliases = {
    serviceRequest: { CONVERTED: 'RESOLVED', APPROVED: 'RESOLVED' },
    preventiveMaintenance: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', DRAFT: 'DRAFT', Active: 'ACTIVE', Inactive: 'INACTIVE', Draft: 'DRAFT' },
    incident: { OPEN: 'NEW', 'UNDER REVIEW': 'INPRG', CLOSED: 'CLOSED', RESOLVED: 'RESOLVED' },
    purchaseRequisition: { 'PURCHASE REQUESTED': 'WAPPR', REQUESTED: 'WAPPR', APPROVED: 'APPR', CLOSED: 'CLOSE', CANCELLED: 'CAN' },
    inventoryUsage: { RESERVED: 'ENTERED', ALLOCATED: 'ENTERED', ARRANGED: 'STAGED', 'PARTIALLY ARRANGED': 'STAGED', RELEASED: 'STAGED', DELIVERED: 'COMPLETE', 'PARTIALLY DELIVERED': 'STAGED', CANCELLED: 'CANCELLED' }
  }
  const mapped = aliases[application]?.[upper] || aliases[application]?.[text]
  if (mapped) return mapped
  return statusOptions(application).includes(upper) ? upper : fallback
}

export const statusTone = status => {
  if (['ACTIVE', 'OPERATING', 'APPR', 'COMP', 'CLOSE', 'CLOSED', 'COMPLETE', 'RESOLVED'].includes(status)) return 'green'
  if (['INPRG', 'SCHED', 'STAGED'].includes(status)) return 'blue'
  if (['WSCH', 'DRAFT', 'PLANNED', 'ENTERED'].includes(status)) return 'purple'
  if (['WAPPR', 'HOLD', 'CAN', 'CANCELLED', 'BROKEN', 'NOT READY', 'DECOMMISSIONED', 'RETIRED', 'INACTIVE'].includes(status)) return 'orange'
  return 'neutral'
}
