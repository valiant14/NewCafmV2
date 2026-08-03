set nocount on;

merge dbo.permission_modules as target
using (values ('Work Order Planning')) as source(module_name)
on target.module_name = source.module_name
when not matched then insert(module_name) values(source.module_name);

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, 'Work Order Planning', a.action_name, 1
from dbo.roles r
join dbo.permission_actions a on a.action_name in ('view', 'create', 'edit', 'import')
where r.role_code in ('FACILITY_MANAGER', 'HVAC_SUPERVISOR')
  and not exists (
    select 1
    from dbo.role_permissions existing
    where existing.role_id = r.role_id
      and existing.module_name = 'Work Order Planning'
      and existing.action_name = a.action_name
  );
