set nocount on;

merge dbo.pm_schedule_rules as target
using (values
  ('Every 1 Minute Test', 1, 'MINUTES', 0, 1, 0, 'PMT-', 'WSCH', 'Fast testing rule. Generates again one minute after each PM cycle.', 'Active')
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

merge dbo.preventive_maintenance as target
using (values
  ('PM-MIN-TEST-001', 'Every minute PM generation test', 'CIV-100-0001', null, null, 'JP-HVAC-001', dateadd(minute, -1, sysutcdatetime()), 0, 1, 'MINUTES', 'Every 1 Minute Test', 0, 'PM', 'WSCH', null, null, null, 'Civil', '1031', 'Civil', '1-1-1', 'ACTIVE', null)
) as source(pm_num, description, asset_num, route_code, location_code, job_plan_num, next_date, lead_time_days, frequency, frequency_unit, schedule_rule_name, pm_counter, work_type, wo_status, store_code, supervisor, lead_person, person_group, site_code, department_name, sub_department_code, pm_status, last_generated_cycle)
on target.pm_num = source.pm_num
when matched then update set
  description = source.description,
  asset_num = source.asset_num,
  route_code = source.route_code,
  location_code = source.location_code,
  job_plan_num = source.job_plan_num,
  next_date = source.next_date,
  lead_time_days = source.lead_time_days,
  frequency = source.frequency,
  frequency_unit = source.frequency_unit,
  schedule_rule_name = source.schedule_rule_name,
  work_type = source.work_type,
  wo_status = source.wo_status,
  store_code = source.store_code,
  supervisor = source.supervisor,
  lead_person = source.lead_person,
  person_group = source.person_group,
  site_code = source.site_code,
  department_name = source.department_name,
  sub_department_code = source.sub_department_code,
  pm_status = source.pm_status,
  updated_at = sysutcdatetime()
when not matched then insert(pm_num, description, asset_num, route_code, location_code, job_plan_num, next_date, lead_time_days, frequency, frequency_unit, schedule_rule_name, pm_counter, work_type, wo_status, store_code, supervisor, lead_person, person_group, site_code, department_name, sub_department_code, pm_status, last_generated_cycle)
  values(source.pm_num, source.description, source.asset_num, source.route_code, source.location_code, source.job_plan_num, source.next_date, source.lead_time_days, source.frequency, source.frequency_unit, source.schedule_rule_name, source.pm_counter, source.work_type, source.wo_status, source.store_code, source.supervisor, source.lead_person, source.person_group, source.site_code, source.department_name, source.sub_department_code, source.pm_status, source.last_generated_cycle);
