import { Router } from 'express'
import sql from 'mssql'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  WORK_ORDER_REQUIREMENT_IDS,
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
const validTones = new Set(['neutral', 'green', 'blue', 'purple', 'orange', 'red'])
const protectedStatuses = ['SCHED', 'INPRG', 'COMP', 'CLOSE']
const quoteColumn = column => `[${String(column).replaceAll(']', ']]')}]`
const text = value => String(value ?? '').trim()
const booleanValue = value => typeof value === 'string'
  ? ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
  : Boolean(value)
const badRequest = message => {
  const error = new Error(message)
  error.status = 400
  return error
}

const normalizeSteps = rows => {
  if (!Array.isArray(rows)) return null
  if (rows.length < protectedStatuses.length) throw badRequest('The workflow needs at least four stages.')
  if (rows.length > 20) throw badRequest('The workflow supports up to 20 stages.')
  const stepIds = new Set()
  const statusCodes = new Set()
  const steps = rows.map((row, index) => {
    const status = text(row?.status_code ?? row?.statusCode).toUpperCase()
    const name = text(row?.step_name ?? row?.stepName)
    const stepId = text(row?.step_id ?? row?.stepId) || `STEP-${status || index + 1}`
    const requirements = [...new Set((Array.isArray(row?.requirements) ? row.requirements : []).map(text))]
    const unknownRequirement = requirements.find(id => !WORK_ORDER_REQUIREMENT_IDS.includes(id))
    if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(status)) throw badRequest(`Stage ${index + 1} needs a 2-20 character uppercase status code.`)
    if (!name) throw badRequest(`Stage ${status} needs a name.`)
    if (stepIds.has(stepId)) throw badRequest(`Duplicate workflow stage ID: ${stepId}.`)
    if (statusCodes.has(status)) throw badRequest(`Duplicate workflow status code: ${status}.`)
    if (unknownRequirement) throw badRequest(`Unknown workflow requirement: ${unknownRequirement}.`)
    stepIds.add(stepId)
    statusCodes.add(status)
    return {
      step_id: stepId,
      status_code: status,
      step_name: name.slice(0, 160),
      sequence_no: (index + 1) * 10,
      is_automatic: index > 0 && booleanValue(row?.is_automatic ?? row?.isAutomatic),
      requirements,
      badge_tone: validTones.has(text(row?.badge_tone ?? row?.badgeTone)) ? text(row?.badge_tone ?? row?.badgeTone) : 'neutral'
    }
  })
  for (const required of protectedStatuses) {
    if (!statusCodes.has(required)) throw badRequest(`${required} is a protected operational stage and cannot be removed.`)
  }
  const protectedOrder = protectedStatuses.map(status => steps.findIndex(step => step.status_code === status))
  if (!protectedOrder.every((position, index) => index === 0 || position > protectedOrder[index - 1])) {
    throw badRequest('Protected stages must remain in this order: SCHED, INPRG, COMP, CLOSE.')
  }
  if (steps.at(-1).status_code !== 'CLOSE') throw badRequest('CLOSE must remain the final workflow stage.')
  return steps
}

const legacyValuesFromSteps = steps => {
  const target = code => steps.find(step => step.status_code === code)
  const hasRequirement = id => steps.some(step => step.requirements.includes(id))
  return {
    initial_status: steps[0].status_code,
    auto_approve: Boolean(target('APPR')?.is_automatic),
    auto_schedule: Boolean(target('WSCH')?.is_automatic || target('SCHED')?.is_automatic),
    auto_start: Boolean(target('INPRG')?.is_automatic),
    auto_complete: Boolean(target('COMP')?.is_automatic),
    auto_close: Boolean(target('CLOSE')?.is_automatic),
    require_overview_for_approval: hasRequirement('overview'),
    require_planned_labor_for_schedule: hasRequirement('planned_labor'),
    require_materials_for_cm: hasRequirement('planned_materials_cm'),
    require_tools_for_cm: hasRequirement('planned_tools_cm'),
    require_ptw_for_start: hasRequirement('ptw'),
    require_store_issue_for_start: hasRequirement('store_issue'),
    require_failure_for_complete: hasRequirement('failure'),
    require_actual_labor_for_complete: hasRequirement('actual_labor'),
    require_execution_notes_for_complete: hasRequirement('execution_notes'),
    require_actual_resources_for_complete: hasRequirement('actual_resources'),
    require_returns_for_close: hasRequirement('returns')
  }
}

const normalizedPayload = (body, current = {}, steps = null) => {
  const payload = {}
  for (const column of editableColumns) {
    if (body[column] === undefined) continue
    payload[column] = booleanColumns.has(column) ? booleanValue(body[column]) : text(body[column])
  }
  if (steps) Object.assign(payload, legacyValuesFromSteps(steps))
  if (payload.initial_status) payload.initial_status = payload.initial_status.toUpperCase()
  if (payload.workflow_name !== undefined && !payload.workflow_name) throw badRequest('Workflow name is required.')
  const merged = { ...current, ...payload }
  const effectiveSteps = steps || current.steps || []
  if (payload.initial_status && !effectiveSteps.some(step => step.status_code === text(payload.initial_status).toUpperCase())) {
    throw badRequest('Initial status must be one of the configured workflow stages.')
  }
  const manualStagesWithoutActions = effectiveSteps.slice(1)
    .filter(step => !step.is_automatic && !['INPRG', 'COMP', 'CLOSE'].includes(step.status_code))
  if (merged.allow_manual_status_change === false && manualStagesWithoutActions.length) {
    throw badRequest(`Enable manual status control or automate these transitions: ${manualStagesWithoutActions.map(step => step.status_code).join(', ')}.`)
  }
  return payload
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await getWorkOrderWorkflow())
}))

router.put('/', requirePermission('Work Order Workflow', 'edit'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const current = await getWorkOrderWorkflow(pool)
  const steps = normalizeSteps(req.body?.steps)
  const payload = normalizedPayload(req.body || {}, current, steps)
  if (!Object.keys(payload).length && !steps) return res.status(400).json({ error: 'BadRequest', message: 'No workflow controls supplied.' })

  const effectiveSteps = steps || current.steps
  const enforcePtw = (payload.allow_ptw_override ?? current.allow_ptw_override) === false
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    if (steps) {
      const liveStatuses = await new sql.Request(transaction).query(`
        select distinct upper(ltrim(rtrim(status))) status_code
        from dbo.work_orders
        where status is not null
          and upper(ltrim(rtrim(status))) not in ('CAN', 'CANCELLED', 'CANCELED', 'HOLD', 'ON_HOLD_MATERIAL');
      `)
      const configured = new Set(effectiveSteps.map(step => step.status_code))
      const orphaned = liveStatuses.recordset.map(row => row.status_code).filter(status => !configured.has(status))
      if (orphaned.length) {
        const error = new Error(`These statuses are still used by work orders and cannot be removed: ${orphaned.join(', ')}.`)
        error.status = 409
        throw error
      }
    }

    const updateRequest = new sql.Request(transaction)
      .input('updatedBy', req.user?.userId || null)
      .input('enforcePtw', enforcePtw)
    for (const [column, value] of Object.entries(payload)) updateRequest.input(column, value)
    const updateResult = await updateRequest.query(`
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
    if (!updateResult.recordset[0]) {
      const error = new Error('Default work order workflow not found.')
      error.status = 404
      throw error
    }

    if (steps) {
      await new sql.Request(transaction)
        .input('workflowKey', 'DEFAULT')
        .query('delete from dbo.work_order_workflow_steps where workflow_key = @workflowKey;')
      for (const step of steps) {
        await new sql.Request(transaction)
          .input('workflowKey', 'DEFAULT')
          .input('stepId', step.step_id)
          .input('statusCode', step.status_code)
          .input('stepName', step.step_name)
          .input('sequenceNo', step.sequence_no)
          .input('isAutomatic', step.is_automatic)
          .input('requirementsJson', sql.NVarChar(sql.MAX), JSON.stringify(step.requirements))
          .input('badgeTone', step.badge_tone)
          .query(`
            insert into dbo.work_order_workflow_steps (
              workflow_key, step_id, status_code, step_name, sequence_no,
              is_automatic, requirements_json, badge_tone
            ) values (
              @workflowKey, @stepId, @statusCode, @stepName, @sequenceNo,
              @isAutomatic, @requirementsJson, @badgeTone
            );
          `)
      }
      await new sql.Request(transaction)
        .input('workflowKey', 'DEFAULT')
        .input('initialStatus', steps[0].status_code)
        .query(`
          update dbo.pm_schedule_rules
          set default_wo_status = @initialStatus, updated_at = sysutcdatetime()
          where not exists (
            select 1 from dbo.work_order_workflow_steps step
            where step.workflow_key = @workflowKey
              and step.status_code = upper(ltrim(rtrim(dbo.pm_schedule_rules.default_wo_status)))
          );

          update dbo.preventive_maintenance
          set wo_status = @initialStatus, updated_at = sysutcdatetime()
          where not exists (
            select 1 from dbo.work_order_workflow_steps step
            where step.workflow_key = @workflowKey
              and step.status_code = upper(ltrim(rtrim(dbo.preventive_maintenance.wo_status)))
          );
        `)
    }
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }

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
