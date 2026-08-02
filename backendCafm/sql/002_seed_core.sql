set nocount on;
go

merge dbo.permission_actions as target
using (values ('view'), ('create'), ('edit'), ('approve'), ('close'), ('import')) as source(action_name)
on target.action_name = source.action_name
when not matched then insert(action_name) values(source.action_name);
go

merge dbo.permission_modules as target
using (values
  ('Overview'), ('Job Requests'), ('Work Orders'), ('Preventive Maintenance'), ('Incidents'),
  ('Job Plans'), ('Assets'), ('Labor'), ('Locations'), ('Failure Library'), ('Meters'),
  ('Materials'), ('Stores'), ('Tools & Equipment'), ('Reservations'),
  ('Purchase Requisitions'), ('Purchase Orders'), ('Users'), ('Roles & Permissions'),
  ('Sites'), ('Departments'), ('Settings')
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
  ('CIVIL_TECHNICIAN', 'Civil Technician', 'View assigned work orders and enter actuals', 'Draft')
) as source(role_code, role_name, scope_description, status)
on target.role_code = source.role_code
when matched then update set role_name = source.role_name, scope_description = source.scope_description, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(role_code, role_name, scope_description, status) values(source.role_code, source.role_name, source.scope_description, source.status);
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
