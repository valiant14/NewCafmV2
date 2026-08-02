import { Router } from 'express'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { addScopeWhere } from '../middleware/scope.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { bindParams } from '../utils/sqlParams.js'

const assertKnownColumn = (columns, key) => {
  if (!columns.includes(key)) {
    const error = new Error(`Unsupported field: ${key}`)
    error.status = 400
    throw error
  }
}

export function crudRouter({ table, key, columns, defaultOrder = key, moduleName, scope }) {
  const router = Router()
  const editable = columns.filter(column => column !== key)
  const permit = action => moduleName ? requirePermission(moduleName, action) : (req, res, next) => next()

  router.get('/', permit('view'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope }) : { where: '', params: {} }
    const request = bindParams(pool.request(), scoped.params)
    const result = await request.query(`select * from ${table} where 1 = 1${scoped.where} order by ${defaultOrder}`)
    res.json(result.recordset)
  }))

  router.get('/:id', permit('view'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope }) : { where: '', params: {} }
    const request = bindParams(pool.request(), scoped.params)
    const result = await request
      .input('id', req.params.id)
      .query(`select * from ${table} where ${key} = @id${scoped.where}`)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    res.json(result.recordset[0])
  }))

  router.post('/', permit('create'), asyncHandler(async (req, res) => {
    const payload = req.body || {}
    Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    const insertColumns = columns.filter(column => payload[column] !== undefined)
    const pool = await getPool()
    const request = bindParams(pool.request(), Object.fromEntries(insertColumns.map(column => [column, payload[column]])))
    const result = await request.query(`
      insert into ${table} (${insertColumns.join(', ')})
      output inserted.*
      values (${insertColumns.map(column => `@${column}`).join(', ')})
    `)
    res.status(201).json(result.recordset[0])
  }))

  router.put('/:id', permit('edit'), asyncHandler(async (req, res) => {
    const payload = req.body || {}
    Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    const updateColumns = editable.filter(column => payload[column] !== undefined)
    if (!updateColumns.length) return res.status(400).json({ error: 'BadRequest', message: 'No editable fields supplied' })
    const pool = await getPool()
    const request = bindParams(pool.request(), Object.fromEntries(updateColumns.map(column => [column, payload[column]])))
    request.input('id', req.params.id)
    const result = await request.query(`
      update ${table}
      set ${updateColumns.map(column => `${column} = @${column}`).join(', ')}, updated_at = sysutcdatetime()
      output inserted.*
      where ${key} = @id
    `)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    res.json(result.recordset[0])
  }))

  router.delete('/:id', permit('edit'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const result = await pool.request()
      .input('id', req.params.id)
      .query(`delete from ${table} output deleted.* where ${key} = @id`)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    res.json({ deleted: result.recordset[0] })
  }))

  return router
}
