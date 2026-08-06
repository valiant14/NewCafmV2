import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { closePool, getPool } from './pool.js'

const issues = []
const warnings = []
const commonPasswords = ['admin123', 'password', 'Password123!', 'ChangeMe123!']
const unsafeJwtSecrets = new Set(['dev-only-secret', 'change-this-before-production'])
const pool = await getPool()

try {
  const result = await pool.request().query(`
    select u.user_id, u.username, u.password_hash, u.status, r.role_id,
      case when u.data_scope_override = 'ROLE' then r.data_scope else u.data_scope_override end as effective_scope,
      (select count_big(1) from dbo.user_site_access s where s.user_id = u.user_id) as site_count,
      (select count_big(1) from dbo.user_department_access d where d.user_id = u.user_id) as department_count
    from dbo.users u
    left join dbo.roles r on r.role_id = u.role_id;

    select count_big(1) as configured,
      sum(case when secret_value like 'enc:v1:%' then 1 else 0 end) as encrypted
    from dbo.smtp_sms_connectors
    where nullif(secret_value, '') is not null;

    select entity, missing_owner from (
      select 'service_requests' as entity, sum(case when created_by_user_id is null then 1 else 0 end) as missing_owner from dbo.service_requests
      union all select 'work_orders', sum(case when created_by_user_id is null then 1 else 0 end) from dbo.work_orders
      union all select 'purchase_requisitions', sum(case when created_by_user_id is null then 1 else 0 end) from dbo.purchase_requisitions
      union all select 'purchase_orders', sum(case when created_by_user_id is null then 1 else 0 end) from dbo.purchase_orders
      union all select 'inventory_reservations', sum(case when created_by_user_id is null then 1 else 0 end) from dbo.inventory_reservations
      union all select 'incidents', sum(case when created_by_user_id is null then 1 else 0 end) from dbo.incidents
      union all select 'meter_readings', sum(case when created_by_user_id is null then 1 else 0 end) from dbo.meter_readings
    ) ownership;
  `)

  for (const account of result.recordsets[0] || []) {
    if (String(account.status || '').toLowerCase() !== 'active') continue
    if (!account.role_id) issues.push(`Active user ${account.username} has no role.`)
    if (!String(account.password_hash || '').startsWith('$2')) {
      issues.push(`Active user ${account.username} does not have a bcrypt password.`)
      continue
    }
    for (const candidate of commonPasswords) {
      if (await bcrypt.compare(candidate, account.password_hash)) {
        issues.push(`Active user ${account.username} uses a known default or common password.`)
        break
      }
    }
    if (String(account.effective_scope || '').toUpperCase() !== 'GLOBAL') {
      if (!Number(account.site_count)) issues.push(`Scoped user ${account.username} has no site assignment.`)
      if (!Number(account.department_count)) issues.push(`Scoped user ${account.username} has no department assignment.`)
    }
  }

  const connectors = result.recordsets[1]?.[0] || {}
  const configuredConnectors = Number(connectors.configured || 0)
  const encryptedConnectors = Number(connectors.encrypted || 0)
  if (configuredConnectors > encryptedConnectors) {
    issues.push(`${configuredConnectors - encryptedConnectors} connector credential(s) remain unencrypted.`)
  }
  if (String(env.connectorSecretKey || '').length < 32) {
    issues.push('CONNECTOR_SECRET_KEY is missing or shorter than 32 characters.')
  }

  for (const row of result.recordsets[2] || []) {
    if (Number(row.missing_owner || 0)) issues.push(`${row.entity} has ${Number(row.missing_owner)} record(s) without an owner.`)
  }

  if (env.nodeEnv !== 'production') issues.push('NODE_ENV must be production before deployment.')
  if (String(env.jwtSecret || '').length < 32 || unsafeJwtSecrets.has(String(env.jwtSecret || ''))) {
    issues.push('JWT_SECRET must be a unique value of at least 32 characters.')
  }
  if (!process.env.CORS_ORIGIN || /localhost|127\.0\.0\.1/i.test(env.corsOrigin)) {
    issues.push('CORS_ORIGIN must be set to the deployed frontend origin.')
  }
  if (!String(env.db.password || '')) issues.push('MSSQL_PASSWORD is required.')
  if (String(env.db.user || '').toLowerCase() === 'sa') issues.push('MSSQL_USER must be a dedicated least-privilege application login, not sa.')
  if (!env.db.options.encrypt) issues.push('MSSQL_ENCRYPT must be true in production.')
  if (env.db.options.trustServerCertificate) warnings.push('MSSQL_TRUST_SERVER_CERTIFICATE should be false when a trusted SQL certificate is available.')

  console.log(JSON.stringify({
    ready: issues.length === 0,
    issues,
    warnings,
    checks: {
      activeUsers: (result.recordsets[0] || []).filter(row => String(row.status || '').toLowerCase() === 'active').length,
      configuredConnectors,
      encryptedConnectors,
      ownershipTables: (result.recordsets[2] || []).length
    }
  }, null, 2))
  if (issues.length) process.exitCode = 1
} finally {
  await closePool()
}
