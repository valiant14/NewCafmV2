set nocount on;
set xact_abort on;

if col_length('dbo.roles', 'data_scope') is null
  alter table dbo.roles add data_scope nvarchar(30) not null constraint df_roles_data_scope default 'DEPARTMENT';

if col_length('dbo.users', 'data_scope_override') is null
  alter table dbo.users add data_scope_override nvarchar(30) not null constraint df_users_data_scope_override default 'ROLE';

go

update dbo.roles
set data_scope = case
  when role_code in ('FACILITY_MANAGER', 'HVAC_SUPERVISOR', 'CIVIL_TECHNICIAN') then 'DEPARTMENT'
  else coalesce(nullif(data_scope, ''), 'DEPARTMENT')
end,
updated_at = sysutcdatetime()
where role_code in ('FACILITY_MANAGER', 'HVAC_SUPERVISOR', 'CIVIL_TECHNICIAN')
   or data_scope is null
   or data_scope not in ('GLOBAL', 'DEPARTMENT', 'OWN');

update dbo.users
set data_scope_override = 'GLOBAL', updated_at = sysutcdatetime()
where user_id = 'USR-ADMIN' or username = 'admin';

if col_length('dbo.service_requests', 'created_by_user_id') is null
  alter table dbo.service_requests add created_by_user_id nvarchar(50) null;

if col_length('dbo.work_orders', 'created_by_user_id') is null
  alter table dbo.work_orders add created_by_user_id nvarchar(50) null;

if col_length('dbo.work_order_resource_requests', 'created_by_user_id') is null
  alter table dbo.work_order_resource_requests add created_by_user_id nvarchar(50) null;

if col_length('dbo.work_order_planned_labor', 'created_by_user_id') is null
  alter table dbo.work_order_planned_labor add created_by_user_id nvarchar(50) null;

if col_length('dbo.work_order_tasks', 'created_by_user_id') is null
  alter table dbo.work_order_tasks add created_by_user_id nvarchar(50) null;

if col_length('dbo.purchase_requisitions', 'created_by_user_id') is null
  alter table dbo.purchase_requisitions add created_by_user_id nvarchar(50) null;

if col_length('dbo.purchase_orders', 'created_by_user_id') is null
  alter table dbo.purchase_orders add created_by_user_id nvarchar(50) null;

if col_length('dbo.inventory_reservations', 'created_by_user_id') is null
  alter table dbo.inventory_reservations add created_by_user_id nvarchar(50) null;

if col_length('dbo.preventive_maintenance', 'created_by_user_id') is null
  alter table dbo.preventive_maintenance add created_by_user_id nvarchar(50) null;

if col_length('dbo.incidents', 'created_by_user_id') is null
  alter table dbo.incidents add created_by_user_id nvarchar(50) null;

if col_length('dbo.meter_readings', 'created_by_user_id') is null
  alter table dbo.meter_readings add created_by_user_id nvarchar(50) null;

go

update sr
set created_by_user_id = matched.user_id
from dbo.service_requests sr
outer apply (
  select top 1 u.user_id
  from dbo.users u
  where lower(ltrim(rtrim(sr.reported_by))) in (
    lower(ltrim(rtrim(u.user_id))),
    lower(ltrim(rtrim(u.username))),
    lower(ltrim(rtrim(u.display_name))),
    lower(ltrim(rtrim(isnull(u.email, ''))))
  )
  order by u.user_id
) matched
where sr.created_by_user_id is null and matched.user_id is not null;

update incident
set created_by_user_id = matched.user_id
from dbo.incidents incident
outer apply (
  select top 1 u.user_id
  from dbo.users u
  where lower(ltrim(rtrim(incident.reported_by))) in (
    lower(ltrim(rtrim(u.user_id))),
    lower(ltrim(rtrim(u.username))),
    lower(ltrim(rtrim(u.display_name))),
    lower(ltrim(rtrim(isnull(u.email, ''))))
  )
  order by u.user_id
) matched
where incident.created_by_user_id is null and matched.user_id is not null;

update wo
set created_by_user_id = sr.created_by_user_id
from dbo.work_orders wo
join dbo.service_requests sr on sr.sr_num = wo.source_sr_num
where wo.created_by_user_id is null and sr.created_by_user_id is not null;

update wo
set created_by_user_id = matched.user_id
from dbo.work_orders wo
outer apply (
  select top 1 u.user_id
  from dbo.work_order_planned_labor planned
  join dbo.users u on u.labor_id = planned.assigned_crew or u.user_id = planned.assigned_crew or u.display_name = planned.assigned_crew
  where planned.work_order_num = wo.work_order_num
  order by planned.line_order, u.user_id
) matched
where wo.created_by_user_id is null and matched.user_id is not null;

update resource_request
set created_by_user_id = wo.created_by_user_id
from dbo.work_order_resource_requests resource_request
join dbo.work_orders wo on wo.work_order_num = resource_request.work_order_num
where resource_request.created_by_user_id is null and wo.created_by_user_id is not null;

update planned
set created_by_user_id = wo.created_by_user_id
from dbo.work_order_planned_labor planned
join dbo.work_orders wo on wo.work_order_num = planned.work_order_num
where planned.created_by_user_id is null and wo.created_by_user_id is not null;

update task
set created_by_user_id = wo.created_by_user_id
from dbo.work_order_tasks task
join dbo.work_orders wo on wo.work_order_num = task.work_order_num
where task.created_by_user_id is null and wo.created_by_user_id is not null;

update requisition
set created_by_user_id = coalesce(wo.created_by_user_id, resource_request.created_by_user_id)
from dbo.purchase_requisitions requisition
left join dbo.work_orders wo on wo.work_order_num = requisition.work_order_num
left join dbo.work_order_resource_requests resource_request on resource_request.resource_request_id = requisition.resource_request_id
where requisition.created_by_user_id is null
  and coalesce(wo.created_by_user_id, resource_request.created_by_user_id) is not null;

update purchase_order
set created_by_user_id = coalesce(wo.created_by_user_id, requisition.created_by_user_id)
from dbo.purchase_orders purchase_order
left join dbo.work_orders wo on wo.work_order_num = purchase_order.work_order_num
left join dbo.purchase_requisitions requisition on requisition.pr_num = purchase_order.pr_num
where purchase_order.created_by_user_id is null
  and coalesce(wo.created_by_user_id, requisition.created_by_user_id) is not null;

update reservation
set created_by_user_id = coalesce(wo.created_by_user_id, requisition.created_by_user_id, purchase_order.created_by_user_id)
from dbo.inventory_reservations reservation
left join dbo.work_orders wo on wo.work_order_num = reservation.work_order_num
left join dbo.purchase_requisitions requisition on requisition.pr_num = reservation.pr_num
left join dbo.purchase_orders purchase_order on purchase_order.po_num = reservation.po_num
where reservation.created_by_user_id is null
  and coalesce(wo.created_by_user_id, requisition.created_by_user_id, purchase_order.created_by_user_id) is not null;

update reading
set created_by_user_id = wo.created_by_user_id
from dbo.meter_readings reading
join dbo.work_orders wo on wo.work_order_num = reading.work_order_num
where reading.created_by_user_id is null and wo.created_by_user_id is not null;

update pm
set created_by_user_id = matched.user_id
from dbo.preventive_maintenance pm
outer apply (
  select top 1 u.user_id
  from dbo.users u
  where u.user_id in (pm.supervisor, pm.lead_person)
     or u.username in (pm.supervisor, pm.lead_person)
     or u.display_name in (pm.supervisor, pm.lead_person)
  order by u.user_id
) matched
where pm.created_by_user_id is null and matched.user_id is not null;

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ix_work_orders_owner_scope')
  create index ix_work_orders_owner_scope on dbo.work_orders(created_by_user_id, site_code, department_name, reported_at desc) include(work_order_num, status, assigned_department_name);

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.service_requests') and name = 'ix_service_requests_owner_scope')
  create index ix_service_requests_owner_scope on dbo.service_requests(created_by_user_id, site_code, department_name, reported_at desc) include(sr_num, status, assigned_department_name);

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.purchase_requisitions') and name = 'ix_pr_owner_scope')
  create index ix_pr_owner_scope on dbo.purchase_requisitions(created_by_user_id, site_code, department_name, created_at desc) include(pr_num, work_order_num, status);

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.purchase_orders') and name = 'ix_po_owner_scope')
  create index ix_po_owner_scope on dbo.purchase_orders(created_by_user_id, site_code, department_name, created_at desc) include(po_num, work_order_num, status);

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.inventory_reservations') and name = 'ix_reservations_owner_scope')
  create index ix_reservations_owner_scope on dbo.inventory_reservations(created_by_user_id, site_code, department_name, created_at desc) include(reservation_num, work_order_num, status);

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.incidents') and name = 'ix_incidents_owner_scope')
  create index ix_incidents_owner_scope on dbo.incidents(created_by_user_id, site_code, department_name, reported_at desc) include(incident_num, status);

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.meter_readings') and name = 'ix_meter_readings_owner_scope')
  create index ix_meter_readings_owner_scope on dbo.meter_readings(created_by_user_id, site_code, department_name, reading_at desc) include(meter_reading_id, work_order_num, meter_id);
