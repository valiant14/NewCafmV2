import { Router } from 'express'
import { getPool, sql } from '../db/pool.js'
import { env } from '../config/env.js'
import { assertPermission, requirePermission } from '../middleware/auth.js'
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

const normalizeToolStoreCode = async (pool, payload) => {
  const value = payload.location_code
  if (value === undefined) return payload
  const text = String(value || '').trim()
  if (!text) return { ...payload, location_code: null, site_code: null }
  const result = await pool.request()
    .input('value', text)
    .query(`
      select top 1 store_code, site_code
      from dbo.storerooms
      where store_code = @value
        or store_name = @value
        or concat(store_code, ' - ', store_name) = @value
      order by case when store_code = @value then 0 when store_name = @value then 1 else 2 end, store_code
    `)
  const store = result.recordset[0]
  if (!store) {
    const error = new Error('Select a valid warehouse for this tool or equipment record.')
    error.status = 400
    throw error
  }
  return { ...payload, location_code: store.store_code, site_code: store.site_code }
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
    normalized = table === 'dbo.tools_equipment'
      ? await normalizeToolStoreCode(pool, normalized)
      : await normalizeLocationCode(pool, normalized)
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

const reserveNumber = async (pool, { sequenceKey, minimumSql, params = {} }) => {
  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const request = bindParams(new sql.Request(transaction), { sequenceKey, lockResource: `cafm-number-${sequenceKey}`, ...params })
    const result = await request.query(`
      set xact_abort on;
      declare @lockResult int;
      exec @lockResult = sp_getapplock
        @Resource = @lockResource,
        @LockMode = 'Exclusive',
        @LockOwner = 'Transaction',
        @LockTimeout = 10000;
      if @lockResult < 0 throw 51001, 'Unable to reserve the next record number.', 1;

      declare @minimum bigint = ${minimumSql};
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
    await transaction.commit()
    return Number(result.recordset[0]?.reserved_value)
  } catch (error) {
    await transaction.rollback().catch(() => {})
    throw error
  }
}

const nextServiceRequestNumber = async pool => {
  const year = new Date().getUTCFullYear()
  const prefix = `SR-${year}-`
  const next = await reserveNumber(pool, {
    sequenceKey: `SERVICE_REQUEST_${year}`,
    params: { prefix },
    minimumSql: `isnull((
      select max(try_convert(bigint, substring(sr_num, len(@prefix) + 1, 30)))
      from dbo.service_requests
      where sr_num like @prefix + '%'
    ), 0) + 1`
  })
  return `${prefix}${String(next).padStart(4, '0')}`
}

const nextWorkOrderNumber = pool => reserveNumber(pool, {
  sequenceKey: 'WORK_ORDER',
  minimumSql: `isnull((select max(try_convert(bigint, work_order_num)) from dbo.work_orders), 0) + 1`
}).then(String)

const nextAnnualNumber = async (pool, { sequenceName, prefixName, table, column }) => {
  const year = new Date().getUTCFullYear()
  const prefix = `${prefixName}-${year}-`
  const next = await reserveNumber(pool, {
    sequenceKey: `${sequenceName}_${year}`,
    params: { prefix },
    minimumSql: `isnull((
      select max(try_convert(bigint, substring(${column}, len(@prefix) + 1, 30)))
      from ${table}
      where ${column} like @prefix + '%'
    ), 0) + 1`
  })
  return `${prefix}${String(next).padStart(4, '0')}`
}

const nextPurchaseRequestNumber = pool => nextAnnualNumber(pool, {
  sequenceName: 'PURCHASE_REQUEST',
  prefixName: 'PR',
  table: 'dbo.purchase_requisitions',
  column: 'pr_num'
})

const nextPurchaseOrderNumber = pool => nextAnnualNumber(pool, {
  sequenceName: 'PURCHASE_ORDER',
  prefixName: 'PO',
  table: 'dbo.purchase_orders',
  column: 'po_num'
})

const nextReservationNumber = (pool, requestType) => {
  const allocation = ['TOOL', 'EQUIPMENT'].includes(String(requestType || '').trim().toUpperCase())
  return nextAnnualNumber(pool, {
    sequenceName: allocation ? 'ALLOCATION' : 'RESERVATION',
    prefixName: allocation ? 'ALC' : 'RSV',
    table: 'dbo.inventory_reservations',
    column: 'reservation_num'
  })
}

const nextIncidentNumber = pool => nextAnnualNumber(pool, {
  sequenceName: 'INCIDENT',
  prefixName: 'INC',
  table: 'dbo.incidents',
  column: 'incident_num'
})

const normalizeGeneratedKeys = async (pool, payload, { table, key }) => {
  if (table === 'dbo.service_requests' && key === 'sr_num') {
    const value = String(payload.sr_num || '').trim()
    if (!value || value.toUpperCase() === 'AUTO') {
      return { ...payload, sr_num: await nextServiceRequestNumber(pool) }
    }
  }
  if (table === 'dbo.work_orders' && key === 'work_order_num') {
    const value = String(payload.work_order_num || '').trim()
    if (!value || value.toUpperCase() === 'AUTO') {
      return { ...payload, work_order_num: await nextWorkOrderNumber(pool) }
    }
  }
  if (table === 'dbo.purchase_requisitions' && key === 'pr_num') {
    const value = String(payload.pr_num || '').trim()
    if (!value || value.toUpperCase() === 'AUTO') {
      return { ...payload, pr_num: await nextPurchaseRequestNumber(pool) }
    }
  }
  if (table === 'dbo.purchase_orders' && key === 'po_num') {
    const value = String(payload.po_num || '').trim()
    if (!value || value.toUpperCase() === 'AUTO') {
      return { ...payload, po_num: await nextPurchaseOrderNumber(pool) }
    }
  }
  if (table === 'dbo.inventory_reservations' && key === 'reservation_num') {
    const value = String(payload.reservation_num || '').trim()
    if (!value || value.toUpperCase() === 'AUTO') {
      return { ...payload, reservation_num: await nextReservationNumber(pool, payload.request_type) }
    }
  }
  if (table === 'dbo.incidents' && key === 'incident_num') {
    const value = String(payload.incident_num || '').trim()
    if (!value || value.toUpperCase() === 'AUTO') {
      return { ...payload, incident_num: await nextIncidentNumber(pool) }
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
    status: row.status || null,
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

export function crudRouter({ table, key, columns, defaultOrder = key, defaultPageSize = null, moduleName, relatedModules = [], scope, ownerColumn = null, ownerSources = [], beforeCreate, beforeUpdate, additionalUpdatePermission, transformResponse, hasTriggers = false, searchColumns = [], filterGroups = {}, prefixFilters = {}, dateFilterColumn = null, readOnly = false }) {
  const router = Router()
  const insertable = columns.filter(column => !generatedColumns.has(column))
  const editable = insertable.filter(column => column !== key)
  const selectColumns = columns.map(quoteColumn).join(', ')
  const permit = action => moduleName ? requirePermission(moduleName, action) : (req, res, next) => next()
  const presentRow = row => row && transformResponse ? transformResponse(row) : row

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
    Object.entries(filterGroups).forEach(([queryKey, groupColumns], groupIndex) => {
      const value = Array.isArray(req.query[queryKey]) ? req.query[queryKey][0] : req.query[queryKey]
      const validColumns = groupColumns.filter(column => columns.includes(column))
      if (value === undefined || value === '' || !validColumns.length) return
      const parameter = `groupFilter${groupIndex}`
      filterClauses.push(`(${validColumns.map(column => `${quoteColumn(column)} = @${parameter}`).join(' or ')})`)
      filterParams[parameter] = value
    })
    Object.entries(prefixFilters).forEach(([queryKey, column], prefixIndex) => {
      const value = Array.isArray(req.query[queryKey]) ? req.query[queryKey][0] : req.query[queryKey]
      if (value === undefined || value === '' || !columns.includes(column)) return
      const parameter = `prefixFilter${prefixIndex}`
      filterClauses.push(`${quoteColumn(column)} like @${parameter}`)
      filterParams[parameter] = `${String(value).replaceAll('[', '[[]').replaceAll('%', '[%]').replaceAll('_', '[_]')}%`
    })
    const queryText = String(req.query.q || '').trim().slice(0, 200)
    const validSearchColumns = searchColumns.filter(column => columns.includes(column))
    if (queryText && validSearchColumns.length) {
      filterClauses.push(`(${validSearchColumns.map(column => `convert(nvarchar(4000), ${quoteColumn(column)}) like @listSearch`).join(' or ')})`)
      filterParams.listSearch = `%${queryText}%`
    }
    if (dateFilterColumn && columns.includes(dateFilterColumn)) {
      const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null
      const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null
      if (dateFrom && Number.isNaN(dateFrom.getTime())) return res.status(400).json({ error: 'BadRequest', message: 'dateFrom must be a valid date' })
      if (dateTo && Number.isNaN(dateTo.getTime())) return res.status(400).json({ error: 'BadRequest', message: 'dateTo must be a valid date' })
      if (dateFrom) {
        filterClauses.push(`${quoteColumn(dateFilterColumn)} >= @listDateFrom`)
        filterParams.listDateFrom = dateFrom
      }
      if (dateTo) {
        const inclusiveDateTo = new Date(dateTo)
        inclusiveDateTo.setUTCDate(inclusiveDateTo.getUTCDate() + 1)
        filterClauses.push(`${quoteColumn(dateFilterColumn)} < @listDateTo`)
        filterParams.listDateTo = inclusiveDateTo
      }
    }
    if (columns.includes('updated_at') && req.query.updatedAfter) {
      const updatedAfter = new Date(req.query.updatedAfter)
      if (Number.isNaN(updatedAfter.getTime())) {
        return res.status(400).json({ error: 'BadRequest', message: 'updatedAfter must be a valid date' })
      }
      filterClauses.push('[updated_at] > @updatedAfter')
      filterParams.updatedAfter = updatedAfter
    }

    const requestedLimit = req.query.limit ?? req.query.pageSize
    const paged = requestedLimit !== undefined || defaultPageSize !== null
    const limit = boundedInteger(requestedLimit, defaultPageSize ?? 100, env.listMaxPageSize) || 1
    const page = boundedInteger(req.query.page, 1) || 1
    const offset = req.query.offset === undefined
      ? (page - 1) * limit
      : boundedInteger(req.query.offset, 0)
    const includeTotal = ['1', 'true', 'yes'].includes(String(req.query.includeTotal || '').toLowerCase())
    const requestedSort = String(req.query.sortBy || '')
    const sortDirection = String(req.query.sortDirection || '').toLowerCase() === 'asc' ? 'asc' : 'desc'
    const orderBy = columns.includes(requestedSort) ? `${quoteColumn(requestedSort)} ${sortDirection}` : defaultOrder
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
      order by ${orderBy}
      ${paged ? 'offset @listOffset rows fetch next @listLimit rows only' : ''};
      ${includeTotal ? `select count_big(1) as total from ${table} where 1 = 1${where};` : ''}
    `)
    res.set('Accept-Ranges', 'records')
    if (paged) {
      res.set('X-Page-Size', String(limit))
      res.set('X-Page-Offset', String(offset))
    }
    if (includeTotal) res.set('X-Total-Count', String(result.recordsets[1]?.[0]?.total || 0))
    res.json(result.recordset.map(presentRow))
  }))

  router.get('/:id', permit('view'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope, ownerColumn }) : { where: '', params: {} }
    const request = bindParams(pool.request(), scoped.params)
    const result = await request
      .input('id', req.params.id)
      .query(`select ${selectColumns} from ${table} where ${quoteColumn(key)} = @id${scoped.where}`)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    res.json(presentRow(result.recordset[0]))
  }))

  if (readOnly) {
    router.use((req, res) => res.status(405).json({
      error: 'CommandRequired',
      message: 'This resource is read-only. Use the transactional command endpoint for changes.'
    }))
    return router
  }

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
    if (beforeCreate) payload = await beforeCreate({ pool, payload, req })
    Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    const insertColumns = [
      ...insertable.filter(column => payload[column] !== undefined),
      ...(ownerColumn && columns.includes(ownerColumn) && payload[ownerColumn] ? [ownerColumn] : [])
    ]
    if (!insertColumns.length) return res.status(400).json({ error: 'BadRequest', message: 'No fields supplied' })
    if (hasTriggers && payload[key] === undefined) {
      return res.status(400).json({ error: 'BadRequest', message: `${key} is required for this resource` })
    }
    const request = bindParams(pool.request(), Object.fromEntries(insertColumns.map(column => [column, payload[column]])))
    const result = await request.query(hasTriggers ? `
      insert into ${table} (${insertColumns.join(', ')})
      values (${insertColumns.map(column => `@${column}`).join(', ')});
      select ${selectColumns} from ${table} where ${quoteColumn(key)} = @${key};
    ` : `
      insert into ${table} (${insertColumns.join(', ')})
      output inserted.*
      values (${insertColumns.map(column => `@${column}`).join(', ')})
    `)
    emitChange(req, { moduleName, relatedModules, table, action: 'create', key, id: result.recordset[0]?.[key] }, result.recordset[0])
    res.status(201).json(presentRow(result.recordset[0]))
  }))

  router.put('/:id', permit('edit'), asyncHandler(async (req, res) => {
    let payload = normalizePayload(req.body || {})
    Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    const pool = await getPool()
    payload = await normalizeForeignKeys(pool, payload, { table })
    if (scope) assertPayloadWithinScope({ user: req.user, payload, ...scope })
    await ownerFromAccessibleSource(pool, payload, req.user, ownerSources)
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope, ownerColumn }) : { where: '', params: {} }
    let current = null
    if (beforeUpdate || additionalUpdatePermission) {
      const existingRequest = bindParams(pool.request(), scoped.params)
      const existingResult = await existingRequest
        .input('id', req.params.id)
        .query(`select ${selectColumns} from ${table} where ${quoteColumn(key)} = @id${scoped.where}`)
      if (!existingResult.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
      current = existingResult.recordset[0]
    }
    if (additionalUpdatePermission) {
      const action = await additionalUpdatePermission({ pool, payload, current, id: req.params.id, req })
      if (action) await assertPermission(req.user, moduleName, action)
    }
    if (beforeUpdate) {
      payload = await beforeUpdate({ pool, payload, current, id: req.params.id, req })
      Object.keys(payload).forEach(column => assertKnownColumn(columns, column))
    }
    const updateColumns = editable.filter(column => payload[column] !== undefined)
    if (!updateColumns.length) return res.status(400).json({ error: 'BadRequest', message: 'No editable fields supplied' })
    const request = bindParams(pool.request(), {
      ...Object.fromEntries(updateColumns.map(column => [column, payload[column]])),
      ...scoped.params
    })
    request.input('id', req.params.id)
    const timestampUpdate = columns.includes('updated_at') ? ', updated_at = sysutcdatetime()' : ''
    const result = await request.query(hasTriggers ? `
      update ${table}
      set ${updateColumns.map(column => `${column} = @${column}`).join(', ')}${timestampUpdate}
      where ${quoteColumn(key)} = @id${scoped.where};
      select ${selectColumns} from ${table} where ${quoteColumn(key)} = @id${scoped.where};
    ` : `
      update ${table}
      set ${updateColumns.map(column => `${column} = @${column}`).join(', ')}${timestampUpdate}
      output inserted.*
      where ${quoteColumn(key)} = @id${scoped.where}
    `)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    emitChange(req, { moduleName, relatedModules, table, action: 'edit', key, id: result.recordset[0]?.[key] }, result.recordset[0])
    res.json(presentRow(result.recordset[0]))
  }))

  router.delete('/:id', permit('edit'), asyncHandler(async (req, res) => {
    const pool = await getPool()
    const scoped = scope ? addScopeWhere({ user: req.user, ...scope, ownerColumn }) : { where: '', params: {} }
    const request = bindParams(pool.request(), scoped.params)
    request.input('id', req.params.id)
    const result = await request.query(hasTriggers ? `
      set xact_abort on;
      begin transaction;
      select ${selectColumns} from ${table} where ${quoteColumn(key)} = @id${scoped.where};
      delete from ${table} where ${quoteColumn(key)} = @id${scoped.where};
      commit transaction;
    ` : `delete from ${table} output deleted.* where ${quoteColumn(key)} = @id${scoped.where}`)
    if (!result.recordset[0]) return res.status(404).json({ error: 'NotFound', message: 'Record not found' })
    emitChange(req, { moduleName, relatedModules, table, action: 'delete', key, id: result.recordset[0]?.[key] }, result.recordset[0])
    res.json({ deleted: presentRow(result.recordset[0]) })
  }))

  return router
}
