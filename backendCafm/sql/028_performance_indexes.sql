set nocount on;
set xact_abort on;

if object_id('dbo.users', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.users') and name = 'ix_users_username_active')
begin
  create index ix_users_username_active
    on dbo.users(username, status)
    include(user_id, password_hash, role_id, display_name, email);
end;

if object_id('dbo.role_permissions', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.role_permissions') and name = 'ix_role_permissions_lookup')
begin
  create index ix_role_permissions_lookup
    on dbo.role_permissions(module_name, action_name, role_id)
    where allowed = 1;
end;

if object_id('dbo.work_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ix_work_orders_scope_status')
begin
  create index ix_work_orders_scope_status
    on dbo.work_orders(site_code, department_name, status, reported_at desc)
    include(work_order_num, work_type, priority, asset_num, location_code, target_start_at, target_finish_at, updated_at);
end;

if object_id('dbo.work_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ix_work_orders_asset')
begin
  create index ix_work_orders_asset
    on dbo.work_orders(asset_num, status, work_order_num)
    include(site_code, department_name, target_start_at, target_finish_at);
end;

if object_id('dbo.work_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ix_work_orders_scope_reported')
begin
  create index ix_work_orders_scope_reported
    on dbo.work_orders(site_code, department_name, reported_at desc, work_order_num desc)
    include(status, work_type, priority, asset_num, location_code, target_start_at, target_finish_at, updated_at);
end;

if object_id('dbo.work_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ux_work_orders_pm_cycle')
  and not exists (
    select 1
    from dbo.work_orders
    where pm_num is not null and pm_cycle is not null
    group by pm_num, pm_cycle
    having count_big(1) > 1
  )
begin
  create unique index ux_work_orders_pm_cycle
    on dbo.work_orders(pm_num, pm_cycle)
    where pm_num is not null and pm_cycle is not null;
end;

if object_id('dbo.work_order_resource_requests', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_order_resource_requests') and name = 'ix_worr_work_order')
begin
  create index ix_worr_work_order
    on dbo.work_order_resource_requests(work_order_num, resource_request_id)
    include(resource_type, item_code, requested_quantity, available_quantity, store_code, request_status, supply_chain_status);
end;

if object_id('dbo.work_order_planned_labor', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_order_planned_labor') and name = 'ix_wopl_work_order')
begin
  create index ix_wopl_work_order
    on dbo.work_order_planned_labor(work_order_num, line_order)
    include(craft_name, estimated_hours, assigned_crew);
end;

if object_id('dbo.work_order_tasks', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_order_tasks') and name = 'ix_wot_work_order')
begin
  create index ix_wot_work_order
    on dbo.work_order_tasks(work_order_num, task_sequence)
    include(task_description, duration_minutes);
end;

if object_id('dbo.job_plan_tasks', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.job_plan_tasks') and name = 'ix_jpt_job_plan')
begin
  create index ix_jpt_job_plan
    on dbo.job_plan_tasks(job_plan_num, task_sequence)
    include(task_description, duration_hours);
end;

if object_id('dbo.preventive_maintenance', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.preventive_maintenance') and name = 'ix_pm_scheduler_due')
begin
  create index ix_pm_scheduler_due
    on dbo.preventive_maintenance(pm_status, next_date, pm_num)
    include(schedule_rule_name, frequency, frequency_unit, lead_time_days, site_code, department_name, job_plan_num, asset_num, location_code, wo_status);
end;

if object_id('dbo.service_requests', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.service_requests') and name = 'ix_service_requests_scope_status')
begin
  create index ix_service_requests_scope_status
    on dbo.service_requests(site_code, department_name, status, reported_at desc)
    include(sr_num, priority, asset_num, location_code, converted_work_order_num, updated_at);
end;

if object_id('dbo.service_requests', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.service_requests') and name = 'ix_service_requests_scope_reported')
begin
  create index ix_service_requests_scope_reported
    on dbo.service_requests(site_code, department_name, reported_at desc, sr_num desc)
    include(status, priority, asset_num, location_code, converted_work_order_num, updated_at);
end;

if object_id('dbo.purchase_requisitions', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.purchase_requisitions') and name = 'ix_pr_work_order_status')
begin
  create index ix_pr_work_order_status
    on dbo.purchase_requisitions(work_order_num, status, created_at desc)
    include(pr_num, resource_request_id, item_code, requested_quantity, store_code, site_code, po_num);
end;

if object_id('dbo.purchase_requisitions', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.purchase_requisitions') and name = 'ix_pr_scope_created')
begin
  create index ix_pr_scope_created
    on dbo.purchase_requisitions(site_code, department_name, created_at desc, pr_num desc)
    include(work_order_num, status, resource_request_id, item_code, requested_quantity, store_code, po_num);
end;

if object_id('dbo.purchase_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.purchase_orders') and name = 'ix_po_work_order_status')
begin
  create index ix_po_work_order_status
    on dbo.purchase_orders(work_order_num, status, created_at desc)
    include(po_num, pr_num, resource_request_id, item_code, ordered_quantity, store_code, site_code);
end;

if object_id('dbo.purchase_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.purchase_orders') and name = 'ix_po_scope_created')
begin
  create index ix_po_scope_created
    on dbo.purchase_orders(site_code, department_name, created_at desc, po_num desc)
    include(work_order_num, status, pr_num, resource_request_id, item_code, ordered_quantity, store_code);
end;

if object_id('dbo.inventory_reservations', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.inventory_reservations') and name = 'ix_reservations_work_order_status')
begin
  create index ix_reservations_work_order_status
    on dbo.inventory_reservations(work_order_num, status, created_at desc)
    include(reservation_num, resource_request_id, item_code, reserved_quantity, delivered_quantity, store_code, site_code);
end;

if object_id('dbo.inventory_reservations', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.inventory_reservations') and name = 'ix_reservations_scope_created')
begin
  create index ix_reservations_scope_created
    on dbo.inventory_reservations(site_code, department_name, created_at desc, reservation_num desc)
    include(work_order_num, status, resource_request_id, item_code, reserved_quantity, delivered_quantity, store_code);
end;

if object_id('dbo.meter_readings', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.meter_readings') and name = 'ix_meter_readings_asset_date')
begin
  create index ix_meter_readings_asset_date
    on dbo.meter_readings(asset_num, reading_at desc)
    include(meter_id, work_order_num, reading_value, reading_unit, site_code, department_name);
end;

if object_id('dbo.meter_readings', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.meter_readings') and name = 'ix_meter_readings_scope_date')
begin
  create index ix_meter_readings_scope_date
    on dbo.meter_readings(site_code, department_name, reading_at desc, meter_reading_id desc)
    include(meter_id, asset_num, work_order_num, reading_value, reading_unit);
end;

if object_id('dbo.audit_log', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.audit_log') and name = 'ix_audit_entity_date')
begin
  create index ix_audit_entity_date
    on dbo.audit_log(entity_name, entity_id, created_at desc)
    include(action_name, user_id);
end;

select
  schema_name(table_object.schema_id) as schema_name,
  table_object.name as table_name,
  index_object.name as index_name
from sys.indexes index_object
join sys.objects table_object on table_object.object_id = index_object.object_id
where index_object.name in (
  'ix_users_username_active', 'ix_role_permissions_lookup', 'ix_work_orders_scope_status',
  'ix_work_orders_asset', 'ix_work_orders_scope_reported', 'ux_work_orders_pm_cycle', 'ix_worr_work_order', 'ix_wopl_work_order',
  'ix_wot_work_order', 'ix_jpt_job_plan', 'ix_pm_scheduler_due', 'ix_service_requests_scope_status',
  'ix_service_requests_scope_reported', 'ix_pr_work_order_status', 'ix_pr_scope_created',
  'ix_po_work_order_status', 'ix_po_scope_created', 'ix_reservations_work_order_status',
  'ix_reservations_scope_created', 'ix_meter_readings_asset_date', 'ix_meter_readings_scope_date',
  'ix_audit_entity_date'
)
order by table_object.name, index_object.name;
