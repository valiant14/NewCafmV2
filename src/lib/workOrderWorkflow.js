export const WORK_ORDER_REQUIREMENTS = Object.freeze([
  { id: 'overview', label: 'Complete overview', description: 'Description, site, location, ownership, and target dates.', tab: 'Overview' },
  { id: 'planned_labor', label: 'Planned labor', description: 'Craft, estimated hours, and assigned crew.', tab: 'Plan' },
  { id: 'planned_materials_cm', label: 'Corrective materials', description: 'At least one planned material for corrective work.', tab: 'Plan' },
  { id: 'planned_tools_cm', label: 'Corrective tools', description: 'At least one planned tool or equipment item for corrective work.', tab: 'Plan' },
  { id: 'ptw', label: 'Approved PTW', description: 'Permit attachment when the work order requires PTW.', tab: 'PTW & Files' },
  { id: 'store_issue', label: 'Store issue complete', description: 'Every requested stock item is delivered by Store.', tab: 'Material Requests' },
  { id: 'failure', label: 'Failure classification', description: 'Failure and problem codes for corrective work.', tab: 'Failure' },
  { id: 'actual_labor', label: 'Actual labor', description: 'Technician or crew and actual hours.', tab: 'Actual' },
  { id: 'execution_notes', label: 'Execution notes', description: 'Technician remarks and completion notes.', tab: 'Actual' },
  { id: 'actual_resources', label: 'Actual resources', description: 'Material consumption and tools taken.', tab: 'Actual' },
  { id: 'returns', label: 'Store returns settled', description: 'Unused material and borrowed tools are returned.', tab: 'Actual' }
])

export const WORK_ORDER_STAGE_PRESETS = Object.freeze([
  { code: 'WAPPR', label: 'Waiting Approval', tone: 'orange' },
  { code: 'APPR', label: 'Approved', tone: 'green' },
  { code: 'REVIEW', label: 'Technical Review', tone: 'purple' },
  { code: 'WSCH', label: 'Waiting Schedule', tone: 'purple' },
  { code: 'SCHED', label: 'Scheduled', tone: 'blue' },
  { code: 'INPRG', label: 'In Progress', tone: 'blue' },
  { code: 'QA', label: 'Quality Review', tone: 'purple' },
  { code: 'COMP', label: 'Completed', tone: 'green' },
  { code: 'CLOSE', label: 'Closed', tone: 'green' }
])

export const PROTECTED_WORK_ORDER_STATUSES = Object.freeze(['SCHED', 'INPRG', 'COMP', 'CLOSE'])

export const DEFAULT_WORK_ORDER_WORKFLOW_STEPS = Object.freeze([
  { stepId: 'STEP-WAPPR', statusCode: 'WAPPR', stepName: 'Waiting Approval', sequence: 10, isAutomatic: false, requirements: [], badgeTone: 'orange' },
  { stepId: 'STEP-APPR', statusCode: 'APPR', stepName: 'Approved', sequence: 20, isAutomatic: true, requirements: ['overview'], badgeTone: 'green' },
  { stepId: 'STEP-WSCH', statusCode: 'WSCH', stepName: 'Waiting Schedule', sequence: 30, isAutomatic: true, requirements: ['overview', 'planned_labor', 'planned_materials_cm', 'planned_tools_cm'], badgeTone: 'purple' },
  { stepId: 'STEP-SCHED', statusCode: 'SCHED', stepName: 'Scheduled', sequence: 40, isAutomatic: true, requirements: ['overview', 'planned_labor', 'planned_materials_cm', 'planned_tools_cm'], badgeTone: 'blue' },
  { stepId: 'STEP-INPRG', statusCode: 'INPRG', stepName: 'In Progress', sequence: 50, isAutomatic: true, requirements: ['overview', 'planned_labor', 'planned_materials_cm', 'planned_tools_cm', 'ptw', 'store_issue'], badgeTone: 'blue' },
  { stepId: 'STEP-COMP', statusCode: 'COMP', stepName: 'Completed', sequence: 60, isAutomatic: true, requirements: ['store_issue', 'failure', 'actual_labor', 'execution_notes', 'actual_resources'], badgeTone: 'green' },
  { stepId: 'STEP-CLOSE', statusCode: 'CLOSE', stepName: 'Closed', sequence: 70, isAutomatic: false, requirements: ['store_issue', 'failure', 'actual_labor', 'execution_notes', 'actual_resources', 'returns'], badgeTone: 'green' }
])

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
  steps: DEFAULT_WORK_ORDER_WORKFLOW_STEPS,
  updatedBy: '',
  updatedAt: ''
})

const booleanKeys = Object.keys(DEFAULT_WORK_ORDER_WORKFLOW)
  .filter(key => typeof DEFAULT_WORK_ORDER_WORKFLOW[key] === 'boolean')
const tones = ['neutral', 'green', 'blue', 'purple', 'orange', 'red']
const statusCode = value => String(value ?? '').trim().toUpperCase()
const list = value => {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const normalizeStep = (row, index) => {
  const code = statusCode(row?.statusCode ?? row?.status_code)
  return {
    stepId: String(row?.stepId ?? row?.step_id ?? `STEP-${code || index + 1}`),
    statusCode: code,
    stepName: String(row?.stepName ?? row?.step_name ?? code).trim(),
    sequence: Number(row?.sequence ?? row?.sequence_no) || (index + 1) * 10,
    isAutomatic: Boolean(row?.isAutomatic ?? row?.is_automatic),
    requirements: [...new Set(list(row?.requirements ?? row?.requirements_json).map(String).filter(id => WORK_ORDER_REQUIREMENTS.some(item => item.id === id)))],
    badgeTone: tones.includes(String(row?.badgeTone ?? row?.badge_tone)) ? String(row?.badgeTone ?? row?.badge_tone) : 'neutral'
  }
}

export const workOrderWorkflowSteps = value => {
  const source = Array.isArray(value?.steps) && value.steps.length ? value.steps : DEFAULT_WORK_ORDER_WORKFLOW_STEPS
  return source.map(normalizeStep).sort((a, b) => a.sequence - b.sequence)
}

const deriveCompatibilityControls = workflow => {
  const steps = workOrderWorkflowSteps(workflow)
  const target = code => steps.find(step => step.statusCode === code)
  const hasRequirement = id => steps.some(step => step.requirements.includes(id))
  return {
    ...workflow,
    steps,
    initialStatus: steps.some(step => step.statusCode === statusCode(workflow.initialStatus))
      ? statusCode(workflow.initialStatus)
      : steps[0]?.statusCode || DEFAULT_WORK_ORDER_WORKFLOW.initialStatus,
    autoApprove: Boolean(target('APPR')?.isAutomatic),
    autoSchedule: Boolean(target('WSCH')?.isAutomatic || target('SCHED')?.isAutomatic),
    autoStart: Boolean(target('INPRG')?.isAutomatic),
    autoComplete: Boolean(target('COMP')?.isAutomatic),
    autoClose: Boolean(target('CLOSE')?.isAutomatic),
    requireOverviewForApproval: hasRequirement('overview'),
    requirePlannedLaborForSchedule: hasRequirement('planned_labor'),
    requireMaterialsForCm: hasRequirement('planned_materials_cm'),
    requireToolsForCm: hasRequirement('planned_tools_cm'),
    requirePtwForStart: hasRequirement('ptw'),
    requireStoreIssueForStart: hasRequirement('store_issue'),
    requireFailureForComplete: hasRequirement('failure'),
    requireActualLaborForComplete: hasRequirement('actual_labor'),
    requireExecutionNotesForComplete: hasRequirement('execution_notes'),
    requireActualResourcesForComplete: hasRequirement('actual_resources'),
    requireReturnsForClose: hasRequirement('returns')
  }
}

export const normalizeWorkOrderWorkflow = value => {
  const workflow = { ...DEFAULT_WORK_ORDER_WORKFLOW, ...(value || {}) }
  for (const key of booleanKeys) workflow[key] = Boolean(workflow[key])
  return deriveCompatibilityControls(workflow)
}

export const workflowStepByStatus = (workflow, value) => workOrderWorkflowSteps(workflow)
  .find(step => step.statusCode === statusCode(value))

export const workflowNextStep = (workflow, value) => {
  const steps = workOrderWorkflowSteps(workflow)
  const index = steps.findIndex(step => step.statusCode === statusCode(value))
  return index >= 0 ? steps[index + 1] || null : null
}

// The furthest status an order can reach on its own from here, following consecutive automatic
// steps whose requirements are already met. Advancing one hop per render redrew the workflow
// banner at every intermediate status - the flicker seen when finishing the plan runs an order
// through Approved and Waiting Schedule on its way to Scheduled.
export const workflowAutoTarget = (workflow, value, canAdvanceTo) => {
  const steps = workOrderWorkflowSteps(workflow)
  let index = steps.findIndex(step => step.statusCode === statusCode(value))
  let target = ''
  while (index >= 0 && index + 1 < steps.length) {
    const next = steps[index + 1]
    if (!next.isAutomatic || !canAdvanceTo(next.statusCode)) break
    target = next.statusCode
    index += 1
  }
  return target
}

export const workflowPreviousStep = (workflow, value) => {
  const steps = workOrderWorkflowSteps(workflow)
  const index = steps.findIndex(step => step.statusCode === statusCode(value))
  return index > 0 ? steps[index - 1] : null
}

export const workflowRequirementsForStatus = (workflow, value) => workflowStepByStatus(workflow, value)?.requirements || []
export const workflowHasRequirement = (workflow, requirement) => workOrderWorkflowSteps(workflow).some(step => step.requirements.includes(requirement))
export const workflowStatusLabel = (workflow, value) => workflowStepByStatus(workflow, value)?.stepName || String(value ?? '').trim()

export const workflowStatusOptions = workflow => workOrderWorkflowSteps(workflow).map(step => ({
  value: step.statusCode,
  label: step.stepName,
  tone: step.badgeTone
}))

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
  steps: row?.steps,
  updatedBy: row?.updated_by_user_id,
  updatedAt: row?.updated_at
}).filter(([, entry]) => entry !== undefined)))

export const workOrderWorkflowToApi = value => {
  const workflow = normalizeWorkOrderWorkflow(value)
  return {
    workflow_name: workflow.workflowName,
    initial_status: workflow.steps[0]?.statusCode || workflow.initialStatus,
    ptw_required_default: workflow.ptwRequiredDefault,
    allow_ptw_override: workflow.allowPtwOverride,
    allow_manual_status_change: workflow.allowManualStatusChange,
    allow_backward_transition: workflow.allowBackwardTransition,
    allow_hold: workflow.allowHold,
    allow_cancel_before_start: workflow.allowCancelBeforeStart,
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
