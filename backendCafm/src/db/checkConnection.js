import { getPool } from './pool.js'
import { env } from '../config/env.js'

try {
  console.log(`Checking MSSQL ${env.db.user}@${env.db.server}:${env.db.port}/${env.db.database} ...`)
  const pool = await getPool()
  const result = await pool.request().query('select getdate() as serverTime')
  console.log('MSSQL connected:', result.recordset[0].serverTime)
  process.exit(0)
} catch (error) {
  console.error('MSSQL connection failed:', error.message)
  process.exit(1)
}
