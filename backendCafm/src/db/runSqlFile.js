import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fileArg = process.argv[2]

if (!fileArg) {
  console.error('Usage: node src/db/runSqlFile.js <sql-file>')
  process.exit(1)
}

const sqlPath = path.resolve(__dirname, '..', '..', fileArg)
const sqlText = fs.readFileSync(sqlPath, 'utf8')
const batches = sqlText
  .split(/^\s*go\s*;?\s*$/gim)
  .map(batch => batch.trim())
  .filter(Boolean)

const pool = await getPool()

for (const batch of batches) {
  await pool.request().batch(batch)
}

console.log(`Executed ${batches.length} SQL batch(es): ${fileArg}`)
process.exit(0)
