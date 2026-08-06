import { closePool, getPool } from './pool.js'
import { env } from '../config/env.js'
import { encryptSecret, isEncryptedSecret } from '../services/secretVault.js'

if (String(env.connectorSecretKey || '').length < 32) {
  throw new Error('CONNECTOR_SECRET_KEY must contain at least 32 characters before connector credentials can be migrated.')
}

const pool = await getPool()
try {
  const result = await pool.request().query(`
    select connector_name, secret_value
    from dbo.smtp_sms_connectors
    where nullif(secret_value, '') is not null
  `)
  let migrated = 0
  for (const connector of result.recordset) {
    if (isEncryptedSecret(connector.secret_value)) continue
    await pool.request()
      .input('connectorName', connector.connector_name)
      .input('secretValue', encryptSecret(connector.secret_value))
      .query(`
        update dbo.smtp_sms_connectors
        set secret_value = @secretValue, updated_at = sysutcdatetime()
        where connector_name = @connectorName
      `)
    migrated += 1
  }
  console.log(`Connector secret migration complete. Encrypted ${migrated} credential${migrated === 1 ? '' : 's'}.`)
} finally {
  await closePool()
}
