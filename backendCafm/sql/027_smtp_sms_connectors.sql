set nocount on;

if object_id('dbo.smtp_sms_connectors', 'U') is null
begin
  create table dbo.smtp_sms_connectors (
    connector_name nvarchar(160) not null primary key,
    connector_type nvarchar(40) not null,
    host_endpoint nvarchar(300) not null,
    port int null,
    encryption nvarchar(40) null,
    username_value nvarchar(300) null,
    secret_value nvarchar(max) null,
    sender_value nvarchar(160) null,
    notes nvarchar(500) null,
    status nvarchar(40) not null constraint df_smtp_sms_status default 'Active',
    created_at datetime2 not null constraint df_smtp_sms_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_smtp_sms_updated default sysutcdatetime()
  );
end;

merge dbo.permission_modules as target
using (values ('SMTP & SMS')) as source(module_name)
on target.module_name = source.module_name
when not matched then insert(module_name) values(source.module_name);

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select r.role_id, 'SMTP & SMS', a.action_name, 1
from dbo.roles r
join dbo.permission_actions a on a.action_name in ('view', 'create', 'edit', 'import')
where r.role_code = 'FACILITY_MANAGER'
  and not exists (
    select 1
    from dbo.role_permissions existing
    where existing.role_id = r.role_id
      and existing.module_name = 'SMTP & SMS'
      and existing.action_name = a.action_name
  );
