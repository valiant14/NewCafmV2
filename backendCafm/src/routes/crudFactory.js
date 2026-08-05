import { Router } from 'express'
import { getPool, sql } from '../db/pool.js'
import { env } from '../config/env.js'
import { requirePermission } from '../middleware/auth.js'
import { addScopeWhere, applyScopeDefaults, assertPayloadWithinScope } from '../middleware/scope.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { bindParams } from '../utils/sqlParams.js'

const dateColumnPattern = /(^|_)(date|at)$|_date$|_at$/
const generatedColumns = new Set(['created_at', 'updated_at', 'created_by_user_id'])
const boundedInteger = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : fallback
}
const quoteColumn = column => `[${String(column).replaceAll(']', ']]')}]`

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
      select top 1 sub_department_code, department_name
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

  const match = result.recordset[0]
  const suppliedDepartment = String(payload.department_name || '').trim()
  if (match?.department_name && suppliedDepartment && suppliedDepartment.toLowerCase() !== String(match.department_name).trim().toLowerCase()) {
    const error = new Error('The sub-department does not belong to the selected department.')
    error.status = 400
    throw error
  }
  return {
    ...payload,
    sub_department_code: match?.sub_department_code || null,
    ...(match?.department_name && !suppliedDepartment ? { department_name: match.department_name } : {})
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
  if (!text) return { ...payload, site_code: null }
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

const emitChange = (req, payload, row = {}) => {
  req.app.locals.broadcastWorkspaceChange?.({
    actor: req.user?.userId || req.user?.username || '',
    ownerUserId: row.created_by_user_id || null,
    siteCode: row.site_code || req.body?.site_code || null,
    department: row.department_name || req.body?.department_name || null,
    ...payload
  })
}

const forbiddenSource = () => {
  const error = new Error('The linked record is outside your access scope.')
  error.status = 403
  error.code = 'ScopeViolation'
  return error
}

const ownerFromAccessibleSource = async (pool, payload, user, sources = []) => {
  for (const source of sources) {
    const sourceId = payload[source.payloadKey]
    if (sourceId === undefined || sourceId === null || sourceId === '') continue
    const scoped = addScopeWhere({ user, ...(source.scope || {}) })
    const request = bindParams(pool.request(), scoped.params)
    request.input('ownerSourceId', sourceId)
    const result = await request.query(`
      select top 1 ${quoteColumn(source.ownerColumn || 'created_by_user_id')} as owner_user_id
      from ${source.table}
      where ${quoteColumn(source.key)} = @ownerSourceId${scoped.where}
    `)
    if (!result.recordset[0]) throw forbiddenSource()
    return result.recordset[0].owner_user_id || user?.userId || null
  }
  return user?.userId || null
}

export function crudRouter({ table, key, columns, defaultOrder = key, moduleName, relatedModules = [], scope, ownerColumn = null, ownerSources = [] }) {
  const router = Router()
  const insertable = columns.filter(column => !generatedColumns.has(column))
  const editable = insertable.filter(column => column !== key)
  const selectColumns = columns.map(quoteColumn).join(', ')
  const permit = action => moduleName ? requirePermission(moduleName, action) : (req, res, next) => next()

  router.get('/', permit('view'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope, ownerColumn }) : { where: '', params: {} }
    const filterClauses = []
    const filterParams = {}
    columns.forEach((column, index) => {
      const value = Array.isArray(req.query[column]) ? req.query[column][0] : req.query[column]
      if (value === undefined || value === '') return
      filterClauses.push(`${quoteColumn(column)} = @listFilter${index}`)
      filterParams[`listFilter${index}`] = value
    })
    if (columns.includes('updated_at') && req.query.updatedAfter) {
      const updatedAfter = new Date(req.query.updatedAfter)
      if (Number.isNaN(updatedAfter.getTime())) {
        return res.status(400).json({ error: 'BadRequest', message: 'updatedAfter must be a valid date' })
      }
      filterClauses.push('[updated_at] > @updatedAfter')
      filterParams.updatedAfter = updatedAfter
    }

    const requestedLimit = req.query.limit ?? req.query.pageSize
    const paged = requestedLimit !== undefined
    const limit = boundedInteger(requestedLimit, 100, env.listMaxPageSize) || 1
    const page = boundedInteger(req.query.page, 1) || 1
    const offset = req.query.offset === undefined
      ? (page - 1) * limit
      : boundedInteger(req.query.offset, 0)
    const includeTotal = ['1', 'true', 'yes'].includes(String(req.query.includeTotal || '').toLowerCase())
    const where = `${scoped.where}${filterClauses.length ? ` and ${filterClauses.join(' and ')}` : ''}`
    const request = bindParams(pool.request(), { ...scoped.params, ...filterParams })
    if (paged) {
      request.input('listOffset', sql.Int, offset)
      request.input('listLimit', sql.Int, limit)
    }
    const result = await request.query(`
      select ${selectColumns}
      from ${table}
      where 1 = 1${where}
      order by ${defaultOrder}
      ${paged ? 'offset @listOffset rows fetch next @listLimit rows only' : ''};
      ${includeTotal ? `select count_big(1) as total from ${table} where 1 = 1${where};` : ''}
    `)
    res.set('Accept-Ranges', 'records')
    if (paged) {
      res.set('X-Page-Size', String(limit))
      res.set('X-Page-Offset', String(offset))
    }
    if (includeTotal) res.set('X-Total-Count', String(result.recordsets[1]?.[0]?.total || 0))
    res.json(result.recordset)
  }))

  router.get('/:id', permit('view'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope, ownerColumn }) : { where: '', params: {} }
    const request = bindParams(pool.request(), scoped.params)
    const result = await request
      .input('id', req.params.id)
      .query(`select ${selectColumns} from ${table} where ${quoteColumn(key)} = @id${scoped.where}`)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    res.json(result.recordset[0])
  }))

  router.post('/', permit('create'), asyncHandler(async (req, res) => {
    let payload = normalizePayload(req.body || {})
    Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    const pool = await getPool()
    payload = await normalizeGeneratedKeys(pool, payload, { table, key })
    payload = await normalizeForeignKeys(pool, payload, { table })
    if (columns.includes('reported_by') && !String(payload.reported_by || '').trim()) {
      payload.reported_by = req.user?.name || req.user?.username || req.user?.userId || null
    }
    if (scope) {
      payload = applyScopeDefaults({ user: req.user, payload, ...scope })
      assertPayloadWithinScope({ user: req.user, payload, ...scope, requireValues: true })
    }
    const resolvedOwner = await ownerFromAccessibleSource(pool, payload, req.user, ownerSources)
    if (ownerColumn && columns.includes(ownerColumn)) payload[ownerColumn] = resolvedOwner
    const insertColumns = [
      ...insertable.filter(column => payload[column] !== undefined),
      ...(ownerColumn && columns.includes(ownerColumn) && payload[ownerColumn] ? [ownerColumn] : [])
    ]
    if (!insertColumns.length) return res.status(400).json({ error: 'BadRequest', message: 'No fields supplied' })
    const request = bindParams(pool.request(), Object.fromEntries(insertColumns.map(column => [column, payload[column]])))
    const result = await request.query(`
      insert into ${table} (${insertColumns.join(', ')})
      output inserted.*
      values (${insertColumns.map(column => `@${column}`).join(', ')})
    `)
    emitChange(req, { moduleName, relatedModules, table, action: 'create', key, id: result.recordset[0]?.[key] }, result.recordset[0])
    res.status(201).json(result.recordset[0])
  }))

  router.put('/:id', permit('edit'), asyncHandler(async (req, res) => {
    let payload = normalizePayload(req.body || {})
    Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    const pool = await getPool()
    payload = await normalizeForeignKeys(pool, payload, { table })
    if (scope) assertPayloadWithinScope({ user: req.user, payload, ...scope })
    await ownerFromAccessibleSource(pool, payload, req.user, ownerSources)
    const updateColumns = editable.filter(column => payload[column] !== undefined)
    if (!updateColumns.length) return res.status(400).json({ error: 'BadRequest', message: 'No editable fields supplied' })
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope, ownerColumn }) : { where: '', params: {} }
    const request = bindParams(pool.request(), {
      ...Object.fromEntries(updateColumns.map(column => [column, payload[column]])),
      ...scoped.params
    })
    request.input('id', req.params.id)
    const timestampUpdate = columns.includes('updated_at') ? ', updated_at = sysutcdatetime()' : ''
    const result = await request.query(`
      update ${table}
      set ${updateColumns.map(column => `${column} = @${column}`).join(', ')}${timestampUpdate}
      output inserted.*
      where ${quoteColumn(key)} = @id${scoped.where}
    `)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    emitChange(req, { moduleName, relatedModules, table, action: 'edit', key, id: result.recordset[0]?.[key] }, result.recordset[0])
    res.json(result.recordset[0])
  }))

  router.delete('/:id', permit('edit'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope, ownerColumn }) : { where: '', params: {} }
    const request = bindParams(pool.request(), scoped.params)
    const result = await request
      .input('id', req.params.id)
      .query(`delete from ${table} output deleted.* where ${quoteColumn(key)} = @id${scoped.where}`)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    emitChange(req, { moduleName, relatedModules, table, action: 'delete', key, id: result.recordset[0]?.[key] }, result.recordset[0])
    res.json({ deleted: result.recordset[0] })
  }))

  return router
}
