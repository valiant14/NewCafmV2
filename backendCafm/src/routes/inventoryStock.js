import { Router } from 'express'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { bindParams } from '../utils/sqlParams.js'
import { addScopeWhere } from '../middleware/scope.js'

const router = Router()
const emitChange = (req, payload) => req.app.locals.broadcastWorkspaceChange?.({
  actor: req.user?.userId || req.user?.username || '',
  moduleName: 'Stores',
  relatedModules: ['Materials', 'Tools & Equipment', 'Reservations', 'Work Orders'],
  table: 'dbo.inventory_stock',
  ...payload
})

router.get('/', requirePermission('Stores', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const scoped = addScopeWhere({ user: req.user, siteColumn: 'site_code', departmentColumn: null, alias: 'storeroom' })
  const result = await bindParams(pool.request(), scoped.params).query(`
    select stock.*
    from dbo.inventory_stock stock
    join dbo.storerooms storeroom on storeroom.store_code = stock.store_code
    where 1 = 1${scoped.where}
    order by stock.store_code, stock.item_code
  `)
  res.json(result.recordset)
}))

router.get('/:storeCode/:itemCode', requirePermission('Stores', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const scoped = addScopeWhere({ user: req.user, siteColumn: 'site_code', departmentColumn: null, alias: 'storeroom' })
  const request = bindParams(pool.request(), scoped.params)
  const result = await request
    .input('storeCode', req.params.storeCode)
    .input('itemCode', req.params.itemCode)
    .query(`
      select stock.*
      from dbo.inventory_stock stock
      join dbo.storerooms storeroom on storeroom.store_code = stock.store_code
      where stock.store_code = @storeCode and stock.item_code = @itemCode${scoped.where}
    `)
  if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Stock record not found' })
  res.json(result.recordset[0])
}))

router.put('/:storeCode/:itemCode', requirePermission('Stores', 'edit'), asyncHandler(async (req, res) => {
  const payload = {
    balance: Number(req.body?.balance || 0),
    reserved_quantity: Number(req.body?.reserved_quantity || 0),
    reorder_point: req.body?.reorder_point === undefined ? null : Number(req.body.reorder_point)
  }
  const pool = await getPool()
  const scoped = addScopeWhere({ user: req.user, siteColumn: 'site_code', departmentColumn: null, alias: 'storeroom' })
  const request = bindParams(pool.request(), { ...payload, ...scoped.params })
  request.input('storeCode', req.params.storeCode)
  request.input('itemCode', req.params.itemCode)
  const result = await request.query(`
    update dbo.inventory_stock
    set balance = @balance,
        reserved_quantity = @reserved_quantity,
        reorder_point = @reorder_point,
        updated_at = sysutcdatetime()
    output inserted.*
    where store_code = @storeCode and item_code = @itemCode
      and exists (
        select 1 from dbo.storerooms storeroom
        where storeroom.store_code = dbo.inventory_stock.store_code${scoped.where}
      )
  `)
  if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Stock record not found' })
  emitChange(req, { action: 'edit', id: `${req.params.storeCode}/${req.params.itemCode}` })
  res.json(result.recordset[0])
}))

router.post('/', requirePermission('Stores', 'create'), asyncHandler(async (req, res) => {
  const payload = {
    store_code: req.body?.store_code,
    item_code: req.body?.item_code,
    balance: Number(req.body?.balance || 0),
    reserved_quantity: Number(req.body?.reserved_quantity || 0),
    reorder_point: req.body?.reorder_point === undefined ? null : Number(req.body.reorder_point)
  }
  if (!payload.store_code || !payload.item_code) {
    return res.status(400).json({ error: 'BadRequest', message: 'store_code and item_code are required' })
  }
  const pool = await getPool()
  const scoped = addScopeWhere({ user: req.user, siteColumn: 'site_code', departmentColumn: null, alias: 'storeroom' })
  const allowedStore = await bindParams(pool.request(), scoped.params)
    .input('storeCode', payload.store_code)
    .query(`select top 1 storeroom.store_code from dbo.storerooms storeroom where storeroom.store_code = @storeCode${scoped.where}`)
  if (!allowedStore.recordset[0]) {
    return res.status(403).json({ error: 'ScopeViolation', message: 'The selected store is outside your site scope.' })
  }
  const result = await bindParams(pool.request(), payload).query(`
    insert into dbo.inventory_stock (store_code, item_code, balance, reserved_quantity, reorder_point)
    output inserted.*
    values (@store_code, @item_code, @balance, @reserved_quantity, @reorder_point)
  `)
  emitChange(req, { action: 'create', id: `${payload.store_code}/${payload.item_code}` })
  res.status(201).json(result.recordset[0])
}))

export default router
