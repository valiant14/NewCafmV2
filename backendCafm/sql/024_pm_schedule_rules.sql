set nocount on;

if object_id('dbo.pm_schedule_rules', 'U') is null
begin
  create table dbo.pm_schedule_rules (
    rule_name nvarchar(160) not null primary key,
    frequency int not null constraint df_pm_rule_frequency default 1,
    frequency_unit nvarchar(40) not null constraint df_pm_rule_frequency_unit default 'MONTHS',
    lead_time_days int not null constraint df_pm_rule_lead default 0,
    horizon_days int not null constraint df_pm_rule_horizon default 30,
    trigger_hour int not null constraint df_pm_rule_trigger_hour default 0,
    wo_prefix nvarchar(40) not null constraint df_pm_rule_wo_prefix default 'PMWO-',
    default_wo_status nvarchar(40) not null constraint df_pm_rule_wo_status default 'WSCH',
    notes nvarchar(500) null,
    status nvarchar(40) not null constraint df_pm_rule_status default 'Active',
    created_at datetime2 not null constraint df_pm_rule_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_pm_rule_updated default sysutcdatetime()
  );
end;

if col_length('dbo.preventive_maintenance', 'schedule_rule_name') is null
begin
  alter table dbo.preventive_maintenance add schedule_rule_name nvarchar(160) null;
end;

if exists (
  select 1
  from sys.columns c
  join sys.types t on t.user_type_id = c.user_type_id
  where c.object_id = object_id('dbo.preventive_maintenance')
    and c.name = 'next_date'
    and t.name = 'date'
)
begin
  alter table dbo.preventive_maintenance alter column next_date datetime2 not null;
end;

if col_length('dbo.work_orders', 'pm_num') is null
begin
  alter table dbo.work_orders add pm_num nvarchar(80) null;
end;

if col_length('dbo.work_orders', 'pm_cycle') is null
begin
  alter table dbo.work_orders add pm_cycle nvarchar(120) null;
end;

if col_length('dbo.work_orders', 'job_plan_num') is null
begin
  alter table dbo.work_orders add job_plan_num nvarchar(80) null;
end;

if col_length('dbo.work_orders', 'schedule_rule_name') is null
begin
  alter table dbo.work_orders add schedule_rule_name nvarchar(160) null;
end;

merge dbo.permission_modules as target
using (values ('PM Schedule Rules')) as source(module_name)
on target.module_name = source.module_name
when not matched then insert(module_name) values(source.module_name);

merge dbo.pm_schedule_rules as target
using (values
  ('Default Monthly PM', 1, 'MONTHS', 7, 30, 6, 'PMWO-', 'WSCH', 'Default monthly preventive maintenance generation rule.', 'Active'),
  ('Every 1 Minute Test', 1, 'MINUTES', 0, 1, 0, 'PMT-', 'WSCH', 'Fast testing rule. Use only for PM generation testing.', 'Active')
) as source(rule_name, frequency, frequency_unit, lead_time_days, horizon_days, trigger_hour, wo_prefix, default_wo_status, notes, status)
on target.rule_name = source.rule_name
when matched then update set
  frequency = source.frequency,
  frequency_unit = source.frequency_unit,
  lead_time_days = source.lead_time_days,
  horizon_days = source.horizon_days,
  trigger_hour = source.trigger_hour,
  wo_prefix = source.wo_prefix,
  default_wo_status = source.default_wo_status,
  notes = source.notes,
  status = source.status,
  updated_at = sysutcdatetime()
when not matched then insert(rule_name, frequency, frequency_unit, lead_time_days, horizon_days, trigger_hour, wo_prefix, default_wo_status, notes, status)
  values(source.rule_name, source.frequency, source.frequency_unit, source.lead_time_days, source.horizon_days, source.trigger_hour, source.wo_prefix, source.default_wo_status, source.notes, source.status);

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, 'PM Schedule Rules', a.action_name, 1
from dbo.roles r
join dbo.permission_actions a on a.action_name in ('view', 'create', 'edit', 'import')
where r.role_code in ('FACILITY_MANAGER', 'HVAC_SUPERVISOR')
  and not exists (
    select 1
    from dbo.role_permissions existing
    where existing.role_id = r.role_id
      and existing.module_name = 'PM Schedule Rules'
      and existing.action_name = a.action_name
  );
