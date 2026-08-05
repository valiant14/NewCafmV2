import { Router } from 'express'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  WORK_ORDER_WORKFLOW_COLUMNS,
  clearWorkOrderWorkflowCache,
  getWorkOrderWorkflow
} from '../services/workOrderWorkflow.js'

const router = Router()
const editableColumns = WORK_ORDER_WORKFLOW_COLUMNS.filter(column => column !== 'workflow_key')
const booleanColumns = new Set([
  'ptw_required_default', 'allow_ptw_override', 'allow_manual_status_change',
  'allow_backward_transition', 'allow_hold', 'allow_cancel_before_start',
  'auto_approve', 'auto_schedule', 'auto_start', 'auto_complete', 'auto_close',
  'require_overview_for_approval', 'require_planned_labor_for_schedule',
  'require_materials_for_cm', 'require_tools_for_cm', 'require_ptw_for_start',
  'require_store_issue_for_start', 'require_failure_for_complete',
  'require_actual_labor_for_complete', 'require_execution_notes_for_complete',
  'require_actual_resources_for_complete', 'require_returns_for_close'
])
const quoteColumn = column => `[${String(column).replaceAll(']', ']]')}]`
const booleanValue = value => typeof value === 'string'
  ? ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
  : Boolean(value)

const normalizedPayload = (body, current = {}) => {
  const payload = {}
  for (const column of editableColumns) {
    if (body[column] === undefined) continue
    payload[column] = booleanColumns.has(column) ? booleanValue(body[column]) : String(body[column] ?? '').trim()
  }
  if (payload.initial_status && !['WAPPR', 'APPR', 'WSCH', 'SCHED'].includes(payload.initial_status.toUpperCase())) {
    const error = new Error('Initial status must be WAPPR, APPR, WSCH, or SCHED.')
    error.status = 400
    throw error
  }
  if (payload.initial_status) payload.initial_status = payload.initial_status.toUpperCase()
  if (payload.workflow_name !== undefined && !payload.workflow_name) {
    const error = new Error('Workflow name is required.')
    error.status = 400
    throw error
  }
  const merged = { ...current, ...payload }
  if (merged.allow_manual_status_change === false && (merged.auto_approve === false || merged.auto_schedule === false)) {
    const error = new Error('Keep manual status changes enabled, or enable automatic approval and scheduling so work orders cannot become stuck.')
    error.status = 400
    throw error
  }
  return payload
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await getWorkOrderWorkflow())
}))

router.put('/', requirePermission('Work Order Workflow', 'edit'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const current = await getWorkOrderWorkflow(pool)
  const payload = normalizedPayload(req.body || {}, current)
  if (!Object.keys(payload).length) return res.status(400).json({ error: 'BadRequest', message: 'No workflow controls supplied.' })
  const enforcePtw = (payload.allow_ptw_override ?? current.allow_ptw_override) === false
  const request = pool.request()
    .input('updatedBy', req.user?.userId || null)
    .input('enforcePtw', enforcePtw)
  for (const [column, value] of Object.entries(payload)) request.input(column, value)
  const result = await request.query(`
    update dbo.work_order_workflow_settings
    set ${Object.keys(payload).map(column => `${quoteColumn(column)} = @${column}`).join(', ')},
      updated_by_user_id = @updatedBy,
      updated_at = sysutcdatetime()
    output inserted.*
    where workflow_key = 'DEFAULT';

    if @enforcePtw = 1
      update dbo.work_orders
      set ptw_required = 1, updated_at = sysutcdatetime()
      where ptw_required = 0;
  `)
  if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Default work order workflow not found.' })
  clearWorkOrderWorkflowCache()
  req.app.locals.broadcastWorkspaceChange?.({
    actor: req.user?.userId || req.user?.username || '',
    moduleName: 'Work Order Workflow',
    relatedModules: ['Work Orders'],
    table: 'dbo.work_order_workflow_settings',
    action: 'edit',
    key: 'workflow_key',
    id: 'DEFAULT'
  })
  res.json(await getWorkOrderWorkflow(pool))
}))

export default router
