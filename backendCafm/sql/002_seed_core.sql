set nocount on;
go

merge dbo.permission_actions as target
using (values ('view'), ('create'), ('edit'), ('approve'), ('close'), ('import')) as source(action_name)
on target.action_name = source.action_name
when not matched then insert(action_name) values(source.action_name);
go

merge dbo.permission_modules as target
using (values
  ('Overview'), ('Job Requests'), ('Work Orders'), ('Work Order Planning'), ('Preventive Maintenance'), ('Incidents'),
  ('Job Plans'), ('Assets'), ('Labor'), ('Locations'), ('Failure Library'), ('Meters'),
  ('Materials'), ('Stores'), ('Tools & Equipment'), ('Reservations'),
  ('Purchase Requisitions'), ('Purchase Orders'), ('Users'), ('Roles & Permissions'),
  ('Sites'), ('Departments'), ('PM Schedule Rules'), ('Settings')
) as source(module_name)
on target.module_name = source.module_name
when not matched then insert(module_name) values(source.module_name);
go

merge dbo.sites as target
using (values ('1031', 'Riyadh', 'Central', 'Riyadh', 'Active')) as source(site_code, site_name, region, city, status)
on target.site_code = source.site_code
when matched then update set site_name = source.site_name, region = source.region, city = source.city, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(site_code, site_name, region, city, status) values(source.site_code, source.site_name, source.region, source.city, source.status);
go

merge dbo.departments as target
using (values
  ('1-1-1', 'Civil', 'Civil', 'Active'),
  ('2-1-1', 'Landscape', 'Housekeeping', 'Active'),
  ('3-1-1', 'Landscape', 'Landscape', 'Active'),
  ('4-1-1', 'Mechanical', 'Mechanical-HVAC', 'Active'),
  ('4-2-1', 'Mechanical', 'Plumbing-H&C Water Net', 'Active'),
  ('4-2-3', 'Mechanical', 'Plumbing-Sewage,Rain Net', 'Active'),
  ('4-2-4', 'Mechanical', 'Plumbing-STP', 'Active'),
  ('4-2-5', 'Mechanical', 'Plumbing-Irrigation', 'Active'),
  ('4-2-6', 'Mechanical', 'Plumbing-Firefighting', 'Active'),
  ('4-2-2', 'Mechanical', 'Plumbing-Water Treatment', 'Active'),
  ('4-3-3', 'Mechanical', 'Mechanical-KLE', 'Active'),
  ('4-3-1', 'Mechanical', 'Shutters-Automatic doors', 'Active'),
  ('5-1-1', 'Electrical', 'Electrical-Generators', 'Active'),
  ('5-2-1', 'Electrical', 'Electrical-HighVoltage', 'Active'),
  ('5-3-1', 'Electrical', 'Electrical-LowVoltage', 'Active'),
  ('5-4-1', 'Electrical', 'Electrical-Lifts', 'Active'),
  ('6-2-1', 'Electronics', 'Electronics-CCTV', 'Active')
) as source(sub_department_code, department_name, description, status)
on target.sub_department_code = source.sub_department_code
when matched then update set department_name = source.department_name, description = source.description, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(sub_department_code, department_name, description, status) values(source.sub_department_code, source.department_name, source.description, source.status);
go

merge dbo.roles as target
using (values
  ('FACILITY_MANAGER', 'Facility Manager', 'Full CAFM access', 'Active'),
  ('HVAC_SUPERVISOR', 'HVAC Supervisor', 'Manage HVAC work orders and supply chain', 'Active'),
  ('CIVIL_TECHNICIAN', 'Civil Technician', 'View assigned work orders and enter actuals', 'Active')
) as source(role_code, role_name, scope_description, status)
on target.role_code = source.role_code
when matched then update set role_name = source.role_name, scope_description = source.scope_description, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(role_code, role_name, scope_description, status) values(source.role_code, source.role_name, source.scope_description, source.status);
go

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
go

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, m.module_name, a.action_name, 1
from dbo.roles r
join dbo.permission_modules m on m.module_name in (
  'Overview', 'Job Requests', 'Work Orders', 'Work Order Planning', 'Assets', 'Labor', 'Locations',
  'Failure Library', 'Meters', 'Materials', 'Stores', 'Tools & Equipment',
  'Reservations', 'Purchase Requisitions', 'Purchase Orders', 'PM Schedule Rules'
)
join dbo.permission_actions a on (
  a.action_name = 'view'
  or (a.action_name in ('create', 'edit', 'approve', 'import') and m.module_name in ('Job Requests', 'Work Orders', 'Work Order Planning', 'Meters', 'Materials', 'Stores', 'Tools & Equipment', 'Reservations', 'Purchase Requisitions', 'Purchase Orders', 'PM Schedule Rules'))
  or (a.action_name = 'close' and m.module_name in ('Work Orders', 'Reservations', 'Purchase Requisitions', 'Purchase Orders'))
)
where r.role_code = 'HVAC_SUPERVISOR'
  and not exists (
    select 1 from dbo.role_permissions existing
    where existing.role_id = r.role_id and existing.module_name = m.module_name and existing.action_name = a.action_name
  );
go

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, m.module_name, a.action_name, 1
from dbo.roles r
join dbo.permission_modules m on m.module_name in (
  'Overview', 'Job Requests', 'Work Orders', 'Assets', 'Locations', 'Failure Library', 'Meters',
  'Materials', 'Stores', 'Tools & Equipment'
)
join dbo.permission_actions a on (
  a.action_name = 'view'
  or (a.action_name = 'create' and m.module_name = 'Job Requests')
  or (a.action_name = 'edit' and m.module_name in ('Work Orders', 'Meters'))
)
where r.role_code = 'CIVIL_TECHNICIAN'
  and not exists (
    select 1 from dbo.role_permissions existing
    where existing.role_id = r.role_id and existing.module_name = m.module_name and existing.action_name = a.action_name
  );
go

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, m.module_name, a.action_name, 1
from dbo.roles r
cross join dbo.permission_modules m
cross join dbo.permission_actions a
where r.role_code = 'FACILITY_MANAGER'
  and not exists (
    select 1 from dbo.role_permissions existing
    where existing.role_id = r.role_id and existing.module_name = m.module_name and existing.action_name = a.action_name
  );
go
