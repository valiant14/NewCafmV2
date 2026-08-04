import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { closePool, getPool } from './pool.js'

const baseUrl = String(process.env.PERF_TEST_URL || `http://127.0.0.1:${env.port}/api`).replace(/\/$/, '')
const iterations = Math.min(200, Math.max(2, Number(process.env.PERF_TEST_ITERATIONS) || 25))

try {
  const pool = await getPool()
  const found = await pool.request()
    .input('active', 'Active')
    .input('module', 'Work Orders')
    .input('action', 'view')
    .query(`
      select top 1 u.user_id
      from dbo.users u
      join dbo.roles r on r.role_id = u.role_id
      join dbo.role_permissions p on p.role_id = r.role_id and p.allowed = 1
      where u.status = @active
        and r.status = @active
        and p.module_name = @module
        and p.action_name = @action
      order by u.user_id
    `)
  const userId = found.recordset[0]?.user_id
  if (!userId) throw new Error('No active user has Work Orders view permission.')

  const token = jwt.sign({ userId, siteCodes: [], departments: [] }, env.jwtSecret, { expiresIn: '2m' })
  const headers = { Authorization: `Bearer ${token}` }
  const endpoint = `${baseUrl}/work-orders?limit=2&includeTotal=true`
  const healthBefore = await (await fetch(`${baseUrl}/health`)).json()
  const startedAt = performance.now()
  const first = await fetch(endpoint, { headers })
  const rows = await first.json()
  const firstDurationMs = performance.now() - startedAt
  if (!first.ok) throw new Error(rows?.message || `Performance request failed with HTTP ${first.status}.`)

  const warmDurations = []
  for (let index = 1; index < iterations; index += 1) {
    const warmStartedAt = performance.now()
    const response = await fetch(endpoint, { headers })
    await response.arrayBuffer()
    if (!response.ok) throw new Error(`Warm performance request failed with HTTP ${response.status}.`)
    warmDurations.push(performance.now() - warmStartedAt)
  }
  const sortedWarmDurations = [...warmDurations].sort((left, right) => left - right)
  const health = await (await fetch(`${baseUrl}/health`)).json()
  const warmAverageMs = warmDurations.reduce((sum, value) => sum + value, 0) / warmDurations.length
  const warmP95Ms = sortedWarmDurations[Math.min(sortedWarmDurations.length - 1, Math.floor(sortedWarmDurations.length * 0.95))]

  console.log(JSON.stringify({
    endpoint,
    status: first.status,
    returnedRows: rows.length,
    pageSize: Number(first.headers.get('x-page-size') || 0),
    totalRows: Number(first.headers.get('x-total-count') || 0),
    iterations,
    firstDurationMs: Math.round(firstDurationMs * 100) / 100,
    warmAverageMs: Math.round(warmAverageMs * 100) / 100,
    warmP95Ms: Math.round(warmP95Ms * 100) / 100,
    permissionCacheEntries: health.permissionCache?.entries,
    apiPool: health.database,
    apiMemoryMb: health.runtime?.memoryMb,
    heapDeltaMb: Math.round(((health.runtime?.memoryMb?.heapUsed || 0) - (healthBefore.runtime?.memoryMb?.heapUsed || 0)) * 100) / 100
  }, null, 2))
} finally {
  await closePool().catch(() => {})
}
