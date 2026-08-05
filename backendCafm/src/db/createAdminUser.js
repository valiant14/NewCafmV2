import bcrypt from 'bcryptjs'
import { getPool } from './pool.js'

const userId = process.env.ADMIN_USER_ID || 'USR-ADMIN'
const username = process.env.ADMIN_USERNAME || 'admin'
const password = process.env.ADMIN_PASSWORD || 'admin123'
const displayName = process.env.ADMIN_DISPLAY_NAME || 'System Administrator'
const email = process.env.ADMIN_EMAIL || 'admin@example.com'

const pool = await getPool()
const role = await pool.request()
  .input('roleCode', 'FACILITY_MANAGER')
  .query('select role_id from dbo.roles where role_code = @roleCode')

if (!role.recordset[0]) {
  console.error('FACILITY_MANAGER role not found. Run sql/002_seed_core.sql first.')
  process.exit(1)
}

const passwordHash = await bcrypt.hash(password, 10)

await pool.request()
  .input('userId', userId)
  .input('username', username)
  .input('passwordHash', passwordHash)
  .input('displayName', displayName)
  .input('email', email)
  .input('roleId', role.recordset[0].role_id)
  .query(`
    merge dbo.users as target
    using (select @userId as user_id) as source
    on target.user_id = source.user_id
    when matched then update set
      username = @username,
      password_hash = @passwordHash,
      display_name = @displayName,
      email = @email,
      role_id = @roleId,
      data_scope_override = 'GLOBAL',
      status = 'Active',
      updated_at = sysutcdatetime()
    when not matched then insert(user_id, username, password_hash, display_name, email, role_id, data_scope_override, status)
      values(@userId, @username, @passwordHash, @displayName, @email, @roleId, 'GLOBAL', 'Active');
  `)

console.log(`Admin user ready: ${username}`)
process.exit(0)
