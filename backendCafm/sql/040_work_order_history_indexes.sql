set nocount on;
set xact_abort on;

if object_id('dbo.work_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ix_work_orders_location_history')
begin
  create index ix_work_orders_location_history
    on dbo.work_orders(location_code, reported_at desc)
    include(work_order_num, status, site_code, department_name, assigned_department_name, asset_num);
end;
go

if object_id('dbo.work_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ix_work_orders_job_plan_history')
begin
  create index ix_work_orders_job_plan_history
    on dbo.work_orders(job_plan_num, reported_at desc)
    include(work_order_num, status, site_code, department_name, assigned_department_name, asset_num);
end;
go

if object_id('dbo.work_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ix_work_orders_schedule_rule_history')
begin
  create index ix_work_orders_schedule_rule_history
    on dbo.work_orders(schedule_rule_name, reported_at desc)
    include(work_order_num, status, site_code, department_name, assigned_department_name, pm_num);
end;
go

if object_id('dbo.work_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_orders') and name = 'ix_work_orders_failure_history')
begin
  create index ix_work_orders_failure_history
    on dbo.work_orders(failure_code, reported_at desc)
    include(work_order_num, status, site_code, department_name, assigned_department_name, problem_code);
end;
go
