import { getPool } from './pool.js'

try {
  const pool = await getPool()
  const result = await pool.request().query('select getdate() as serverTime')
  console.log('MSSQL connected:', result.recordset[0].serverTime)
  process.exit(0)
} catch (error) {
  console.error('MSSQL connection failed:', error.message)
  process.exit(1)
}
