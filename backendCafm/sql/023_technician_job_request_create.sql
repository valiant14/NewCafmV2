set nocount on;

merge dbo.permission_modules as target
using (values ('Job Requests')) as source(module_name)
on target.module_name = source.module_name
when not matched then insert(module_name) values(source.module_name);

merge dbo.permission_actions as target
using (values ('view'), ('create')) as source(action_name)
on target.action_name = source.action_name
when not matched then insert(action_name) values(source.action_name);

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, 'Job Requests', a.action_name, 1
from dbo.roles r
join dbo.permission_actions a on a.action_name in ('view', 'create')
where r.role_code = 'CIVIL_TECHNICIAN'
  and not exists (
    select 1
    from dbo.role_permissions existing
    where existing.role_id = r.role_id
      and existing.module_name = 'Job Requests'
      and existing.action_name = a.action_name
  );
