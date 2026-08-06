set nocount on;
set xact_abort on;
go

if col_length('dbo.job_plans', 'estimated_duration_minutes') is null
  alter table dbo.job_plans add estimated_duration_minutes decimal(18,4) not null constraint df_jp_estimated_duration default 0;
go

if col_length('dbo.job_plans', 'required_labor_json') is null
  alter table dbo.job_plans add required_labor_json nvarchar(max) not null constraint df_jp_required_labor default N'[]';
go

if col_length('dbo.job_plans', 'required_materials_json') is null
  alter table dbo.job_plans add required_materials_json nvarchar(max) not null constraint df_jp_required_materials default N'[]';
go

if col_length('dbo.job_plans', 'required_tools_json') is null
  alter table dbo.job_plans add required_tools_json nvarchar(max) not null constraint df_jp_required_tools default N'[]';
go

if col_length('dbo.job_plans', 'safety_instructions') is null
  alter table dbo.job_plans add safety_instructions nvarchar(max) null;
go

if col_length('dbo.job_plans', 'checklist_json') is null
  alter table dbo.job_plans add checklist_json nvarchar(max) not null constraint df_jp_checklist default N'[]';
go

if not exists (select 1 from sys.check_constraints where name = 'ck_jp_required_labor_json')
  alter table dbo.job_plans add constraint ck_jp_required_labor_json check (isjson(required_labor_json) = 1);
go

if not exists (select 1 from sys.check_constraints where name = 'ck_jp_required_materials_json')
  alter table dbo.job_plans add constraint ck_jp_required_materials_json check (isjson(required_materials_json) = 1);
go

if not exists (select 1 from sys.check_constraints where name = 'ck_jp_required_tools_json')
  alter table dbo.job_plans add constraint ck_jp_required_tools_json check (isjson(required_tools_json) = 1);
go

if not exists (select 1 from sys.check_constraints where name = 'ck_jp_checklist_json')
  alter table dbo.job_plans add constraint ck_jp_checklist_json check (isjson(checklist_json) = 1);
go

update job_plan
set estimated_duration_minutes = duration.total_minutes
from dbo.job_plans job_plan
cross apply (
  select convert(decimal(18,4), isnull(sum(isnull(task.duration_hours, 0) * 60), 0)) as total_minutes
  from dbo.job_plan_tasks task
  where task.job_plan_num = job_plan.job_plan_num
) duration
where job_plan.estimated_duration_minutes = 0
  and duration.total_minutes > 0;
go

if col_length('dbo.work_orders', 'estimated_duration_minutes') is null
  alter table dbo.work_orders add estimated_duration_minutes decimal(18,4) not null constraint df_wo_estimated_duration default 0;
go

if col_length('dbo.work_orders', 'safety_instructions') is null
  alter table dbo.work_orders add safety_instructions nvarchar(max) null;
go

if col_length('dbo.work_orders', 'checklist_json') is null
  alter table dbo.work_orders add checklist_json nvarchar(max) not null constraint df_wo_checklist default N'[]';
go

if not exists (select 1 from sys.check_constraints where name = 'ck_wo_checklist_json')
  alter table dbo.work_orders add constraint ck_wo_checklist_json check (isjson(checklist_json) = 1);
go

update work_order
set estimated_duration_minutes = case
      when job_plan.estimated_duration_minutes > 0 then job_plan.estimated_duration_minutes
      else duration.total_minutes
    end,
    safety_instructions = coalesce(work_order.safety_instructions, job_plan.safety_instructions),
    checklist_json = case
      when work_order.checklist_json = N'[]' then job_plan.checklist_json
      else work_order.checklist_json
    end
from dbo.work_orders work_order
join dbo.job_plans job_plan on job_plan.job_plan_num = work_order.job_plan_num
cross apply (
  select convert(decimal(18,4), isnull(sum(isnull(task.duration_hours, 0) * 60), 0)) as total_minutes
  from dbo.job_plan_tasks task
  where task.job_plan_num = job_plan.job_plan_num
) duration
where work_order.work_type = 'PM'
  and (work_order.estimated_duration_minutes = 0 or work_order.safety_instructions is null or work_order.checklist_json = N'[]');
go

update dbo.preventive_maintenance
set frequency_unit = case upper(ltrim(rtrim(frequency_unit)))
  when 'WEEKLY' then 'WEEKS'
  when 'WEEK' then 'WEEKS'
  when 'MONTHLY' then 'MONTHS'
  when 'MONTH' then 'MONTHS'
  when 'QUARTERLY' then 'QUARTERS'
  when 'QUARTER' then 'QUARTERS'
  when 'YEARLY' then 'YEARS'
  when 'ANNUALLY' then 'YEARS'
  when 'YEAR' then 'YEARS'
  else upper(ltrim(rtrim(frequency_unit)))
end;
go

update dbo.pm_schedule_rules
set frequency_unit = case upper(ltrim(rtrim(frequency_unit)))
  when 'WEEKLY' then 'WEEKS'
  when 'WEEK' then 'WEEKS'
  when 'MONTHLY' then 'MONTHS'
  when 'MONTH' then 'MONTHS'
  when 'QUARTERLY' then 'QUARTERS'
  when 'QUARTER' then 'QUARTERS'
  when 'YEARLY' then 'YEARS'
  when 'ANNUALLY' then 'YEARS'
  when 'YEAR' then 'YEARS'
  else upper(ltrim(rtrim(frequency_unit)))
end;
go

if not exists (
  select 1 from sys.indexes
  where object_id = object_id('dbo.work_orders') and name = 'ux_work_orders_pm_cycle'
)
and not exists (
  select 1 from dbo.work_orders
  where pm_num is not null and pm_cycle is not null
  group by pm_num, pm_cycle
  having count_big(1) > 1
)
  create unique index ux_work_orders_pm_cycle
    on dbo.work_orders(pm_num, pm_cycle)
    where pm_num is not null and pm_cycle is not null;
go
