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
