import { Router } from 'express'
import { getPool, sql } from '../db/pool.js'
import { assertPermission, requirePermission } from '../middleware/auth.js'
import { addScopeWhere, applyScopeDefaults, assertPayloadWithinScope } from '../middleware/scope.js'
import { bindParams } from '../utils/sqlParams.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getApplicationWorkflow } from '../services/applicationWorkflows.js'

const router = Router()
const departmentScope = { siteColumn: 'site_code', departmentColumn: 'department_name', ownerColumn: 'created_by_user_id' }
const workOrderScope = {
  siteColumn: 'site_code',
  departmentColumn: 'department_name',
  departmentColumns: ['assigned_department_name'],
  subDepartmentColumn: 'sub_department_code',
  ownerColumn: 'created_by_user_id'
}

const httpError = (status, message, code = 'SupplyChainError') => {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

const positiveQuantity = (value, label = 'Quantity') => {
  const quantity = Number(value)
  if (!Number.isFinite(quantity) || quantity <= 0) throw httpError(400, `${label} must be greater than zero.`)
  return quantity
}
const isToolRequest = value => ['TOOL', 'EQUIPMENT'].includes(String(value || '').toUpperCase())
const isMaterialRequest = value => !isToolRequest(value)

const requestFor = (transaction, params = {}) => bindParams(new sql.Request(transaction), params)

const withTransaction = async handler => {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
  try {
    const result = await handler(transaction)
    await transaction.commit()
    return result
  } catch (error) {
    await transaction.rollback().catch(() => {})
    throw error
  }
}

const reserveAnnualNumber = async (transaction, { sequenceName, prefixName, table, column }) => {
  const year = new Date().getUTCFullYear()
  const prefix = `${prefixName}-${year}-`
  const sequenceKey = `${sequenceName}_${year}`
  const result = await requestFor(transaction, { sequenceKey, prefix, lockResource: `cafm-number-${sequenceKey}` }).query(`
    declare @lockResult int;
    exec @lockResult = sp_getapplock
      @Resource = @lockResource,
      @LockMode = 'Exclusive',
      @LockOwner = 'Transaction',
      @LockTimeout = 10000;
    if @lockResult < 0 throw 51001, 'Unable to reserve the next supply-chain number.', 1;

    declare @minimum bigint = isnull((
      select max(try_convert(bigint, substring(${column}, len(@prefix) + 1, 30)))
      from ${table}
      where ${column} like @prefix + '%'
    ), 0) + 1;

    if not exists (select 1 from dbo.number_sequences with (updlock, holdlock) where sequence_key = @sequenceKey)
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
  return `${prefix}${String(Number(result.recordset[0]?.reserved_value)).padStart(4, '0')}`
}

const nextPrNumber = transaction => reserveAnnualNumber(transaction, {
  sequenceName: 'PURCHASE_REQUEST', prefixName: 'PR', table: 'dbo.purchase_requisitions', column: 'pr_num'
})
const nextPoNumber = transaction => reserveAnnualNumber(transaction, {
  sequenceName: 'PURCHASE_ORDER', prefixName: 'PO', table: 'dbo.purchase_orders', column: 'po_num'
})
const nextReservationNumber = (transaction, requestType) => {
  const allocation = isToolRequest(requestType)
  return reserveAnnualNumber(transaction, {
    sequenceName: allocation ? 'ALLOCATION' : 'RESERVATION',
    prefixName: allocation ? 'ALC' : 'RSV',
    table: 'dbo.inventory_reservations',
    column: 'reservation_num'
  })
}

const selectScopedWorkOrder = async (transaction, user, workOrderNumber, lock = false) => {
  const scoped = addScopeWhere({ user, ...workOrderScope })
  const result = await requestFor(transaction, { ...scoped.params, workOrderNumber }).query(`
    select top 1 *
    from dbo.work_orders${lock ? ' with (updlock, holdlock)' : ''}
    where work_order_num = @workOrderNumber${scoped.where}
  `)
  if (!result.recordset[0]) throw httpError(404, 'Work order not found or outside your access scope.', 'NotFound')
  return result.recordset[0]
}

const selectScopedResource = async (transaction, user, resourceRequestId, lock = false) => {
  const scoped = addScopeWhere({ user, ...departmentScope })
  const result = await requestFor(transaction, { ...scoped.params, resourceRequestId }).query(`
    select top 1 *
    from dbo.work_order_resource_requests${lock ? ' with (updlock, holdlock)' : ''}
    where resource_request_id = @resourceRequestId${scoped.where}
  `)
  if (!result.recordset[0]) throw httpError(404, 'Resource request not found or outside your access scope.', 'NotFound')
  return result.recordset[0]
}

const selectScopedPr = async (transaction, user, prNumber, lock = false) => {
  const scoped = addScopeWhere({ user, ...departmentScope })
  const result = await requestFor(transaction, { ...scoped.params, prNumber }).query(`
    select top 1 *
    from dbo.purchase_requisitions${lock ? ' with (updlock, holdlock)' : ''}
    where pr_num = @prNumber${scoped.where}
  `)
  if (!result.recordset[0]) throw httpError(404, 'Purchase requisition not found or outside your access scope.', 'NotFound')
  return result.recordset[0]
}

const selectScopedPo = async (transaction, user, poNumber, lock = false) => {
  const scoped = addScopeWhere({ user, ...departmentScope })
  const result = await requestFor(transaction, { ...scoped.params, poNumber }).query(`
    select top 1 *
    from dbo.purchase_orders${lock ? ' with (updlock, holdlock)' : ''}
    where po_num = @poNumber${scoped.where}
  `)
  if (!result.recordset[0]) throw httpError(404, 'Purchase order not found or outside your access scope.', 'NotFound')
  return result.recordset[0]
}

const resolveStore = async (transaction, value, siteCode, { required = false } = {}) => {
  const result = await requestFor(transaction, { value: String(value || '').trim(), siteCode }).query(`
    select top 1 store_code, store_name, site_code
    from dbo.storerooms with (holdlock)
    where status <> 'Inactive'
      and (@siteCode is null or site_code = @siteCode)
      and (@value = '' or store_code = @value or store_name = @value)
    order by case when store_code = @value then 0 when store_name = @value then 1 else 2 end, store_code
  `)
  const store = result.recordset[0]
  if (!store && required) throw httpError(400, 'A valid active store is required for this transaction.')
  return store || null
}

const resolveItem = async (transaction, requestType, value, description = '') => {
  const tool = isToolRequest(requestType)
  const result = await requestFor(transaction, { value: String(value || '').trim(), description: String(description || '').trim() }).query(tool ? `
    select top 1 tool_code as item_code, description
    from dbo.tools_equipment with (holdlock)
    where tool_code = @value or description = @value or (@value = '' and description = @description)
    order by case when tool_code = @value then 0 else 1 end
  ` : `
    select top 1 item_code, description
    from dbo.materials with (holdlock)
    where item_code = @value or description = @value or (@value = '' and description = @description)
    order by case when item_code = @value then 0 else 1 end
  `)
  if (!result.recordset[0]) throw httpError(400, `${tool ? 'Tool' : 'Material'} is not present in master data.`)
  return result.recordset[0]
}

const updateResourceLink = async (transaction, resourceRequestId, patch) => {
  if (!resourceRequestId) return
  const columns = Object.keys(patch).filter(key => patch[key] !== undefined)
  if (!columns.length) return
  await requestFor(transaction, { resourceRequestId, ...patch }).query(`
    update dbo.work_order_resource_requests
    set ${columns.map(column => `${column} = @${column}`).join(', ')}, updated_at = sysutcdatetime()
    where resource_request_id = @resourceRequestId
  `)
}

const ensureReservation = async (transaction, user, input) => {
  const workOrderNumber = String(input.work_order_num || '').trim()
  if (!workOrderNumber) throw httpError(400, 'A work order is required for a reservation or allocation.')
  const workOrder = await selectScopedWorkOrder(transaction, user, workOrderNumber, true)
  const resource = input.resource_request_id ? await selectScopedResource(transaction, user, input.resource_request_id, true) : null
  const requestType = String(input.request_type || resource?.resource_type || 'Material')
  const item = await resolveItem(transaction, requestType, input.item_code || resource?.item_code || input.item_description || resource?.item_description, input.item_description || resource?.item_description)
  const quantity = positiveQuantity(input.reserved_quantity ?? input.quantity ?? resource?.requested_quantity, 'Reserved quantity')
  const material = isMaterialRequest(requestType)
  const store = await resolveStore(transaction, input.store_code || resource?.store_code, workOrder.site_code, { required: material })
  const matchParams = {
    resourceRequestId: resource?.resource_request_id || null,
    workOrderNumber,
    requestType,
    itemCode: item.item_code
  }
  const existingResult = await requestFor(transaction, matchParams).query(`
    select top 1 *
    from dbo.inventory_reservations with (updlock, holdlock)
    where status not in ('CANCELLED', 'CAN', 'COMPLETE')
      and ((@resourceRequestId is not null and resource_request_id = @resourceRequestId)
        or (@resourceRequestId is null and work_order_num = @workOrderNumber and request_type = @requestType and item_code = @itemCode))
    order by created_at
  `)
  const existing = existingResult.recordset[0]
  const previousQuantity = Number(existing?.reserved_quantity || 0)
  const desiredQuantity = existing ? Math.max(previousQuantity, quantity) : quantity
  const reserveDelta = Math.max(0, desiredQuantity - previousQuantity)

  if (material && reserveDelta) {
    const stockResult = await requestFor(transaction, { storeCode: store.store_code, itemCode: item.item_code }).query(`
      select balance, reserved_quantity, reorder_point
      from dbo.inventory_stock with (updlock, holdlock)
      where store_code = @storeCode and item_code = @itemCode
    `)
    const stock = stockResult.recordset[0]
    if (!stock || Number(stock.balance) - Number(stock.reserved_quantity) < reserveDelta) {
      throw httpError(409, 'The selected store does not have enough available stock.', 'InsufficientStock')
    }
    await requestFor(transaction, { storeCode: store.store_code, itemCode: item.item_code, reserveDelta }).query(`
      update dbo.inventory_stock
      set reserved_quantity = reserved_quantity + @reserveDelta, updated_at = sysutcdatetime()
      where store_code = @storeCode and item_code = @itemCode
    `)
  }

  let reservation
  if (existing) {
    const result = await requestFor(transaction, {
      reservationNumber: existing.reservation_num,
      quantity: desiredQuantity,
      resourceRequestId: resource?.resource_request_id || existing.resource_request_id,
      prNumber: input.pr_num || existing.pr_num,
      poNumber: input.po_num || existing.po_num,
      storeCode: store?.store_code || existing.store_code,
      itemCode: item.item_code,
      itemDescription: item.description
    }).query(`
      update dbo.inventory_reservations
      set reserved_quantity = @quantity,
          resource_request_id = @resourceRequestId,
          pr_num = @prNumber,
          po_num = @poNumber,
          store_code = @storeCode,
          item_code = @itemCode,
          item_description = @itemDescription,
          updated_at = sysutcdatetime()
      output inserted.*
      where reservation_num = @reservationNumber
    `)
    reservation = result.recordset[0]
  } else {
    const reservationNumber = await nextReservationNumber(transaction, requestType)
    const result = await requestFor(transaction, {
      reservationNumber,
      workOrderNumber,
      resourceRequestId: resource?.resource_request_id || null,
      prNumber: input.pr_num || null,
      poNumber: input.po_num || null,
      requestType,
      itemCode: item.item_code,
      itemDescription: item.description,
      quantity,
      storeCode: store?.store_code || null,
      siteCode: workOrder.site_code,
      departmentName: workOrder.department_name || input.department_name || null,
      createdBy: user?.userId || null
    }).query(`
      insert into dbo.inventory_reservations(
        reservation_num, work_order_num, resource_request_id, pr_num, po_num, request_type,
        item_code, item_description, reserved_quantity, store_code, site_code, department_name,
        status, created_by_user_id
      )
      output inserted.*
      values(
        @reservationNumber, @workOrderNumber, @resourceRequestId, @prNumber, @poNumber, @requestType,
        @itemCode, @itemDescription, @quantity, @storeCode, @siteCode, @departmentName,
        'ENTERED', @createdBy
      )
    `)
    reservation = result.recordset[0]
  }
  await updateResourceLink(transaction, resource?.resource_request_id, {
    request_status: reservation.status,
    transaction_ref: reservation.reservation_num,
    purchase_request_num: reservation.pr_num,
    purchase_order_num: reservation.po_num,
    reservation_num: reservation.reservation_num,
    supply_chain_status: 'Reservation entered'
  })
  return reservation
}

const emitChanges = (req, changes) => {
  changes.forEach(change => req.app.locals.broadcastWorkspaceChange?.({
    actor: req.user?.userId || req.user?.username || '',
    ...change
  }))
}

router.post('/purchase-requisitions', requirePermission('Purchase Requisitions', 'create'), asyncHandler(async (req, res) => {
  const result = await withTransaction(async transaction => {
    const resource = req.body.resource_request_id ? await selectScopedResource(transaction, req.user, req.body.resource_request_id, true) : null
    const workOrder = !resource && req.body.work_order_num ? await selectScopedWorkOrder(transaction, req.user, req.body.work_order_num, true) : null
    const scopedPayload = applyScopeDefaults({ user: req.user, payload: { ...req.body }, siteColumn: 'site_code', departmentColumn: 'department_name' })
    const requestType = String(scopedPayload.request_type || resource?.resource_type || 'Material')
    const item = await resolveItem(transaction, requestType, scopedPayload.item_code || resource?.item_code || scopedPayload.item_description || resource?.item_description, scopedPayload.item_description || resource?.item_description)
    const quantity = positiveQuantity(scopedPayload.requested_quantity ?? resource?.requested_quantity, 'Requested quantity')
    let siteCode = resource?.site_code || workOrder?.site_code || scopedPayload.site_code || null
    const departmentName = resource?.department_name || workOrder?.department_name || scopedPayload.department_name || req.user?.departmentNames?.[0] || null
    const store = await resolveStore(transaction, scopedPayload.store_code || resource?.store_code, siteCode, { required: true })
    siteCode = siteCode || store?.site_code || req.user?.siteCodes?.[0] || null
    if (!siteCode) throw httpError(400, 'Site is required for a purchase requisition.')
    if (!resource && !workOrder) {
      assertPayloadWithinScope({
        user: req.user,
        payload: { ...scopedPayload, site_code: siteCode, department_name: departmentName },
        ...departmentScope,
        requireValues: true
      })
    }
    if (resource) {
      const duplicate = await requestFor(transaction, { resourceRequestId: resource.resource_request_id }).query(`
        select top 1 * from dbo.purchase_requisitions with (updlock, holdlock)
        where resource_request_id = @resourceRequestId and status <> 'CAN'
        order by created_at
      `)
      if (duplicate.recordset[0]) return { purchaseRequisition: duplicate.recordset[0], existing: true }
    }
    const prNumber = await nextPrNumber(transaction)
    const inserted = await requestFor(transaction, {
      prNumber,
      workOrderNumber: resource?.work_order_num || workOrder?.work_order_num || scopedPayload.work_order_num || null,
      resourceRequestId: resource?.resource_request_id || null,
      requestType,
      itemCode: item.item_code,
      itemDescription: item.description,
      requestedQuantity: quantity,
      plannedQuantity: Number(scopedPayload.planned_quantity ?? resource?.requested_quantity ?? quantity),
      availableQuantity: Number(scopedPayload.available_quantity ?? resource?.available_quantity ?? 0),
      storeCode: store?.store_code || null,
      siteCode,
      departmentName,
      createdBy: req.user?.userId || null
    }).query(`
      insert into dbo.purchase_requisitions(
        pr_num, work_order_num, resource_request_id, request_type, item_code, item_description,
        requested_quantity, planned_quantity, available_quantity, store_code, site_code,
        department_name, status, created_by_user_id
      )
      output inserted.*
      values(
        @prNumber, @workOrderNumber, @resourceRequestId, @requestType, @itemCode, @itemDescription,
        @requestedQuantity, @plannedQuantity, @availableQuantity, @storeCode, @siteCode,
        @departmentName, 'WAPPR', @createdBy
      )
    `)
    const purchaseRequisition = inserted.recordset[0]
    await updateResourceLink(transaction, resource?.resource_request_id, {
      request_status: 'WAPPR',
      transaction_ref: prNumber,
      purchase_request_num: prNumber,
      supply_chain_status: 'PR waiting approval'
    })
    return { purchaseRequisition, existing: false }
  })
  emitChanges(req, [
    { moduleName: 'Purchase Requisitions', relatedModules: ['Work Orders', 'Materials', 'Tools & Equipment'], table: 'dbo.purchase_requisitions', action: result.existing ? 'edit' : 'create', id: result.purchaseRequisition.pr_num },
    ...(result.purchaseRequisition.resource_request_id ? [{ moduleName: 'Work Orders', relatedModules: ['Purchase Requisitions'], table: 'dbo.work_order_resource_requests', action: 'edit', id: result.purchaseRequisition.resource_request_id }] : [])
  ])
  res.status(result.existing ? 200 : 201).json(result)
}))

router.post('/purchase-requisitions/:prNumber/approve-create-po', asyncHandler(async (req, res) => {
  await assertPermission(req.user, 'Purchase Requisitions', 'approve')
  await assertPermission(req.user, 'Purchase Orders', 'create')
  const result = await withTransaction(async transaction => {
    const purchaseRequisition = await selectScopedPr(transaction, req.user, req.params.prNumber, true)
    if (purchaseRequisition.status === 'CAN') throw httpError(409, 'A cancelled purchase requisition cannot create a purchase order.')
    const existing = await requestFor(transaction, { prNumber: purchaseRequisition.pr_num }).query(`
      select top 1 * from dbo.purchase_orders with (updlock, holdlock) where pr_num = @prNumber order by created_at
    `)
    if (existing.recordset[0]) {
      const purchaseOrder = existing.recordset[0]
      const reconciled = await requestFor(transaction, { prNumber: purchaseRequisition.pr_num, poNumber: purchaseOrder.po_num }).query(`
        update dbo.purchase_requisitions
        set status = 'APPR', po_num = @poNumber, approved_at = coalesce(approved_at, sysutcdatetime()), updated_at = sysutcdatetime()
        output inserted.*
        where pr_num = @prNumber
      `)
      await updateResourceLink(transaction, purchaseRequisition.resource_request_id, {
        request_status: 'APPR',
        transaction_ref: purchaseOrder.po_num,
        purchase_request_num: purchaseRequisition.pr_num,
        purchase_order_num: purchaseOrder.po_num,
        supply_chain_status: 'PO waiting approval'
      })
      return { purchaseRequisition: reconciled.recordset[0], purchaseOrder, existing: true }
    }
    const poNumber = await nextPoNumber(transaction)
    const inserted = await requestFor(transaction, {
      poNumber,
      prNumber: purchaseRequisition.pr_num,
      workOrderNumber: purchaseRequisition.work_order_num,
      resourceRequestId: purchaseRequisition.resource_request_id,
      requestType: purchaseRequisition.request_type,
      itemCode: purchaseRequisition.item_code,
      itemDescription: purchaseRequisition.item_description,
      orderedQuantity: purchaseRequisition.requested_quantity,
      storeCode: purchaseRequisition.store_code,
      siteCode: purchaseRequisition.site_code,
      departmentName: purchaseRequisition.department_name,
      createdBy: req.user?.userId || null
    }).query(`
      insert into dbo.purchase_orders(
        po_num, pr_num, work_order_num, resource_request_id, request_type, item_code,
        item_description, ordered_quantity, store_code, site_code, department_name,
        status, created_by_user_id
      )
      output inserted.*
      values(
        @poNumber, @prNumber, @workOrderNumber, @resourceRequestId, @requestType, @itemCode,
        @itemDescription, @orderedQuantity, @storeCode, @siteCode, @departmentName,
        'WAPPR', @createdBy
      )
    `)
    const purchaseOrder = inserted.recordset[0]
    const updatedPr = await requestFor(transaction, { prNumber: purchaseRequisition.pr_num, poNumber }).query(`
      update dbo.purchase_requisitions
      set status = 'APPR', po_num = @poNumber, approved_at = coalesce(approved_at, sysutcdatetime()), updated_at = sysutcdatetime()
      output inserted.*
      where pr_num = @prNumber
    `)
    await updateResourceLink(transaction, purchaseRequisition.resource_request_id, {
      request_status: 'APPR',
      transaction_ref: poNumber,
      purchase_request_num: purchaseRequisition.pr_num,
      purchase_order_num: poNumber,
      supply_chain_status: 'PO waiting approval'
    })
    return { purchaseRequisition: updatedPr.recordset[0], purchaseOrder, existing: false }
  })
  emitChanges(req, [
    { moduleName: 'Purchase Orders', relatedModules: ['Purchase Requisitions', 'Work Orders'], table: 'dbo.purchase_orders', action: result.existing ? 'edit' : 'create', id: result.purchaseOrder.po_num },
    { moduleName: 'Purchase Requisitions', relatedModules: ['Purchase Orders'], table: 'dbo.purchase_requisitions', action: 'edit', id: result.purchaseRequisition.pr_num }
  ])
  res.status(result.existing ? 200 : 201).json(result)
}))

router.post('/purchase-requisitions/:prNumber/transition', asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').toUpperCase()
  const workflow = await getApplicationWorkflow('SUPPLY_CHAIN')
  if (!status) throw httpError(400, 'Status is required.')
  if (status === 'CAN' && workflow?.is_active && !workflow.allow_cancel) throw httpError(409, 'Supply Chain workflow does not allow cancellation.')
  if (status === 'APPR') throw httpError(400, 'Use Approve and Create PO so approval and PO creation are atomic.', 'CommandRequired')
  if (!['WAPPR', 'CLOSE', 'CAN'].includes(status)) throw httpError(400, `Unsupported purchase requisition status: ${status}.`)
  await assertPermission(req.user, 'Purchase Requisitions', ['APPR'].includes(status) ? 'approve' : ['CLOSE', 'CAN'].includes(status) ? 'close' : 'edit')
  const purchaseRequisition = await withTransaction(async transaction => {
    const current = await selectScopedPr(transaction, req.user, req.params.prNumber, true)
    if (['CLOSE', 'CAN'].includes(current.status) && status !== current.status) throw httpError(409, `Purchase requisition ${current.pr_num} is already ${current.status}.`)
    if (status === 'WAPPR' && current.status === 'APPR' && workflow?.is_active && !workflow.allow_backward_transition) throw httpError(409, 'Supply Chain workflow does not allow backward transitions.')
    const updated = await requestFor(transaction, { prNumber: current.pr_num, status }).query(`
      update dbo.purchase_requisitions
      set status = @status,
          approved_at = case when @status = 'APPR' then coalesce(approved_at, sysutcdatetime()) else approved_at end,
          closed_at = case when @status = 'CLOSE' then coalesce(closed_at, sysutcdatetime()) else closed_at end,
          cancelled_at = case when @status = 'CAN' then coalesce(cancelled_at, sysutcdatetime()) else cancelled_at end,
          updated_at = sysutcdatetime()
      output inserted.*
      where pr_num = @prNumber
    `)
    const row = updated.recordset[0]
    await updateResourceLink(transaction, row.resource_request_id, {
      request_status: row.status,
      transaction_ref: row.po_num || row.pr_num,
      purchase_request_num: row.pr_num,
      purchase_order_num: row.po_num,
      supply_chain_status: `PR ${row.status}`
    })
    return row
  })
  emitChanges(req, [{ moduleName: 'Purchase Requisitions', relatedModules: ['Work Orders', 'Purchase Orders'], table: 'dbo.purchase_requisitions', action: 'edit', id: purchaseRequisition.pr_num }])
  res.json({ purchaseRequisition })
}))

router.post('/purchase-orders/:poNumber/transition', asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').toUpperCase()
  const workflow = await getApplicationWorkflow('SUPPLY_CHAIN')
  if (!status) throw httpError(400, 'Status is required.')
  if (status === 'CAN' && workflow?.is_active && !workflow.allow_cancel) throw httpError(409, 'Supply Chain workflow does not allow cancellation.')
  if (status === 'CLOSE') throw httpError(400, 'Use the receive command to close and post a purchase order.')
  if (!['WAPPR', 'APPR', 'INPRG', 'CAN'].includes(status)) throw httpError(400, `Unsupported purchase order status: ${status}.`)
  await assertPermission(req.user, 'Purchase Orders', status === 'APPR' ? 'approve' : status === 'CAN' ? 'close' : 'edit')
  const purchaseOrder = await withTransaction(async transaction => {
    const current = await selectScopedPo(transaction, req.user, req.params.poNumber, true)
    const allowed = {
      WAPPR: ['WAPPR', 'APPR', 'CAN'],
      APPR: ['APPR', 'INPRG', 'CAN', ...(workflow?.is_active && workflow.allow_backward_transition ? ['WAPPR'] : [])],
      INPRG: ['INPRG', 'CAN', ...(workflow?.is_active && workflow.allow_backward_transition ? ['APPR'] : [])],
      CAN: ['CAN'],
      CLOSE: ['CLOSE']
    }[String(current.status).toUpperCase()] || []
    if (!allowed.includes(status)) throw httpError(409, `Purchase order transition ${current.status} to ${status} is not allowed.`)
    const updated = await requestFor(transaction, { poNumber: current.po_num, status }).query(`
      update dbo.purchase_orders
      set status = @status,
          approved_at = case when @status = 'APPR' then coalesce(approved_at, sysutcdatetime()) else approved_at end,
          cancelled_at = case when @status = 'CAN' then coalesce(cancelled_at, sysutcdatetime()) else cancelled_at end,
          updated_at = sysutcdatetime()
      output inserted.*
      where po_num = @poNumber
    `)
    const row = updated.recordset[0]
    await updateResourceLink(transaction, row.resource_request_id, {
      request_status: row.status,
      transaction_ref: row.po_num,
      purchase_request_num: row.pr_num,
      purchase_order_num: row.po_num,
      supply_chain_status: `PO ${row.status}`
    })
    return row
  })
  emitChanges(req, [{ moduleName: 'Purchase Orders', relatedModules: ['Work Orders', 'Purchase Requisitions'], table: 'dbo.purchase_orders', action: 'edit', id: purchaseOrder.po_num }])
  res.json({ purchaseOrder })
}))

router.post('/reservations', requirePermission('Reservations', 'create'), asyncHandler(async (req, res) => {
  const reservation = await withTransaction(transaction => ensureReservation(transaction, req.user, req.body || {}))
  emitChanges(req, [
    { moduleName: 'Reservations', relatedModules: ['Work Orders', 'Stores', 'Materials', 'Tools & Equipment'], table: 'dbo.inventory_reservations', action: 'create', id: reservation.reservation_num },
    ...(isMaterialRequest(reservation.request_type) ? [{ moduleName: 'Stores', relatedModules: ['Materials', 'Reservations'], table: 'dbo.inventory_stock', action: 'edit', id: `${reservation.store_code}/${reservation.item_code}` }] : [])
  ])
  res.status(201).json({ reservation })
}))

router.post('/purchase-orders/:poNumber/receive', asyncHandler(async (req, res) => {
  await assertPermission(req.user, 'Purchase Orders', 'close')
  await assertPermission(req.user, 'Reservations', 'create')
  const result = await withTransaction(async transaction => {
    let purchaseOrder = await selectScopedPo(transaction, req.user, req.params.poNumber, true)
    if (purchaseOrder.status === 'CAN') throw httpError(409, 'A cancelled purchase order cannot be received.')
    if (purchaseOrder.status === 'CLOSE') {
      const existingReservation = await requestFor(transaction, { poNumber: purchaseOrder.po_num }).query(`select top 1 * from dbo.inventory_reservations where po_num = @poNumber order by created_at`)
      const existingPr = await requestFor(transaction, { prNumber: purchaseOrder.pr_num }).query('select top 1 * from dbo.purchase_requisitions where pr_num = @prNumber')
      return { purchaseOrder, purchaseRequisition: existingPr.recordset[0] || null, reservation: existingReservation.recordset[0] || null, inventoryStock: null, tool: null, existing: true }
    }
    const quantity = positiveQuantity(purchaseOrder.ordered_quantity, 'Ordered quantity')
    const material = isMaterialRequest(purchaseOrder.request_type)
    const item = await resolveItem(transaction, purchaseOrder.request_type, purchaseOrder.item_code, purchaseOrder.item_description)
    const store = await resolveStore(transaction, purchaseOrder.store_code, purchaseOrder.site_code, { required: material })
    let inventoryStock = null
    let tool = null
    if (material) {
      let stockResult = await requestFor(transaction, { storeCode: store.store_code, itemCode: item.item_code, quantity }).query(`
        update dbo.inventory_stock with (updlock, holdlock)
        set balance = balance + @quantity, updated_at = sysutcdatetime()
        output inserted.*
        where store_code = @storeCode and item_code = @itemCode
      `)
      if (!stockResult.recordset[0]) {
        stockResult = await requestFor(transaction, { storeCode: store.store_code, itemCode: item.item_code, quantity }).query(`
          insert into dbo.inventory_stock(store_code, item_code, balance, reserved_quantity)
          output inserted.*
          values(@storeCode, @itemCode, @quantity, 0)
        `)
      }
      inventoryStock = stockResult.recordset[0] || null
    } else {
      const toolResult = await requestFor(transaction, { itemCode: item.item_code, quantity, storeCode: store?.store_code || purchaseOrder.store_code || null }).query(`
        update dbo.tools_equipment
        set quantity = quantity + @quantity,
            location_code = coalesce(@storeCode, location_code),
            status = case when status = 'Maintenance' then status else 'Available' end,
            updated_at = sysutcdatetime()
        output inserted.*
        where tool_code = @itemCode
      `)
      tool = toolResult.recordset[0] || null
    }
    const updatedPo = await requestFor(transaction, { poNumber: purchaseOrder.po_num, storeCode: store?.store_code || purchaseOrder.store_code || null }).query(`
      update dbo.purchase_orders
      set status = 'CLOSE', store_code = @storeCode, approved_at = coalesce(approved_at, sysutcdatetime()),
          received_at = coalesce(received_at, sysutcdatetime()), closed_at = coalesce(closed_at, sysutcdatetime()),
          updated_at = sysutcdatetime()
      output inserted.*
      where po_num = @poNumber
    `)
    purchaseOrder = updatedPo.recordset[0]
    const updatedPr = await requestFor(transaction, { prNumber: purchaseOrder.pr_num, poNumber: purchaseOrder.po_num }).query(`
      update dbo.purchase_requisitions
      set status = 'CLOSE', po_num = @poNumber, approved_at = coalesce(approved_at, sysutcdatetime()),
          closed_at = coalesce(closed_at, sysutcdatetime()), updated_at = sysutcdatetime()
      output inserted.*
      where pr_num = @prNumber
    `)
    const purchaseRequisition = updatedPr.recordset[0] || null
    const reservation = purchaseOrder.work_order_num ? await ensureReservation(transaction, req.user, {
      work_order_num: purchaseOrder.work_order_num,
      resource_request_id: purchaseOrder.resource_request_id,
      pr_num: purchaseOrder.pr_num,
      po_num: purchaseOrder.po_num,
      request_type: purchaseOrder.request_type,
      item_code: item.item_code,
      item_description: item.description,
      reserved_quantity: quantity,
      store_code: store?.store_code || purchaseOrder.store_code
    }) : null
    await updateResourceLink(transaction, purchaseOrder.resource_request_id, {
      request_status: reservation?.status || 'CLOSE',
      transaction_ref: reservation?.reservation_num || purchaseOrder.po_num,
      purchase_request_num: purchaseOrder.pr_num,
      purchase_order_num: purchaseOrder.po_num,
      reservation_num: reservation?.reservation_num || null,
      supply_chain_status: reservation ? 'Received and reserved' : 'Purchase received'
    })
    return { purchaseOrder, purchaseRequisition, reservation, inventoryStock, tool, existing: false }
  })
  emitChanges(req, [
    { moduleName: 'Purchase Orders', relatedModules: ['Purchase Requisitions', 'Stores', 'Materials', 'Tools & Equipment', 'Reservations'], table: 'dbo.purchase_orders', action: 'edit', id: result.purchaseOrder.po_num },
    { moduleName: 'Purchase Requisitions', relatedModules: ['Purchase Orders'], table: 'dbo.purchase_requisitions', action: 'edit', id: result.purchaseOrder.pr_num },
    { moduleName: isMaterialRequest(result.purchaseOrder.request_type) ? 'Materials' : 'Tools & Equipment', relatedModules: ['Stores'], table: isMaterialRequest(result.purchaseOrder.request_type) ? 'dbo.inventory_stock' : 'dbo.tools_equipment', action: 'edit', id: result.purchaseOrder.item_code },
    ...(result.reservation ? [{ moduleName: 'Reservations', relatedModules: ['Work Orders'], table: 'dbo.inventory_reservations', action: result.existing ? 'edit' : 'create', id: result.reservation.reservation_num }] : [])
  ])
  res.json(result)
}))

router.post('/reservations/:reservationNumber/transition', requirePermission('Reservations', 'edit'), asyncHandler(async (req, res) => {
  const workflow = await getApplicationWorkflow('SUPPLY_CHAIN')
  const result = await withTransaction(async transaction => {
    const scoped = addScopeWhere({ user: req.user, ...departmentScope })
    const currentResult = await requestFor(transaction, { ...scoped.params, reservationNumber: req.params.reservationNumber }).query(`
      select top 1 * from dbo.inventory_reservations with (updlock, holdlock)
      where reservation_num = @reservationNumber${scoped.where}
    `)
    const current = currentResult.recordset[0]
    if (!current) throw httpError(404, 'Reservation not found or outside your access scope.', 'NotFound')
    const quantity = Number(current.reserved_quantity)
    const arranged = Number(req.body.arranged_quantity ?? current.arranged_quantity)
    const released = Number(req.body.released_quantity ?? current.released_quantity)
    const delivered = Number(req.body.delivered_quantity ?? current.delivered_quantity)
    const status = String(req.body.status || current.status).toUpperCase()
    if (!['ENTERED', 'STAGED', 'COMPLETE', 'CANCELLED', 'CAN'].includes(status)) throw httpError(400, `Unsupported reservation status: ${status}.`)
    if (['CANCELLED', 'CAN'].includes(status) && workflow?.is_active && !workflow.allow_cancel) throw httpError(409, 'Supply Chain workflow does not allow cancellation.')
    const currentStatus = String(current.status || '').toUpperCase()
    const reservationOrder = ['ENTERED', 'STAGED', 'COMPLETE']
    const currentIndex = reservationOrder.indexOf(currentStatus)
    const nextIndex = reservationOrder.indexOf(status)
    if (currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex && workflow?.is_active && !workflow.allow_backward_transition) throw httpError(409, 'Supply Chain workflow does not allow backward transitions.')
    if ([arranged, released, delivered].some(value => !Number.isFinite(value) || value < 0 || value > quantity)) throw httpError(400, 'Reservation quantities must be between zero and the reserved quantity.')
    if (released > arranged || delivered > released) throw httpError(400, 'Delivered quantity cannot exceed released quantity, and released quantity cannot exceed arranged quantity.')
    if (arranged < Number(current.arranged_quantity) || released < Number(current.released_quantity) || delivered < Number(current.delivered_quantity)) throw httpError(409, 'Arranged, released, and delivered quantities cannot be reduced.')
    if (status === 'COMPLETE' && delivered < quantity) throw httpError(409, 'A reservation can only complete after the full requested quantity is delivered.')
    const material = isMaterialRequest(current.request_type)
    const releaseDelta = released - Number(current.released_quantity)
    const cancelling = ['CANCELLED', 'CAN'].includes(status)
    if (material && (releaseDelta > 0 || cancelling)) {
      const stockResult = await requestFor(transaction, { storeCode: current.store_code, itemCode: current.item_code }).query(`
        select balance, reserved_quantity from dbo.inventory_stock with (updlock, holdlock)
        where store_code = @storeCode and item_code = @itemCode
      `)
      const stock = stockResult.recordset[0]
      if (!stock) throw httpError(409, 'Inventory stock row is missing for this reservation.')
      if (releaseDelta > Number(stock.balance) || releaseDelta > Number(stock.reserved_quantity)) throw httpError(409, 'Inventory balance is lower than the quantity being released.', 'InsufficientStock')
      const cancelledOutstanding = cancelling ? Math.max(0, quantity - released) : 0
      await requestFor(transaction, { storeCode: current.store_code, itemCode: current.item_code, releaseDelta, cancelledOutstanding }).query(`
        update dbo.inventory_stock
        set balance = balance - @releaseDelta,
            reserved_quantity = case
              when reserved_quantity - @releaseDelta - @cancelledOutstanding < 0 then 0
              else reserved_quantity - @releaseDelta - @cancelledOutstanding
            end,
            updated_at = sysutcdatetime()
        where store_code = @storeCode and item_code = @itemCode
      `)
    }
    const updated = await requestFor(transaction, {
      reservationNumber: current.reservation_num,
      arranged,
      released,
      delivered,
      status
    }).query(`
      update dbo.inventory_reservations
      set arranged_quantity = @arranged, released_quantity = @released, delivered_quantity = @delivered,
          status = @status, stock_posted_at = case when @released > 0 then coalesce(stock_posted_at, sysutcdatetime()) else stock_posted_at end,
          updated_at = sysutcdatetime()
      output inserted.*
      where reservation_num = @reservationNumber
    `)
    const row = updated.recordset[0]
    await updateResourceLink(transaction, row.resource_request_id, {
      request_status: row.status,
      transaction_ref: row.reservation_num,
      reservation_num: row.reservation_num,
      purchase_request_num: row.pr_num,
      purchase_order_num: row.po_num,
      supply_chain_status: `Reservation ${row.status}`
    })
    const inventoryStock = material && row.store_code && row.item_code
      ? (await requestFor(transaction, { storeCode: row.store_code, itemCode: row.item_code }).query(`
          select top 1 * from dbo.inventory_stock
          where store_code = @storeCode and item_code = @itemCode
        `)).recordset[0] || null
      : null
    return { reservation: row, inventoryStock }
  })
  const reservation = result.reservation
  emitChanges(req, [
    { moduleName: 'Reservations', relatedModules: ['Work Orders', 'Stores', 'Materials', 'Tools & Equipment'], table: 'dbo.inventory_reservations', action: 'edit', id: reservation.reservation_num },
    ...(isMaterialRequest(reservation.request_type) ? [{ moduleName: 'Stores', relatedModules: ['Materials'], table: 'dbo.inventory_stock', action: 'edit', id: `${reservation.store_code}/${reservation.item_code}` }] : [])
  ])
  res.json(result)
}))

router.post('/work-orders/:workOrderNumber/cancel', asyncHandler(async (req, res) => {
  await assertPermission(req.user, 'Work Orders', 'close')
  const result = await withTransaction(async transaction => {
    const workOrder = await selectScopedWorkOrder(transaction, req.user, req.params.workOrderNumber, true)
    if (workOrder.status === 'CAN') return { workOrder, reservations: 0, purchaseRequisitions: 0, purchaseOrders: 0, inventoryStocks: [], existing: true }
    const reservations = await requestFor(transaction, { workOrderNumber: workOrder.work_order_num }).query(`
      select * from dbo.inventory_reservations with (updlock, holdlock)
      where work_order_num = @workOrderNumber and status not in ('CANCELLED', 'CAN', 'COMPLETE')
    `)
    const inventoryStocks = []
    for (const reservation of reservations.recordset) {
      if (isToolRequest(reservation.request_type)) continue
      const outstanding = Math.max(0, Number(reservation.reserved_quantity) - Number(reservation.released_quantity))
      if (!outstanding || !reservation.store_code || !reservation.item_code) continue
      const stockUpdate = await requestFor(transaction, { storeCode: reservation.store_code, itemCode: reservation.item_code, outstanding }).query(`
        update dbo.inventory_stock
        set reserved_quantity = case when reserved_quantity < @outstanding then 0 else reserved_quantity - @outstanding end,
            updated_at = sysutcdatetime()
        output inserted.*
        where store_code = @storeCode and item_code = @itemCode
      `)
      if (stockUpdate.recordset[0]) inventoryStocks.push(stockUpdate.recordset[0])
    }
    await requestFor(transaction, { workOrderNumber: workOrder.work_order_num }).query(`
      update dbo.inventory_reservations set status = 'CANCELLED', updated_at = sysutcdatetime()
      where work_order_num = @workOrderNumber and status not in ('CANCELLED', 'CAN', 'COMPLETE');
      update dbo.purchase_orders set status = 'CAN', cancelled_at = coalesce(cancelled_at, sysutcdatetime()), updated_at = sysutcdatetime()
      where work_order_num = @workOrderNumber and status not in ('CAN', 'CLOSE');
      update dbo.purchase_requisitions set status = 'CAN', cancelled_at = coalesce(cancelled_at, sysutcdatetime()), updated_at = sysutcdatetime()
      where work_order_num = @workOrderNumber and status not in ('CAN', 'CLOSE');
      update dbo.work_order_resource_requests
      set request_status = case when resource_type in ('Tool', 'Equipment') then 'CANCELLED' else 'CAN' end,
          supply_chain_status = 'Cancelled with work order', updated_at = sysutcdatetime()
      where work_order_num = @workOrderNumber;
    `)
    const cancelled = await requestFor(transaction, { workOrderNumber: workOrder.work_order_num }).query(`
      update dbo.work_orders
      set status = 'CAN', updated_at = sysutcdatetime()
      output inserted.*
      where work_order_num = @workOrderNumber
    `)
    const counts = await requestFor(transaction, { workOrderNumber: workOrder.work_order_num }).query(`
      select
        (select count_big(1) from dbo.inventory_reservations where work_order_num = @workOrderNumber and status = 'CANCELLED') as reservations,
        (select count_big(1) from dbo.purchase_requisitions where work_order_num = @workOrderNumber and status = 'CAN') as purchase_requisitions,
        (select count_big(1) from dbo.purchase_orders where work_order_num = @workOrderNumber and status = 'CAN') as purchase_orders
    `)
    return {
      workOrder: cancelled.recordset[0],
      reservations: Number(counts.recordset[0].reservations),
      purchaseRequisitions: Number(counts.recordset[0].purchase_requisitions),
      purchaseOrders: Number(counts.recordset[0].purchase_orders),
      inventoryStocks: [...new Map(inventoryStocks.map(row => [`${row.store_code}/${row.item_code}`, row])).values()],
      existing: false
    }
  })
  emitChanges(req, [
    { moduleName: 'Work Orders', relatedModules: ['Reservations', 'Purchase Requisitions', 'Purchase Orders'], table: 'dbo.work_orders', action: 'edit', id: result.workOrder.work_order_num },
    { moduleName: 'Reservations', relatedModules: ['Stores', 'Materials'], table: 'dbo.inventory_reservations', action: 'edit', id: result.workOrder.work_order_num },
    { moduleName: 'Purchase Requisitions', relatedModules: ['Work Orders'], table: 'dbo.purchase_requisitions', action: 'edit', id: result.workOrder.work_order_num },
    { moduleName: 'Purchase Orders', relatedModules: ['Work Orders'], table: 'dbo.purchase_orders', action: 'edit', id: result.workOrder.work_order_num },
    { moduleName: 'Stores', relatedModules: ['Materials'], table: 'dbo.inventory_stock', action: 'edit', id: result.workOrder.work_order_num }
  ])
  res.json(result)
}))

export default router
