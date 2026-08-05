import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config()

const bool = value => ['true', '1', 'yes'].includes(String(value || '').toLowerCase())
const number = (value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}
const dbPoolMax = number(process.env.MSSQL_POOL_MAX, 20, { min: 2, max: 100 })
const dbPoolMin = Math.min(dbPoolMax, number(process.env.MSSQL_POOL_MIN, 2, { min: 0, max: 20 }))

export const env = {
  port: number(process.env.PORT, 4000, { min: 1, max: 65535 }),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  pmSchedulerEnabled: !['false', '0', 'no'].includes(String(process.env.PM_SCHEDULER_ENABLED ?? 'true').toLowerCase()),
  pmSchedulerIntervalMs: number(process.env.PM_SCHEDULER_INTERVAL_MS, 20000, { min: 10000, max: 3600000 }),
  pmSchedulerBatchSize: number(process.env.PM_SCHEDULER_BATCH_SIZE, 100, { min: 1, max: 1000 }),
  pmSchedulerConcurrency: number(process.env.PM_SCHEDULER_CONCURRENCY, 4, { min: 1, max: 16 }),
  pmSchedulerDebug: ['true', '1', 'yes'].includes(String(process.env.PM_SCHEDULER_DEBUG || '').toLowerCase()),
  permissionCacheTtlMs: number(process.env.PERMISSION_CACHE_TTL_MS, 5000, { min: 0, max: 60000 }),
  permissionCacheMaxEntries: number(process.env.PERMISSION_CACHE_MAX_ENTRIES, 10000, { min: 100, max: 100000 }),
  listMaxPageSize: number(process.env.LIST_MAX_PAGE_SIZE, 500, { min: 50, max: 5000 }),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '10mb',
  attachmentMaxBytes: number(process.env.ATTACHMENT_MAX_BYTES, 25 * 1024 * 1024, { min: 1024, max: 250 * 1024 * 1024 }),
  attachmentStoragePath: path.resolve(process.cwd(), process.env.ATTACHMENT_STORAGE_PATH || 'storage/attachments'),
  socketMaxBufferBytes: number(process.env.SOCKET_MAX_BUFFER_BYTES, 1048576, { min: 65536, max: 10485760 }),
  serverKeepAliveTimeoutMs: number(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS, 65000, { min: 5000, max: 300000 }),
  serverHeadersTimeoutMs: number(process.env.SERVER_HEADERS_TIMEOUT_MS, 66000, { min: 6000, max: 310000 }),
  serverRequestTimeoutMs: number(process.env.SERVER_REQUEST_TIMEOUT_MS, 120000, { min: 10000, max: 600000 }),
  shutdownTimeoutMs: number(process.env.SHUTDOWN_TIMEOUT_MS, 10000, { min: 1000, max: 60000 }),
  db: {
    server: process.env.MSSQL_SERVER || 'localhost',
    port: number(process.env.MSSQL_PORT, 1433, { min: 1, max: 65535 }),
    database: process.env.MSSQL_DATABASE || 'CafmV3',
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD || '',
    connectionTimeout: number(process.env.MSSQL_CONNECTION_TIMEOUT, 10000, { min: 1000, max: 120000 }),
    requestTimeout: number(process.env.MSSQL_REQUEST_TIMEOUT, 30000, { min: 1000, max: 600000 }),
    options: {
      encrypt: bool(process.env.MSSQL_ENCRYPT),
      trustServerCertificate: bool(process.env.MSSQL_TRUST_SERVER_CERTIFICATE ?? 'true')
    },
    pool: {
      max: dbPoolMax,
      min: dbPoolMin,
      idleTimeoutMillis: number(process.env.MSSQL_POOL_IDLE_TIMEOUT_MS, 30000, { min: 5000, max: 300000 }),
      acquireTimeoutMillis: number(process.env.MSSQL_POOL_ACQUIRE_TIMEOUT_MS, 15000, { min: 1000, max: 120000 })
    }
  }
}
