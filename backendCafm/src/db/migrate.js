import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './pool.js'
import { migrateLegacyWorkOrderAttachments } from './migrateLegacyWorkOrderAttachments.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlDirectory = path.resolve(__dirname, '..', '..', 'sql')
const migrationFiles = [
  '008_work_order_planned_labor.sql',
  '009_work_order_tasks.sql',
  '010_work_order_resource_refs.sql',
  '011_repair_reservation_stock_posting.sql',
  '012_sync_active_reservations_to_stock.sql',
  '013_tools_equipment_detail_fields.sql',
  '014_supply_chain_resource_links.sql',
  '015_tools_low_level.sql',
  '020_work_order_actuals.sql',
  '021_ptw_required_default_yes.sql',
  '022_work_order_planning_permission.sql',
  '023_technician_job_request_create.sql',
  '024_pm_schedule_rules.sql',
  '027_smtp_sms_connectors.sql',
  '028_performance_indexes.sql',
  '029_incident_reporting_fields.sql',
  '030_user_transaction_scope.sql',
  '031_work_order_workflow_controls.sql',
  '032_dynamic_work_order_workflow.sql',
  '033_notification_rules.sql',
  '034_tools_site_scope.sql',
  '035_atomic_record_numbers.sql',
  '036_atomic_business_numbers.sql',
  '037_work_order_routing_fields.sql',
  '038_attachments.sql',
  '039_supply_chain_command_indexes.sql',
  '040_work_order_history_indexes.sql'
]

const batchesFor = fileName => fs.readFileSync(path.join(sqlDirectory, fileName), 'utf8')
  .split(/^\s*go\s*;?\s*$/gim)
  .map(batch => batch.trim())
  .filter(Boolean)

const pool = await getPool()
let batchCount = 0
for (const fileName of migrationFiles) {
  for (const batch of batchesFor(fileName)) {
    await pool.request().batch(batch)
    batchCount += 1
  }
  console.log(`Applied ${fileName}`)
}

const migratedAttachments = await migrateLegacyWorkOrderAttachments(pool)
if (migratedAttachments) console.log(`Migrated ${migratedAttachments} legacy work-order attachment(s).`)

console.log(`Database migrations complete: ${migrationFiles.length} file(s), ${batchCount} batch(es).`)
process.exit(0)
