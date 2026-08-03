import { Router } from 'express'
import { getPool } from '../db/pool.js'
import { requirePermission } from '../middleware/auth.js'
import { addScopeWhere } from '../middleware/scope.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { bindParams } from '../utils/sqlParams.js'

const dateColumnPattern = /(^|_)(date|at)$|_date$|_at$/

const assertKnownColumn = (columns, key) => {
  if (!columns.includes(key)) {
    const error = new Error(`Unsupported field: ${key}`)
    error.status = 400
    throw error
  }
}

const normalizeColumnValue = (column, value) => {
  if (!dateColumnPattern.test(column) || value === null || value === undefined || value === '') return value
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizePayload = payload => Object.fromEntries(
  Object.entries(payload || {}).map(([column, value]) => [column, normalizeColumnValue(column, value)])
)

const normalizeSubDepartmentCode = async (pool, payload) => {
  const value = payload.sub_department_code
  if (value === undefined) return payload
  if (value === null || String(value).trim() === '') {
    return {
      ...payload,
      sub_department_code: null
    }
  }

  const result = await pool.request()
    .input('value', String(value).trim())
    .query(`
      select top 1 sub_department_code
      from dbo.departments
      where sub_department_code = @value
        or description = @value
        or department_name = @value
      order by
        case
          when sub_department_code = @value then 0
          when description = @value then 1
          else 2
        end,
        sub_department_code
    `)

  return {
    ...payload,
    sub_department_code: result.recordset[0]?.sub_department_code || null
  }
}

const normalizeStoreCode = async (pool, payload) => {
  const value = payload.store_code
  if (value === undefined) return payload
  if (value === null || String(value).trim() === '') {
    return {
      ...payload,
      store_code: null
    }
  }

  const result = await pool.request()
    .input('value', String(value).trim())
    .query(`
      select top 1 store_code
      from dbo.storerooms
      where store_code = @value
        or store_name = @value
      order by
        case
          when store_code = @value then 0
          else 1
        end,
        store_code
    `)

  return {
    ...payload,
    store_code: result.recordset[0]?.store_code || null
  }
}

const normalizeSiteCode = async (pool, payload) => {
  const value = payload.site_code
  if (value === undefined) return payload
  const text = String(value || '').trim()
  const result = await pool.request()
    .input('value', text)
    .query(`
      select top 1 site_code
      from dbo.sites
      where site_code = @value
        or site_name = @value
        or concat(site_name, ' / ', site_code) = @value
      order by
        case
          when site_code = @value then 0
          when site_name = @value then 1
          else 2
        end,
        site_code
    `)
  if (result.recordset[0]?.site_code) return { ...payload, site_code: result.recordset[0].site_code }
  if (!text) {
    const fallback = await pool.request().query(`
      select top 1 site_code
      from dbo.sites
      where status is null or status <> 'Inactive'
      order by site_code
    `)
    return { ...payload, site_code: fallback.recordset[0]?.site_code || text }
  }
  return payload
}

const normalizeLocationCode = async (pool, payload) => {
  const value = payload.location_code
  if (value === undefined) return payload
  const text = String(value || '').trim()
  if (!text) return { ...payload, location_code: null }
  const result = await pool.request()
    .input('value', text)
    .query(`
      select top 1 location_code
      from dbo.locations
      where location_code = @value
        or description = @value
        or concat(location_code, ' - ', description) = @value
      order by
        case
          when location_code = @value then 0
          when description = @value then 1
          else 2
        end,
        location_code
    `)
  return { ...payload, location_code: result.recordset[0]?.location_code || null }
}

const normalizeAssetNum = async (pool, payload) => {
  const value = payload.asset_num
  if (value === undefined) return payload
  const text = String(value || '').trim()
  if (!text) return { ...payload, asset_num: null }
  const result = await pool.request()
    .input('value', text)
    .query(`
      select top 1 asset_num
      from dbo.assets
      where asset_num = @value
        or description = @value
        or concat(asset_num, ' - ', description) = @value
      order by
        case
          when asset_num = @value then 0
          when description = @value then 1
          else 2
        end,
        asset_num
    `)
  return { ...payload, asset_num: result.recordset[0]?.asset_num || null }
}

const normalizeForeignKeys = async (pool, payload, { table }) => {
  let normalized = payload
  if (table !== 'dbo.sites' && Object.hasOwn(normalized, 'site_code')) {
    normalized = await normalizeSiteCode(pool, normalized)
  }
  if (table !== 'dbo.locations' && Object.hasOwn(normalized, 'location_code')) {
    normalized = await normalizeLocationCode(pool, normalized)
  }
  if (table !== 'dbo.assets' && Object.hasOwn(normalized, 'asset_num')) {
    normalized = await normalizeAssetNum(pool, normalized)
  }
  if (table !== 'dbo.departments' && Object.hasOwn(normalized, 'sub_department_code')) {
    normalized = await normalizeSubDepartmentCode(pool, normalized)
  }
  if (table !== 'dbo.storerooms' && Object.hasOwn(normalized, 'store_code')) {
    normalized = await normalizeStoreCode(pool, normalized)
  }
  return normalized
}

const nextServiceRequestNumber = async pool => {
  const result = await pool.request().query(`
    select isnull(max(try_convert(int, substring(sr_num, 9, 20))), 41) + 1 as next_number
    from dbo.service_requests
    where sr_num like 'SR-2026-[0-9][0-9][0-9][0-9]'
  `)
  return `SR-2026-${String(result.recordset[0]?.next_number || 42).padStart(4, '0')}`
}

const normalizeGeneratedKeys = async (pool, payload, { table, key }) => {
  if (table === 'dbo.service_requests' && key === 'sr_num') {
    const value = String(payload.sr_num || '').trim()
    if (!value || value.toUpperCase() === 'AUTO') {
      return { ...payload, sr_num: await nextServiceRequestNumber(pool) }
    }
  }
  return payload
}

const emitChange = (req, payload) => {
  req.app.locals.broadcastWorkspaceChange?.({
    actor: req.user?.userId || req.user?.username || '',
    ...payload
  })
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
    let payload = normalizePayload(req.body || {})
    Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    const pool = await getPool()
    payload = await normalizeGeneratedKeys(pool, payload, { table, key })
    payload = await normalizeForeignKeys(pool, payload, { table })
    const insertColumns = columns.filter(column => payload[column] !== undefined)
    const request = bindParams(pool.request(), Object.fromEntries(insertColumns.map(column => [column, payload[column]])))
    const result = await request.query(`
      insert into ${table} (${insertColumns.join(', ')})
      output inserted.*
      values (${insertColumns.map(column => `@${column}`).join(', ')})
    `)
    emitChange(req, { moduleName, table, action: 'create', key, id: result.recordset[0]?.[key] })
    res.status(201).json(result.recordset[0])
  }))

  router.put('/:id', permit('edit'), asyncHandler(async (req, res) => {
    let payload = normalizePayload(req.body || {})
    Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    const pool = await getPool()
    payload = await normalizeForeignKeys(pool, payload, { table })
    const updateColumns = editable.filter(column => payload[column] !== undefined)
    if (!updateColumns.length) return res.status(400).json({ error: 'BadRequest', message: 'No editable fields supplied' })
    const request = bindParams(pool.request(), Object.fromEntries(updateColumns.map(column => [column, payload[column]])))
    request.input('id', req.params.id)
    const timestampUpdate = columns.includes('updated_at') ? ', updated_at = sysutcdatetime()' : ''
    const result = await request.query(`
      update ${table}
      set ${updateColumns.map(column => `${column} = @${column}`).join(', ')}${timestampUpdate}
      output inserted.*
      where ${key} = @id
    `)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    emitChange(req, { moduleName, table, action: 'edit', key, id: result.recordset[0]?.[key] })
    res.json(result.recordset[0])
  }))

  router.delete('/:id', permit('edit'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const result = await pool.request()
      .input('id', req.params.id)
      .query(`delete from ${table} output deleted.* where ${key} = @id`)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    emitChange(req, { moduleName, table, action: 'delete', key, id: result.recordset[0]?.[key] })
    res.json({ deleted: result.recordset[0] })
  }))

  return router
}
