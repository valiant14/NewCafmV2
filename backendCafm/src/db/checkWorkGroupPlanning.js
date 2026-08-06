import { getPool } from './pool.js'
import { laborForSupervisorTeam } from '../../../src/lib/routingMasters.js'

const pool = await getPool()
const result = await pool.request().query(`
  select work_group_code, work_group_name, site_code, department_name, sub_department_code,
    default_supervisor_labor_id, status
  from dbo.work_groups
  where upper(ltrim(rtrim(status))) <> 'INACTIVE';

  select labor_id, display_name, craft_code, craft_name, site_code, department_name,
    sub_department_code, work_group_code, availability, status
  from dbo.labor
  where upper(ltrim(rtrim(status))) <> 'INACTIVE';

  select work_order_num, site_code,
    coalesce(nullif(assigned_department_name, ''), department_name) as department_name,
    sub_department_code, work_group, supervisor
  from dbo.work_orders
  where nullif(ltrim(rtrim(work_group)), '') is not null;
`)

const groups = result.recordsets[0].map(row => ({
  code: row.work_group_code,
  name: row.work_group_name,
  site: row.site_code,
  department: row.department_name,
  subDepartment: row.sub_department_code || '',
  supervisorId: row.default_supervisor_labor_id || '',
  status: row.status
}))
const labor = result.recordsets[1].map(row => ({
  personId: row.labor_id,
  name: row.display_name,
  craftCode: row.craft_code || '',
  craft: row.craft_name || '',
  site: row.site_code || '',
  department: row.department_name || '',
  subDepartment: row.sub_department_code || '',
  workGroup: row.work_group_code || '',
  availability: row.availability || '',
  status: row.status
}))

const groupChecks = groups.map(group => {
  const members = laborForSupervisorTeam(labor, groups, {
    workGroup: group.code,
    supervisor: group.supervisorId,
    site: group.site,
    department: group.department,
    subDepartment: group.subDepartment
  })
  const expected = labor.filter(person => person.workGroup === group.code)
  if (members.length !== expected.length) {
    throw new Error(`${group.code} exposes ${members.length} planning members but MSSQL has ${expected.length} linked Labor records.`)
  }
  return { workGroup: group.code, supervisor: group.supervisorId, teamMembers: members.length }
})

const workOrderChecks = result.recordsets[2].map(order => {
  const members = laborForSupervisorTeam(labor, groups, {
    workGroup: order.work_group,
    supervisor: order.supervisor,
    site: order.site_code,
    department: order.department_name,
    subDepartment: order.sub_department_code || ''
  })
  const group = groups.find(item => item.code === order.work_group)
  if (!group) throw new Error(`Work Order ${order.work_order_num} references an unavailable Work Group.`)
  if (group.supervisorId !== order.supervisor) throw new Error(`Work Order ${order.work_order_num} does not use the Work Group supervisor.`)
  return { workOrder: order.work_order_num, workGroup: order.work_group, eligibleLabor: members.length }
})

console.log(JSON.stringify({ ready: true, groups: groupChecks, workOrders: workOrderChecks }, null, 2))
await pool.close()
