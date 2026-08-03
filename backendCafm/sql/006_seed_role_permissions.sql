set nocount on;
go

merge dbo.permission_modules as target
using (values ('Work Order Planning')) as source(module_name)
on target.module_name = source.module_name
when not matched then insert(module_name) values(source.module_name);
go

merge dbo.roles as target
using (values
  ('HVAC_SUPERVISOR', 'HVAC Supervisor', 'Manage HVAC work orders and supply chain', 'Active'),
  ('CIVIL_TECHNICIAN', 'Civil Technician', 'View assigned work orders and enter actuals', 'Active')
) as source(role_code, role_name, scope_description, status)
on target.role_code = source.role_code
when matched then update set role_name = source.role_name, scope_description = source.scope_description, status = source.status, updated_at = sysutcdatetime()
when not matched then insert(role_code, role_name, scope_description, status)
  values(source.role_code, source.role_name, source.scope_description, source.status);
go

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, m.module_name, a.action_name, 1
from dbo.roles r
join dbo.permission_modules m on m.module_name in (
  'Overview', 'Job Requests', 'Work Orders', 'Work Order Planning', 'Assets', 'Labor', 'Locations',
  'Failure Library', 'Meters', 'Materials', 'Stores', 'Tools & Equipment',
  'Reservations', 'Purchase Requisitions', 'Purchase Orders'
)
join dbo.permission_actions a on (
  a.action_name = 'view'
  or (a.action_name in ('create', 'edit', 'approve', 'import') and m.module_name in ('Job Requests', 'Work Orders', 'Work Order Planning', 'Meters', 'Materials', 'Stores', 'Tools & Equipment', 'Reservations', 'Purchase Requisitions', 'Purchase Orders'))
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
  'Overview', 'Work Orders', 'Assets', 'Locations', 'Failure Library', 'Meters',
  'Materials', 'Stores', 'Tools & Equipment'
)
join dbo.permission_actions a on (
  a.action_name = 'view'
  or (a.action_name = 'edit' and m.module_name in ('Work Orders', 'Meters'))
)
where r.role_code = 'CIVIL_TECHNICIAN'
  and not exists (
    select 1 from dbo.role_permissions existing
    where existing.role_id = r.role_id and existing.module_name = m.module_name and existing.action_name = a.action_name
  );
go
