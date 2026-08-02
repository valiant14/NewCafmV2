import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fileArg = process.argv[2]
const ignoreExisting = process.argv.includes('--ignore-existing')

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
let skipped = 0
const existingObjectNumbers = [1913, 2714]
const isExistingObjectError = error =>
  existingObjectNumbers.includes(error.number) ||
  error.precedingErrors?.some(item => existingObjectNumbers.includes(item.number))

for (const batch of batches) {
  try {
    await pool.request().batch(batch)
  } catch (error) {
    if (ignoreExisting && isExistingObjectError(error)) {
      skipped += 1
      continue
    }
    throw error
  }
}

console.log(`Executed ${batches.length - skipped} SQL batch(es): ${fileArg}${skipped ? ` (${skipped} existing object batch(es) skipped)` : ''}`)
process.exit(0)
