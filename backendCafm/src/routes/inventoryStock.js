import { Router } from 'express'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { bindParams } from '../utils/sqlParams.js'

const router = Router()

router.get('/', requirePermission('Stores', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const result = await pool.request().query('select * from dbo.inventory_stock order by store_code, item_code')
  res.json(result.recordset)
}))

router.get('/:storeCode/:itemCode', requirePermission('Stores', 'view'), asyncHandler(async (req, res) => {
  const pool = await getPool()
  const result = await pool.request()
    .input('storeCode', req.params.storeCode)
    .input('itemCode', req.params.itemCode)
    .query('select * from dbo.inventory_stock where store_code = @storeCode and item_code = @itemCode')
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
  const request = bindParams(pool.request(), payload)
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
  `)
  if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Stock record not found' })
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
  const result = await bindParams(pool.request(), payload).query(`
    insert into dbo.inventory_stock (store_code, item_code, balance, reserved_quantity, reorder_point)
    output inserted.*
    values (@store_code, @item_code, @balance, @reserved_quantity, @reorder_point)
  `)
  res.status(201).json(result.recordset[0])
}))

export default router
