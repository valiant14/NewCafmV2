set nocount on;
set xact_abort on;

begin transaction;

-- Older user imports sometimes stored a sub-department code in department_name.
delete access_row
from dbo.user_department_access access_row
join dbo.departments department
  on department.sub_department_code = access_row.department_name
where exists (
  select 1
  from dbo.user_department_access existing
  where existing.user_id = access_row.user_id
    and existing.department_name = department.department_name
    and existing.sub_department_code = department.sub_department_code
);

update access_row
set department_name = department.department_name,
    sub_department_code = department.sub_department_code
from dbo.user_department_access access_row
join dbo.departments department
  on department.sub_department_code = access_row.department_name;

-- A linked labor record is an authoritative default only when the user has no scope yet.
insert into dbo.user_site_access(user_id, site_code)
select app_user.user_id, labor.site_code
from dbo.users app_user
join dbo.roles role on role.role_id = app_user.role_id
join dbo.labor labor on labor.labor_id = app_user.labor_id
where app_user.status = 'Active'
  and case when app_user.data_scope_override = 'ROLE' then role.data_scope else app_user.data_scope_override end <> 'GLOBAL'
  and labor.site_code is not null
  and not exists (select 1 from dbo.user_site_access existing where existing.user_id = app_user.user_id);

insert into dbo.user_department_access(user_id, department_name, sub_department_code)
select app_user.user_id, labor.department_name, labor.sub_department_code
from dbo.users app_user
join dbo.roles role on role.role_id = app_user.role_id
join dbo.labor labor on labor.labor_id = app_user.labor_id
where app_user.status = 'Active'
  and case when app_user.data_scope_override = 'ROLE' then role.data_scope else app_user.data_scope_override end <> 'GLOBAL'
  and labor.department_name is not null
  and not exists (select 1 from dbo.user_department_access existing where existing.user_id = app_user.user_id);

-- Supply-chain managers operate only where an active warehouse exists, across active departments.
insert into dbo.user_site_access(user_id, site_code)
select distinct app_user.user_id, store.site_code
from dbo.users app_user
join dbo.roles role on role.role_id = app_user.role_id
join dbo.storerooms store on store.status = 'Active' and store.site_code is not null
where app_user.status = 'Active'
  and role.role_code like 'SUPPLY_CHAIN%'
  and not exists (select 1 from dbo.user_site_access existing where existing.user_id = app_user.user_id);

insert into dbo.user_department_access(user_id, department_name, sub_department_code)
select app_user.user_id, department.department_name, null
from dbo.users app_user
join dbo.roles role on role.role_id = app_user.role_id
cross join (
  select distinct department_name
  from dbo.departments
  where status = 'Active' and nullif(ltrim(rtrim(department_name)), '') is not null
) department
where app_user.status = 'Active'
  and role.role_code like 'SUPPLY_CHAIN%'
  and not exists (select 1 from dbo.user_department_access existing where existing.user_id = app_user.user_id);

-- Preserve honest provenance for imported rows whose human creator cannot be reconstructed.
if not exists (select 1 from dbo.users where user_id = 'USR-LEGACY')
begin
  declare @legacy_role_id int = (
    select top 1 role_id
    from dbo.roles
    order by case when role_code = 'FACILITY_MANAGER' then 0 else 1 end, role_id
  );

  insert into dbo.users(
    user_id, username, password_hash, display_name, email, role_id,
    labor_id, data_scope_override, status
  )
  values(
    'USR-LEGACY', 'legacy.data.import', '!LOGIN-DISABLED!', 'Legacy Data Import', '',
    @legacy_role_id, null, 'OWN', 'Inactive'
  );
end;

-- Re-run deterministic ownership inference, including the labor-master relationship omitted by the original migration.
update service_request
set created_by_user_id = matched.user_id
from dbo.service_requests service_request
outer apply (
  select top 1 app_user.user_id
  from dbo.users app_user
  where lower(ltrim(rtrim(service_request.reported_by))) in (
    lower(ltrim(rtrim(app_user.user_id))),
    lower(ltrim(rtrim(app_user.username))),
    lower(ltrim(rtrim(app_user.display_name))),
    lower(ltrim(rtrim(isnull(app_user.email, ''))))
  )
  order by app_user.user_id
) matched
where (service_request.created_by_user_id is null or service_request.created_by_user_id = 'USR-LEGACY')
  and matched.user_id is not null;

update incident
set created_by_user_id = matched.user_id
from dbo.incidents incident
outer apply (
  select top 1 app_user.user_id
  from dbo.users app_user
  where lower(ltrim(rtrim(incident.reported_by))) in (
    lower(ltrim(rtrim(app_user.user_id))),
    lower(ltrim(rtrim(app_user.username))),
    lower(ltrim(rtrim(app_user.display_name))),
    lower(ltrim(rtrim(isnull(app_user.email, ''))))
  )
  order by app_user.user_id
) matched
where (incident.created_by_user_id is null or incident.created_by_user_id = 'USR-LEGACY')
  and matched.user_id is not null;

update work_order
set created_by_user_id = service_request.created_by_user_id
from dbo.work_orders work_order
join dbo.service_requests service_request on service_request.sr_num = work_order.source_sr_num
where (work_order.created_by_user_id is null or work_order.created_by_user_id = 'USR-LEGACY')
  and service_request.created_by_user_id is not null
  and service_request.created_by_user_id <> 'USR-LEGACY';

update work_order
set created_by_user_id = preventive_maintenance.created_by_user_id
from dbo.work_orders work_order
join dbo.preventive_maintenance preventive_maintenance on preventive_maintenance.pm_num = work_order.pm_num
where (work_order.created_by_user_id is null or work_order.created_by_user_id = 'USR-LEGACY')
  and preventive_maintenance.created_by_user_id is not null
  and preventive_maintenance.created_by_user_id <> 'USR-LEGACY';

update work_order
set created_by_user_id = matched.user_id
from dbo.work_orders work_order
outer apply (
  select top 1 app_user.user_id
  from dbo.work_order_planned_labor planned
  left join dbo.labor labor on planned.assigned_crew in (labor.labor_id, labor.display_name)
  join dbo.users app_user
    on app_user.labor_id = labor.labor_id
    or planned.assigned_crew in (app_user.user_id, app_user.username, app_user.display_name)
  where planned.work_order_num = work_order.work_order_num
  order by planned.line_order, app_user.user_id
) matched
where (work_order.created_by_user_id is null or work_order.created_by_user_id = 'USR-LEGACY')
  and matched.user_id is not null;

update resource_request
set created_by_user_id = work_order.created_by_user_id
from dbo.work_order_resource_requests resource_request
join dbo.work_orders work_order on work_order.work_order_num = resource_request.work_order_num
where (resource_request.created_by_user_id is null or resource_request.created_by_user_id = 'USR-LEGACY')
  and work_order.created_by_user_id is not null
  and work_order.created_by_user_id <> 'USR-LEGACY';

update planned
set created_by_user_id = work_order.created_by_user_id
from dbo.work_order_planned_labor planned
join dbo.work_orders work_order on work_order.work_order_num = planned.work_order_num
where (planned.created_by_user_id is null or planned.created_by_user_id = 'USR-LEGACY')
  and work_order.created_by_user_id is not null
  and work_order.created_by_user_id <> 'USR-LEGACY';

update task
set created_by_user_id = work_order.created_by_user_id
from dbo.work_order_tasks task
join dbo.work_orders work_order on work_order.work_order_num = task.work_order_num
where (task.created_by_user_id is null or task.created_by_user_id = 'USR-LEGACY')
  and work_order.created_by_user_id is not null
  and work_order.created_by_user_id <> 'USR-LEGACY';

update requisition
set created_by_user_id = coalesce(nullif(work_order.created_by_user_id, 'USR-LEGACY'), nullif(resource_request.created_by_user_id, 'USR-LEGACY'))
from dbo.purchase_requisitions requisition
left join dbo.work_orders work_order on work_order.work_order_num = requisition.work_order_num
left join dbo.work_order_resource_requests resource_request on resource_request.resource_request_id = requisition.resource_request_id
where (requisition.created_by_user_id is null or requisition.created_by_user_id = 'USR-LEGACY')
  and coalesce(nullif(work_order.created_by_user_id, 'USR-LEGACY'), nullif(resource_request.created_by_user_id, 'USR-LEGACY')) is not null;

update purchase_order
set created_by_user_id = coalesce(nullif(work_order.created_by_user_id, 'USR-LEGACY'), nullif(requisition.created_by_user_id, 'USR-LEGACY'))
from dbo.purchase_orders purchase_order
left join dbo.work_orders work_order on work_order.work_order_num = purchase_order.work_order_num
left join dbo.purchase_requisitions requisition on requisition.pr_num = purchase_order.pr_num
where (purchase_order.created_by_user_id is null or purchase_order.created_by_user_id = 'USR-LEGACY')
  and coalesce(nullif(work_order.created_by_user_id, 'USR-LEGACY'), nullif(requisition.created_by_user_id, 'USR-LEGACY')) is not null;

update reservation
set created_by_user_id = coalesce(nullif(work_order.created_by_user_id, 'USR-LEGACY'), nullif(requisition.created_by_user_id, 'USR-LEGACY'), nullif(purchase_order.created_by_user_id, 'USR-LEGACY'))
from dbo.inventory_reservations reservation
left join dbo.work_orders work_order on work_order.work_order_num = reservation.work_order_num
left join dbo.purchase_requisitions requisition on requisition.pr_num = reservation.pr_num
left join dbo.purchase_orders purchase_order on purchase_order.po_num = reservation.po_num
where (reservation.created_by_user_id is null or reservation.created_by_user_id = 'USR-LEGACY')
  and coalesce(nullif(work_order.created_by_user_id, 'USR-LEGACY'), nullif(requisition.created_by_user_id, 'USR-LEGACY'), nullif(purchase_order.created_by_user_id, 'USR-LEGACY')) is not null;

update reading
set created_by_user_id = work_order.created_by_user_id
from dbo.meter_readings reading
join dbo.work_orders work_order on work_order.work_order_num = reading.work_order_num
where (reading.created_by_user_id is null or reading.created_by_user_id = 'USR-LEGACY')
  and work_order.created_by_user_id is not null
  and work_order.created_by_user_id <> 'USR-LEGACY';

update dbo.service_requests set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.work_orders set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.work_order_resource_requests set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.work_order_planned_labor set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.work_order_tasks set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.purchase_requisitions set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.purchase_orders set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.inventory_reservations set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.preventive_maintenance set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.incidents set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.meter_readings set created_by_user_id = 'USR-LEGACY' where created_by_user_id is null;
update dbo.attachments set uploaded_by_user_id = 'USR-LEGACY' where uploaded_by_user_id is null;

commit transaction;
go
