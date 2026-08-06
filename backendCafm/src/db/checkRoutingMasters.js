import { getPool } from './pool.js'
import { validateLaborRouting, validateWorkGroupMaster, validateWorkOrderRouting } from '../services/routingMasters.js'

const pool = await getPool()
const result = await pool.request().query(`
  select
    (select count_big(1) from dbo.systems) as systems,
    (select count_big(1) from dbo.work_groups) as work_groups,
    (select count_big(1) from dbo.role_permissions where module_name = 'Routing Masters' and allowed = 1) as permissions,
    (select count_big(1) from dbo.assets where nullif(ltrim(rtrim(system_name)), '') is not null) as assets_with_system,
    (select count_big(1) from dbo.work_orders where nullif(ltrim(rtrim(system_name)), '') is not null) as work_orders_with_system,
    (select count_big(1) from dbo.work_orders where nullif(ltrim(rtrim(work_group)), '') is not null) as work_orders_with_group,
    (select count_big(1) from dbo.work_orders where nullif(ltrim(rtrim(supervisor)), '') is not null) as work_orders_with_supervisor,
    (select count_big(1) from dbo.labor where work_group_code is not null) as labor_with_work_group;

  select labor.labor_id, labor.display_name, labor.site_code, labor.department_name, labor.sub_department_code,
    labor.work_group_code, labor.status,
    linked.user_id as linked_user_id,
    linked.site_codes as linked_user_sites
  from dbo.labor labor
  outer apply (
    select top 1 users.user_id,
      (select string_agg(access.site_code, ',') from dbo.user_site_access access where access.user_id = users.user_id) as site_codes
    from dbo.users users
    where users.labor_id = labor.labor_id
    order by users.user_id
  ) linked
  where upper(ltrim(rtrim(labor.status))) <> 'INACTIVE'
  order by labor.department_name, labor.labor_id;

  select count_big(1) as invalid_work_group_supervisors
  from dbo.work_groups work_group
  left join dbo.labor supervisor on supervisor.labor_id = work_group.default_supervisor_labor_id
  where work_group.default_supervisor_labor_id is not null
    and (
      supervisor.labor_id is null
      or isnull(supervisor.site_code, '') <> work_group.site_code
      or lower(ltrim(rtrim(supervisor.department_name))) <> lower(ltrim(rtrim(work_group.department_name)))
    );

  select work_order.work_order_num, work_order.site_code, work_order.assigned_department_name, work_order.sub_department_code,
    work_order.supervisor
  from dbo.work_orders work_order
  outer apply (
    select top 1 labor_id, site_code, department_name, sub_department_code
    from dbo.labor
    where labor_id = work_order.supervisor or display_name = work_order.supervisor
    order by case when display_name = work_order.supervisor then 0 else 1 end, labor_id
  ) labor
  where nullif(ltrim(rtrim(work_order.supervisor)), '') is not null
    and (
      labor.labor_id is null
      or isnull(labor.site_code, '') <> work_order.site_code
      or lower(ltrim(rtrim(isnull(labor.department_name, '')))) <> lower(ltrim(rtrim(isnull(work_order.assigned_department_name, work_order.department_name))))
      or (work_order.sub_department_code is not null and labor.sub_department_code is not null and labor.sub_department_code <> work_order.sub_department_code)
    );

  select count_big(1) as invalid_labor_team_scope
  from dbo.labor labor
  left join dbo.work_groups work_group on work_group.work_group_code = labor.work_group_code
  where labor.work_group_code is not null
    and (
      work_group.work_group_code is null
      or isnull(labor.site_code, '') <> work_group.site_code
      or lower(ltrim(rtrim(isnull(labor.department_name, '')))) <> lower(ltrim(rtrim(work_group.department_name)))
      or (work_group.sub_department_code is not null and labor.sub_department_code is not null and labor.sub_department_code <> work_group.sub_department_code)
    );

  select count_big(1) as planned_labor_outside_team
  from dbo.work_order_planned_labor planned
  join dbo.work_orders work_order on work_order.work_order_num = planned.work_order_num
  left join dbo.work_groups work_group on work_group.work_group_code = work_order.work_group
  left join dbo.labor labor
    on labor.labor_id = planned.assigned_crew
    or lower(ltrim(rtrim(labor.display_name))) = lower(ltrim(rtrim(planned.assigned_crew)))
  where nullif(ltrim(rtrim(planned.assigned_crew)), '') is not null
    and (
      work_group.work_group_code is null
      or isnull(work_group.default_supervisor_labor_id, '') <> isnull(work_order.supervisor, '')
      or labor.labor_id is null
      or isnull(labor.work_group_code, '') <> isnull(work_group.work_group_code, '')
    );
`)

let invalidReferenceRejected = false
let invalidLaborTeamRejected = false
let missingTeamSupervisorRejected = false
try {
  await validateWorkOrderRouting({
    pool,
    payload: {
      site_code: '1031',
      department_name: 'Civil',
      assigned_department_name: 'Civil',
      sub_department_code: '1-1-1',
      system_name: '__INVALID_SYSTEM__'
    }
  })
} catch (error) {
  invalidReferenceRejected = error?.status === 400
}

try {
  await validateLaborRouting({
    pool,
    payload: {
      site_code: '1031',
      department_name: 'Civil',
      sub_department_code: '1-1-1',
      work_group_code: '__INVALID_WORK_GROUP__'
    }
  })
} catch (error) {
  invalidLaborTeamRejected = error?.status === 400
}

try {
  await validateWorkGroupMaster({
    pool,
    payload: {
      site_code: '1031',
      department_name: 'Civil',
      sub_department_code: '1-1-1',
      default_supervisor_labor_id: ''
    }
  })
} catch (error) {
  missingTeamSupervisorRejected = error?.status === 400
}

if (!invalidReferenceRejected) throw new Error('Routing validation accepted an invalid System reference.')
if (!invalidLaborTeamRejected) throw new Error('Routing validation accepted an invalid Labor Work Group reference.')
if (!missingTeamSupervisorRejected) throw new Error('Routing validation accepted a Work Group without a Supervisor.')

console.log(JSON.stringify({
  ...result.recordsets[0][0],
  activeLabor: result.recordsets[1],
  invalidWorkGroupSupervisors: Number(result.recordsets[2][0]?.invalid_work_group_supervisors || 0),
  invalidWorkOrderSupervisors: result.recordsets[3],
  invalidLaborTeamScope: Number(result.recordsets[4][0]?.invalid_labor_team_scope || 0),
  plannedLaborOutsideTeam: Number(result.recordsets[5][0]?.planned_labor_outside_team || 0),
  invalidReferenceRejected,
  invalidLaborTeamRejected,
  missingTeamSupervisorRejected
}, null, 2))

await pool.close()
