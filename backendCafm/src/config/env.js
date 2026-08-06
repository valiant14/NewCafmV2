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
const nodeEnv = process.env.NODE_ENV || 'development'
const jwtSecret = process.env.JWT_SECRET || 'dev-only-secret'
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const dbPassword = process.env.MSSQL_PASSWORD || ''
const dbUser = process.env.MSSQL_USER || 'sa'
const dbEncrypt = bool(process.env.MSSQL_ENCRYPT)

export const env = {
  port: number(process.env.PORT, 4000, { min: 1, max: 65535 }),
  nodeEnv,
  corsOrigin,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  trustProxy: bool(process.env.TRUST_PROXY),
  authLoginWindowMs: number(process.env.AUTH_LOGIN_WINDOW_MS, 15 * 60 * 1000, { min: 60000, max: 24 * 60 * 60 * 1000 }),
  authLoginMaxAttempts: number(process.env.AUTH_LOGIN_MAX_ATTEMPTS, 8, { min: 3, max: 100 }),
  authLoginMaxKeys: number(process.env.AUTH_LOGIN_MAX_KEYS, 10000, { min: 100, max: 100000 }),
  pmSchedulerEnabled: !['false', '0', 'no'].includes(String(process.env.PM_SCHEDULER_ENABLED ?? 'true').toLowerCase()),
  pmSchedulerIntervalMs: number(process.env.PM_SCHEDULER_INTERVAL_MS, 20000, { min: 10000, max: 3600000 }),
  pmSchedulerBatchSize: number(process.env.PM_SCHEDULER_BATCH_SIZE, 100, { min: 1, max: 1000 }),
  pmSchedulerConcurrency: number(process.env.PM_SCHEDULER_CONCURRENCY, 4, { min: 1, max: 16 }),
  pmSchedulerMaxPasses: number(process.env.PM_SCHEDULER_MAX_PASSES, 12, { min: 1, max: 100 }),
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
  smtpTlsRejectUnauthorized: !['false', '0', 'no'].includes(String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? 'true').toLowerCase()),
  connectorSecretKey: process.env.CONNECTOR_SECRET_KEY || '',
  db: {
    server: process.env.MSSQL_SERVER || 'localhost',
    port: number(process.env.MSSQL_PORT, 1433, { min: 1, max: 65535 }),
    database: process.env.MSSQL_DATABASE || 'CafmV3',
    user: dbUser,
    password: dbPassword,
    connectionTimeout: number(process.env.MSSQL_CONNECTION_TIMEOUT, 10000, { min: 1000, max: 120000 }),
    requestTimeout: number(process.env.MSSQL_REQUEST_TIMEOUT, 30000, { min: 1000, max: 600000 }),
    options: {
      encrypt: dbEncrypt,
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

if (nodeEnv === 'production') {
  const configurationErrors = []
  if (jwtSecret.length < 32 || ['dev-only-secret', 'change-this-before-production'].includes(jwtSecret)) {
    configurationErrors.push('JWT_SECRET must be a unique value of at least 32 characters')
  }
  if (!process.env.CORS_ORIGIN || /localhost|127\.0\.0\.1/i.test(corsOrigin)) {
    configurationErrors.push('CORS_ORIGIN must be set to the deployed frontend origin')
  }
  if (!dbPassword) configurationErrors.push('MSSQL_PASSWORD is required')
  if (dbUser.toLowerCase() === 'sa') configurationErrors.push('MSSQL_USER must be a dedicated application login, not sa')
  if (!dbEncrypt) configurationErrors.push('MSSQL_ENCRYPT must be true')
  if (String(process.env.CONNECTOR_SECRET_KEY || '').length < 32) {
    configurationErrors.push('CONNECTOR_SECRET_KEY must contain at least 32 characters')
  }
  if (configurationErrors.length) {
    throw new Error(`Invalid production configuration: ${configurationErrors.join('; ')}`)
  }
}
