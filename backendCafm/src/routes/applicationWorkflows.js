import { Router } from 'express'
import sql from 'mssql'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import {
  APPLICATION_WORKFLOW_DEFINITIONS,
  APPLICATION_WORKFLOW_KEYS,
  clearApplicationWorkflowCache,
  getApplicationWorkflow,
  getApplicationWorkflows
} from '../services/applicationWorkflows.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
const validTones = new Set(['neutral', 'green', 'blue', 'purple', 'orange', 'red'])
const text = value => String(value ?? '').trim()
const booleanValue = value => typeof value === 'string'
  ? ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
  : Boolean(value)
const badRequest = message => {
  const error = new Error(message)
  error.status = 400
  return error
}

const workflowKey = value => text(value).toUpperCase().replace(/[^A-Z0-9_]/g, '')
const cleanStatus = value => text(value).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 40)

const normalizeSteps = (rows, definition) => {
  if (!Array.isArray(rows)) return null
  if (rows.length < definition.protected_statuses.length) throw badRequest(`The ${definition.module_name} workflow needs at least ${definition.protected_statuses.length} stages.`)
  if (rows.length > 20) throw badRequest('A workflow supports up to 20 stages.')
  const stepIds = new Set()
  const statuses = new Set()
  const steps = rows.map((row, index) => {
    const status = cleanStatus(row?.status_code ?? row?.statusCode)
    const name = text(row?.step_name ?? row?.stepName)
    const stepId = text(row?.step_id ?? row?.stepId) || `STEP-${status || index + 1}`
    const requirements = [...new Set((Array.isArray(row?.requirements) ? row.requirements : []).map(text))]
    const unknownRequirement = requirements.find(id => !definition.requirement_ids.includes(id))
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(status)) throw badRequest(`Stage ${index + 1} needs a 2-40 character uppercase status code.`)
    if (!name) throw badRequest(`Stage ${status} needs a name.`)
    if (stepIds.has(stepId)) throw badRequest(`Duplicate workflow stage ID: ${stepId}.`)
    if (statuses.has(status)) throw badRequest(`Duplicate workflow status code: ${status}.`)
    if (unknownRequirement) throw badRequest(`Unknown workflow requirement: ${unknownRequirement}.`)
    stepIds.add(stepId)
    statuses.add(status)
    return {
      step_id: stepId.slice(0, 80),
      status_code: status,
      step_name: name.slice(0, 160),
      sequence_no: (index + 1) * 10,
      is_automatic: index > 0 && booleanValue(row?.is_automatic ?? row?.isAutomatic),
      requirements,
      badge_tone: validTones.has(text(row?.badge_tone ?? row?.badgeTone)) ? text(row?.badge_tone ?? row?.badgeTone) : 'neutral'
    }
  })
  for (const protectedStatus of definition.protected_statuses) {
    if (!statuses.has(protectedStatus)) throw badRequest(`${protectedStatus} is a protected operational stage and cannot be removed.`)
  }
  const protectedOrder = definition.protected_statuses.map(status => steps.findIndex(step => step.status_code === status))
  if (!protectedOrder.every((position, index) => index === 0 || position > protectedOrder[index - 1])) {
    throw badRequest(`Protected stages must remain in this order: ${definition.protected_statuses.join(', ')}.`)
  }
  if (steps.at(-1)?.status_code !== definition.protected_statuses.at(-1)) {
    throw badRequest(`${definition.protected_statuses.at(-1)} must remain the final workflow stage.`)
  }
  return steps
}

router.get('/', asyncHandler(async (req, res) => {
  res.json(await getApplicationWorkflows())
}))

router.put('/:workflowKey', requirePermission('Work Order Workflow', 'edit'), asyncHandler(async (req, res) => {
  const key = workflowKey(req.params.workflowKey)
  if (!APPLICATION_WORKFLOW_KEYS.includes(key)) throw badRequest(`Unsupported workflow: ${key || req.params.workflowKey}.`)
  const definition = APPLICATION_WORKFLOW_DEFINITIONS[key]
  const pool = await getPool()
  const current = await getApplicationWorkflow(key, pool)
  const steps = normalizeSteps(req.body?.steps, definition)
  const payload = {
    workflow_name: req.body?.workflow_name === undefined ? current.workflow_name : text(req.body.workflow_name),
    initial_status: steps?.[0]?.status_code || cleanStatus(req.body?.initial_status || current.initial_status),
    allow_manual_status_change: req.body?.allow_manual_status_change === undefined ? current.allow_manual_status_change : booleanValue(req.body.allow_manual_status_change),
    allow_backward_transition: req.body?.allow_backward_transition === undefined ? current.allow_backward_transition : booleanValue(req.body.allow_backward_transition),
    allow_cancel: req.body?.allow_cancel === undefined ? current.allow_cancel : booleanValue(req.body.allow_cancel),
    is_active: req.body?.is_active === undefined ? current.is_active : booleanValue(req.body.is_active)
  }
  if (!payload.workflow_name) throw badRequest('Workflow name is required.')
  const effectiveSteps = steps || current.steps
  if (!effectiveSteps.some(step => step.status_code === payload.initial_status)) throw badRequest('Initial status must be one of the configured workflow stages.')

  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    if (key === 'JOB_REQUEST' && steps) {
      const used = await new sql.Request(transaction).query(`
        select distinct upper(ltrim(rtrim(status))) status_code
        from dbo.service_requests
        where status is not null and upper(ltrim(rtrim(status))) not in ('CAN', 'CANCELLED', 'CANCELED');
      `)
      const configured = new Set(steps.map(step => step.status_code))
      const orphaned = used.recordset.map(row => row.status_code).filter(status => !configured.has(status))
      if (orphaned.length) {
        const error = new Error(`These statuses are still used by Job Requests and cannot be removed: ${orphaned.join(', ')}.`)
        error.status = 409
        throw error
      }
    }

    await new sql.Request(transaction)
      .input('workflowKey', key)
      .input('workflowName', payload.workflow_name)
      .input('initialStatus', payload.initial_status)
      .input('allowManual', payload.allow_manual_status_change)
      .input('allowBackward', payload.allow_backward_transition)
      .input('allowCancel', payload.allow_cancel)
      .input('isActive', payload.is_active)
      .input('updatedBy', req.user?.userId || null)
      .query(`
        update dbo.application_workflows
        set workflow_name = @workflowName,
            initial_status = @initialStatus,
            allow_manual_status_change = @allowManual,
            allow_backward_transition = @allowBackward,
            allow_cancel = @allowCancel,
            is_active = @isActive,
            updated_by_user_id = @updatedBy,
            updated_at = sysutcdatetime()
        where workflow_key = @workflowKey;
      `)

    if (steps) {
      await new sql.Request(transaction)
        .input('workflowKey', key)
        .query('delete from dbo.application_workflow_steps where workflow_key = @workflowKey;')
      for (const step of steps) {
        await new sql.Request(transaction)
          .input('workflowKey', key)
          .input('stepId', step.step_id)
          .input('statusCode', step.status_code)
          .input('stepName', step.step_name)
          .input('sequenceNo', step.sequence_no)
          .input('isAutomatic', step.is_automatic)
          .input('requirementsJson', sql.NVarChar(sql.MAX), JSON.stringify(step.requirements))
          .input('badgeTone', step.badge_tone)
          .query(`
            insert into dbo.application_workflow_steps(
              workflow_key, step_id, status_code, step_name, sequence_no,
              is_automatic, requirements_json, badge_tone
            ) values(
              @workflowKey, @stepId, @statusCode, @stepName, @sequenceNo,
              @isAutomatic, @requirementsJson, @badgeTone
            );
          `)
      }
    }
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }

  clearApplicationWorkflowCache()
  req.app.locals.broadcastWorkspaceChange?.({
    actor: req.user?.userId || req.user?.username || '',
    moduleName: 'Work Order Workflow',
    relatedModules: [definition.module_name],
    table: 'dbo.application_workflows',
    action: 'edit',
    key: 'workflow_key',
    id: key
  })
  res.json(await getApplicationWorkflow(key, pool))
}))

export default router
