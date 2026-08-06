import { Router } from 'express'
import { getPool, sql } from '../db/pool.js'
import { assertPermission } from '../middleware/auth.js'
import { addScopeWhere } from '../middleware/scope.js'
import { getApplicationWorkflow } from '../services/applicationWorkflows.js'
import { getWorkOrderWorkflow } from '../services/workOrderWorkflow.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { bindParams } from '../utils/sqlParams.js'

const router = Router()
const scope = {
  siteColumn: 'site_code',
  departmentColumn: 'department_name',
  departmentColumns: ['assigned_department_name'],
  subDepartmentColumn: 'sub_department_code',
  ownerColumn: 'created_by_user_id'
}

const httpError = (status, message, code = 'BadRequest') => {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

const text = value => String(value ?? '').trim()
const statusCode = value => text(value).toUpperCase()
const priorityCode = value => ({ EMERGENCY: 1, HIGH: 2, MEDIUM: 3, LOW: 4 })[statusCode(value)] || 3

const reserveWorkOrderNumber = async transaction => {
  const result = await new sql.Request(transaction)
    .input('sequenceKey', 'WORK_ORDER')
    .input('lockResource', 'cafm-number-WORK_ORDER')
    .query(`
      declare @lockResult int;
      exec @lockResult = sp_getapplock
        @Resource = @lockResource,
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 10000;
      if @lockResult < 0 throw 51001, 'Unable to reserve the next work order number.', 1;

      declare @minimum bigint = isnull((select max(try_convert(bigint, work_order_num)) from dbo.work_orders), 0) + 1;
      if not exists (select 1 from dbo.number_sequences where sequence_key = @sequenceKey)
        insert into dbo.number_sequences(sequence_key, next_value) values(@sequenceKey, @minimum);
      else
        update dbo.number_sequences
        set next_value = case when next_value < @minimum then @minimum else next_value end,
            updated_at = sysutcdatetime()
        where sequence_key = @sequenceKey;

      update dbo.number_sequences
      set next_value = next_value + 1,
          updated_at = sysutcdatetime()
      output deleted.next_value as reserved_value
      where sequence_key = @sequenceKey;
    `)
  return String(result.recordset[0]?.reserved_value || '')
}

const conversionGaps = request => [
  !text(request.description) && 'Description',
  !text(request.priority) && 'Priority',
  !text(request.request_type) && 'Request type',
  !text(request.reported_by) && 'Reported by',
  !text(request.site_code) && 'Site',
  !text(request.location_code) && 'Location',
  !text(request.asset_num) && 'Asset',
  !text(request.department_name) && 'Department',
  !text(request.assigned_department_name) && 'Assigned department',
  !text(request.failure_code) && 'Failure code',
  !text(request.problem_code) && 'Problem code'
].filter(Boolean)

router.post('/:srNumber/convert', asyncHandler(async (req, res) => {
  await assertPermission(req.user, 'Job Requests', 'approve')
  await assertPermission(req.user, 'Work Orders', 'create')

  const pool = await getPool()
  const [jobWorkflow, workOrderWorkflow] = await Promise.all([
    getApplicationWorkflow('JOB_REQUEST', pool),
    getWorkOrderWorkflow(pool)
  ])
  const conversionIndex = jobWorkflow?.steps?.findIndex(step => step.requirements.includes('linked_work_order')) ?? -1
  const conversionStep = conversionIndex >= 0 ? jobWorkflow.steps[conversionIndex] : null
  if (!conversionStep) throw httpError(409, 'The Job Request workflow has no CM conversion stage.', 'WorkflowBlocked')

  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  let result
  let existing = false
  try {
    const scoped = addScopeWhere({ user: req.user, ...scope })
    const requestResult = await bindParams(new sql.Request(transaction), scoped.params)
      .input('srNumber', req.params.srNumber)
      .query(`
        select top 1 *
        from dbo.service_requests with (updlock, holdlock)
        where sr_num = @srNumber${scoped.where};
      `)
    const serviceRequest = requestResult.recordset[0]
    if (!serviceRequest) throw httpError(404, 'Job Request not found.', 'NotFound')

    if (text(serviceRequest.converted_work_order_num)) {
      const linked = await new sql.Request(transaction)
        .input('workOrderNumber', serviceRequest.converted_work_order_num)
        .query('select top 1 * from dbo.work_orders where work_order_num = @workOrderNumber;')
      if (!linked.recordset[0]) throw httpError(409, 'The linked work order is missing.', 'WorkflowBlocked')
      result = { serviceRequest, workOrder: linked.recordset[0] }
      existing = true
    } else {
      const previousStep = jobWorkflow.steps[conversionIndex - 1]
      if (previousStep && statusCode(serviceRequest.status) !== previousStep.status_code) {
        throw httpError(409, `Move the Job Request to ${previousStep.status_code} before approval and CM conversion.`, 'WorkflowBlocked')
      }

      const missing = conversionGaps(serviceRequest)
      if (missing.length) throw httpError(409, `Cannot create CM work order. Missing: ${missing.join(', ')}.`, 'WorkflowBlocked')

      const failureMatch = await new sql.Request(transaction)
        .input('failureCode', serviceRequest.failure_code)
        .input('problemCode', serviceRequest.problem_code)
        .query(`
          select top 1 failure_library_id
          from dbo.failure_library
          where failure_class_id = @failureCode and problem_code = @problemCode;
        `)
      if (!failureMatch.recordset[0]) throw httpError(409, 'Failure Code and Problem Code must be a valid pair from the Failure Library.', 'WorkflowBlocked')

      const workOrderNumber = await reserveWorkOrderNumber(transaction)
      const insertedWorkOrder = await new sql.Request(transaction)
        .input('workOrderNumber', workOrderNumber)
        .input('description', serviceRequest.description)
        .input('longDescription', sql.NVarChar(sql.MAX), serviceRequest.long_description || null)
        .input('locationCode', serviceRequest.location_code)
        .input('assetNum', serviceRequest.asset_num)
        .input('status', workOrderWorkflow.initial_status)
        .input('priority', priorityCode(serviceRequest.priority))
        .input('siteCode', serviceRequest.site_code)
        .input('departmentName', serviceRequest.department_name)
        .input('subDepartmentCode', serviceRequest.sub_department_code || null)
        .input('assignedDepartmentName', serviceRequest.assigned_department_name || serviceRequest.department_name)
        .input('sourceSrNumber', serviceRequest.sr_num)
        .input('failureCode', serviceRequest.failure_code)
        .input('problemCode', serviceRequest.problem_code)
        .input('ptwRequired', workOrderWorkflow.ptw_required_default)
        .input('createdBy', serviceRequest.created_by_user_id || req.user?.userId || null)
        .query(`
          insert into dbo.work_orders(
            work_order_num, description, long_description, location_code, asset_num,
            status, work_type, priority, site_code, department_name, sub_department_code,
            assigned_department_name, reported_at, source_sr_num, failure_code, problem_code,
            ptw_required, created_by_user_id
          )
          output inserted.*
          values(
            @workOrderNumber, @description, @longDescription, @locationCode, @assetNum,
            @status, 'CM', @priority, @siteCode, @departmentName, @subDepartmentCode,
            @assignedDepartmentName, sysutcdatetime(), @sourceSrNumber, @failureCode, @problemCode,
            @ptwRequired, @createdBy
          );
        `)
      const updatedRequest = await new sql.Request(transaction)
        .input('srNumber', serviceRequest.sr_num)
        .input('workOrderNumber', workOrderNumber)
        .input('status', conversionStep.status_code)
        .query(`
          update dbo.service_requests
          set converted_work_order_num = @workOrderNumber,
              status = @status,
              updated_at = sysutcdatetime()
          output inserted.*
          where sr_num = @srNumber;
        `)
      result = { serviceRequest: updatedRequest.recordset[0], workOrder: insertedWorkOrder.recordset[0] }
    }
    await transaction.commit()
  } catch (error) {
    await transaction.rollback().catch(() => {})
    throw error
  }

  if (!existing) {
    const sharedChange = {
      actor: req.user?.userId || req.user?.username || '',
      ownerUserId: result.serviceRequest.created_by_user_id || null,
      siteCode: result.serviceRequest.site_code,
      department: result.serviceRequest.department_name
    }
    req.app.locals.broadcastWorkspaceChange?.({
      ...sharedChange,
      moduleName: 'Job Requests',
      relatedModules: ['Work Orders', 'Overview'],
      table: 'dbo.service_requests',
      action: 'convert',
      key: 'sr_num',
      id: result.serviceRequest.sr_num
    })
    req.app.locals.broadcastWorkspaceChange?.({
      ...sharedChange,
      moduleName: 'Work Orders',
      relatedModules: ['Job Requests', 'Overview'],
      table: 'dbo.work_orders',
      action: 'create',
      key: 'work_order_num',
      id: result.workOrder.work_order_num
    })
  }
  res.status(existing ? 200 : 201).json({ ...result, existing })
}))

export default router
