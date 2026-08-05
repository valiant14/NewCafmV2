import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { closePool, getPool } from './pool.js'
import { allowedWorkOrderTransitions } from '../services/workOrderWorkflow.js'

const baseUrl = process.env.API_CHECK_BASE_URL || `http://localhost:${env.port}/api`
const pool = await getPool()
const result = await pool.request().query(`
  select top 1 u.user_id
  from dbo.users u
  join dbo.roles r on r.role_id = u.role_id
  where u.status = 'Active'
    and r.status = 'Active'
    and (case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end) = 'GLOBAL'
  order by case when u.user_id = 'USR-ADMIN' then 0 else 1 end, u.user_id;

  select top 1 work_order_num, status
  from dbo.work_orders
  where status not in ('CLOSE', 'CAN')
  order by reported_at desc, work_order_num desc;

  select workflow_key, workflow_name, initial_status, ptw_required_default,
    auto_approve, auto_schedule, auto_start, auto_complete, auto_close
  from dbo.work_order_workflow_settings
  where workflow_key = 'DEFAULT';

  select count_big(1) as permission_count
  from dbo.roles r
  join dbo.role_permissions p on p.role_id = r.role_id and p.allowed = 1
  where r.role_code = 'FACILITY_MANAGER'
    and p.module_name = 'Work Order Workflow'
    and p.action_name in ('view', 'edit');

  select count_big(1) as step_count
  from dbo.work_order_workflow_steps
  where workflow_key = 'DEFAULT';
`)

const globalUser = result.recordsets[0]?.[0]
const activeOrder = result.recordsets[1]?.[0]
const databaseWorkflow = result.recordsets[2]?.[0]
const permissionCount = Number(result.recordsets[3]?.[0]?.permission_count || 0)
const databaseStepCount = Number(result.recordsets[4]?.[0]?.step_count || 0)
if (!globalUser) throw new Error('A global administrator is required for the workflow API check.')
if (!databaseWorkflow) throw new Error('The DEFAULT work-order workflow record is missing.')
if (permissionCount < 2) throw new Error('Facility Manager is missing Work Order Workflow view/edit permissions.')
if (databaseStepCount < 4) throw new Error('The dynamic workflow stages are missing.')

const token = jwt.sign({ userId: globalUser.user_id }, env.jwtSecret, { expiresIn: '2m' })
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Connection: 'close',
      ...(options.headers || {})
    }
  })
  return { status: response.status, body: await response.json().catch(() => null) }
}

const workflowResponse = await request('/work-order-workflow')
if (workflowResponse.status !== 200 || workflowResponse.body?.workflow_key !== 'DEFAULT') {
  throw new Error(`Workflow endpoint check failed with HTTP ${workflowResponse.status}.`)
}
if (!Array.isArray(workflowResponse.body.steps) || workflowResponse.body.steps.length !== databaseStepCount) {
  throw new Error('Workflow API did not return the SQL-backed stage definition.')
}

const workflowPayload = workflow => ({
  workflow_name: workflow.workflow_name,
  ptw_required_default: workflow.ptw_required_default,
  allow_ptw_override: workflow.allow_ptw_override,
  allow_manual_status_change: workflow.allow_manual_status_change,
  allow_backward_transition: workflow.allow_backward_transition,
  allow_hold: workflow.allow_hold,
  allow_cancel_before_start: workflow.allow_cancel_before_start,
  steps: workflow.steps.map(step => ({
    step_id: step.step_id,
    status_code: step.status_code,
    step_name: step.step_name,
    sequence_no: step.sequence_no,
    is_automatic: step.is_automatic,
    requirements: step.requirements,
    badge_tone: step.badge_tone
  }))
})

const originalWorkflow = workflowResponse.body
const toggledBackward = !originalWorkflow.allow_backward_transition
let toggleRoundTrip = false
let dynamicStageRoundTrip = false
let dynamicTransitionApplied = false
try {
  const probeSteps = [...originalWorkflow.steps]
  probeSteps.splice(probeSteps.length - 1, 0, {
    step_id: 'STEP-WORKFLOW-CHECK',
    status_code: 'WFCHK',
    step_name: 'Workflow Check',
    sequence_no: 0,
    is_automatic: false,
    requirements: ['overview'],
    badge_tone: 'purple'
  })
  const toggled = await request('/work-order-workflow', {
    method: 'PUT',
    body: JSON.stringify({
      ...workflowPayload({ ...originalWorkflow, steps: probeSteps }),
      allow_backward_transition: toggledBackward
    })
  })
  if (toggled.status !== 200 || toggled.body?.allow_backward_transition !== toggledBackward) {
    throw new Error(`Workflow toggle round-trip failed with HTTP ${toggled.status}.`)
  }
  toggleRoundTrip = toggled.body.allow_backward_transition === toggledBackward
  dynamicStageRoundTrip = toggled.body.steps?.at(-2)?.status_code === 'WFCHK'
  if (!dynamicStageRoundTrip) throw new Error('Dynamic workflow stage add/reorder round-trip failed.')
  dynamicTransitionApplied = allowedWorkOrderTransitions('COMP', toggled.body).includes('WFCHK')
  if (!dynamicTransitionApplied) throw new Error('The backend transition engine did not use the dynamic stage order.')
} finally {
  const restored = await request('/work-order-workflow', {
    method: 'PUT',
    body: JSON.stringify(workflowPayload(originalWorkflow))
  })
  if (restored.status !== 200 || restored.body?.allow_backward_transition !== originalWorkflow.allow_backward_transition) {
    throw new Error('Workflow check could not restore the original configuration.')
  }
}

let invalidJumpRejected = null
if (activeOrder) {
  const invalidJump = await request(`/work-orders/${encodeURIComponent(activeOrder.work_order_num)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'CLOSE' })
  })
  invalidJumpRejected = invalidJump.status === 409
  if (!invalidJumpRejected) throw new Error(`Invalid status jump expected HTTP 409, received ${invalidJump.status}.`)
}

console.log(JSON.stringify({
  ok: true,
  workflow: workflowResponse.body.workflow_name,
  initialStatus: workflowResponse.body.initial_status,
  dynamicStages: workflowResponse.body.steps.length,
  toggleRoundTrip,
  dynamicStageRoundTrip,
  dynamicTransitionApplied,
  facilityManagerPermissions: permissionCount,
  checkedWorkOrder: activeOrder?.work_order_num || null,
  invalidJumpRejected
}, null, 2))
await closePool()
