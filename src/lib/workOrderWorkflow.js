export const DEFAULT_WORK_ORDER_WORKFLOW = Object.freeze({
  workflowKey: 'DEFAULT',
  workflowName: 'Standard Work Order Lifecycle',
  initialStatus: 'WAPPR',
  ptwRequiredDefault: true,
  allowPtwOverride: true,
  allowManualStatusChange: true,
  allowBackwardTransition: true,
  allowHold: true,
  allowCancelBeforeStart: true,
  autoApprove: true,
  autoSchedule: true,
  autoStart: true,
  autoComplete: true,
  autoClose: false,
  requireOverviewForApproval: true,
  requirePlannedLaborForSchedule: true,
  requireMaterialsForCm: true,
  requireToolsForCm: true,
  requirePtwForStart: true,
  requireStoreIssueForStart: true,
  requireFailureForComplete: true,
  requireActualLaborForComplete: true,
  requireExecutionNotesForComplete: true,
  requireActualResourcesForComplete: true,
  requireReturnsForClose: true,
  updatedBy: '',
  updatedAt: ''
})

const booleanKeys = Object.keys(DEFAULT_WORK_ORDER_WORKFLOW)
  .filter(key => typeof DEFAULT_WORK_ORDER_WORKFLOW[key] === 'boolean')

export const normalizeWorkOrderWorkflow = value => {
  const workflow = { ...DEFAULT_WORK_ORDER_WORKFLOW, ...(value || {}) }
  for (const key of booleanKeys) workflow[key] = Boolean(workflow[key])
  workflow.initialStatus = ['WAPPR', 'APPR', 'WSCH', 'SCHED'].includes(String(workflow.initialStatus || '').toUpperCase())
    ? String(workflow.initialStatus).toUpperCase()
    : DEFAULT_WORK_ORDER_WORKFLOW.initialStatus
  return workflow
}

export const mapWorkOrderWorkflow = row => normalizeWorkOrderWorkflow(Object.fromEntries(Object.entries({
  workflowKey: row?.workflow_key,
  workflowName: row?.workflow_name,
  initialStatus: row?.initial_status,
  ptwRequiredDefault: row?.ptw_required_default,
  allowPtwOverride: row?.allow_ptw_override,
  allowManualStatusChange: row?.allow_manual_status_change,
  allowBackwardTransition: row?.allow_backward_transition,
  allowHold: row?.allow_hold,
  allowCancelBeforeStart: row?.allow_cancel_before_start,
  autoApprove: row?.auto_approve,
  autoSchedule: row?.auto_schedule,
  autoStart: row?.auto_start,
  autoComplete: row?.auto_complete,
  autoClose: row?.auto_close,
  requireOverviewForApproval: row?.require_overview_for_approval,
  requirePlannedLaborForSchedule: row?.require_planned_labor_for_schedule,
  requireMaterialsForCm: row?.require_materials_for_cm,
  requireToolsForCm: row?.require_tools_for_cm,
  requirePtwForStart: row?.require_ptw_for_start,
  requireStoreIssueForStart: row?.require_store_issue_for_start,
  requireFailureForComplete: row?.require_failure_for_complete,
  requireActualLaborForComplete: row?.require_actual_labor_for_complete,
  requireExecutionNotesForComplete: row?.require_execution_notes_for_complete,
  requireActualResourcesForComplete: row?.require_actual_resources_for_complete,
  requireReturnsForClose: row?.require_returns_for_close,
  updatedBy: row?.updated_by_user_id,
  updatedAt: row?.updated_at
}).filter(([, value]) => value !== undefined)))

export const workOrderWorkflowToApi = value => {
  const workflow = normalizeWorkOrderWorkflow(value)
  return {
    workflow_name: workflow.workflowName,
    initial_status: workflow.initialStatus,
    ptw_required_default: workflow.ptwRequiredDefault,
    allow_ptw_override: workflow.allowPtwOverride,
    allow_manual_status_change: workflow.allowManualStatusChange,
    allow_backward_transition: workflow.allowBackwardTransition,
    allow_hold: workflow.allowHold,
    allow_cancel_before_start: workflow.allowCancelBeforeStart,
    auto_approve: workflow.autoApprove,
    auto_schedule: workflow.autoSchedule,
    auto_start: workflow.autoStart,
    auto_complete: workflow.autoComplete,
    auto_close: workflow.autoClose,
    require_overview_for_approval: workflow.requireOverviewForApproval,
    require_planned_labor_for_schedule: workflow.requirePlannedLaborForSchedule,
    require_materials_for_cm: workflow.requireMaterialsForCm,
    require_tools_for_cm: workflow.requireToolsForCm,
    require_ptw_for_start: workflow.requirePtwForStart,
    require_store_issue_for_start: workflow.requireStoreIssueForStart,
    require_failure_for_complete: workflow.requireFailureForComplete,
    require_actual_labor_for_complete: workflow.requireActualLaborForComplete,
    require_execution_notes_for_complete: workflow.requireExecutionNotesForComplete,
    require_actual_resources_for_complete: workflow.requireActualResourcesForComplete,
    require_returns_for_close: workflow.requireReturnsForClose
  }
}
