import bcrypt from 'bcryptjs'
import { getPool } from './pool.js'

const pool = await getPool()
const result = await pool.request().query(`
  select
    u.user_id,
    u.username,
    u.display_name,
    u.status,
    u.password_hash,
    r.role_name,
    case when u.password_hash like '$2%' then 'bcrypt' else 'not-bcrypt' end as password_format,
    len(isnull(u.password_hash, '')) as password_hash_length,
    isnull((select string_agg(s.site_code, ', ') from dbo.user_site_access s where s.user_id = u.user_id), 'All Sites') as sites,
    isnull((select string_agg(coalesce(d.sub_department_code, d.department_name), ', ') from dbo.user_department_access d where d.user_id = u.user_id), 'All Departments') as departments
  from dbo.users u
  left join dbo.roles r on r.role_id = u.role_id
  order by u.user_id
`)

const commonPasswords = ['admin123', 'password', 'Password123!', 'ChangeMe123!']
const weakPasswordUsers = new Set()
for (const row of result.recordset) {
  if (row.password_format !== 'bcrypt' || String(row.status || '').trim().toLowerCase() !== 'active') continue
  for (const candidate of commonPasswords) {
    if (await bcrypt.compare(candidate, row.password_hash)) {
      weakPasswordUsers.add(row.user_id)
      break
    }
  }
}

console.table(result.recordset.map(row => ({
  user_id: row.user_id,
  username: row.username,
  status: row.status,
  role: row.role_name || 'MISSING ROLE',
  password: row.password_format,
  weak_password: weakPasswordUsers.has(row.user_id) ? 'YES' : '',
  hash_len: row.password_hash_length,
  sites: row.sites,
  departments: row.departments
})))

const blocked = result.recordset.filter(row =>
  String(row.status || '').trim().toLowerCase() !== 'active'
  || !row.role_name
  || row.password_format !== 'bcrypt'
)
const weakUsers = result.recordset.filter(row => weakPasswordUsers.has(row.user_id))

if (blocked.length) {
  console.log('\nUsers that may fail login:')
  for (const row of blocked) {
    const reasons = []
    if (String(row.status || '').trim().toLowerCase() !== 'active') reasons.push(`status is "${row.status}"`)
    if (!row.role_name) reasons.push('missing role')
    if (row.password_format !== 'bcrypt') reasons.push('password_hash is not bcrypt')
    console.log(`- ${row.username}: ${reasons.join(', ')}`)
  }
} else {
  console.log('\nAll users look login-ready.')
}

if (weakUsers.length) {
  console.log('\nActive users requiring password rotation:')
  for (const row of weakUsers) console.log(`- ${row.username}: password matches a known default or common value`)
}

process.exit(0)
