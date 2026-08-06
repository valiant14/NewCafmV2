set nocount on;
set xact_abort on;
go

if object_id('dbo.systems', 'U') is null
begin
  create table dbo.systems (
    system_code nvarchar(80) not null constraint pk_systems primary key,
    system_name nvarchar(160) not null,
    description nvarchar(500) null,
    site_code nvarchar(30) not null,
    department_name nvarchar(160) not null,
    sub_department_code nvarchar(50) null,
    status nvarchar(30) not null constraint df_systems_status default 'Active',
    created_at datetime2 not null constraint df_systems_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_systems_updated default sysutcdatetime(),
    constraint fk_systems_site foreign key (site_code) references dbo.sites(site_code),
    constraint fk_systems_sub_department foreign key (sub_department_code) references dbo.departments(sub_department_code)
  );
end;
go

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.systems') and name = 'uq_systems_scope_name')
  create unique index uq_systems_scope_name on dbo.systems(site_code, department_name, system_name);

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.systems') and name = 'ix_systems_scope_status')
  create index ix_systems_scope_status on dbo.systems(site_code, department_name, sub_department_code, status) include(system_code, system_name);
go

if object_id('dbo.work_groups', 'U') is null
begin
  create table dbo.work_groups (
    work_group_code nvarchar(80) not null constraint pk_work_groups primary key,
    work_group_name nvarchar(160) not null,
    site_code nvarchar(30) not null,
    department_name nvarchar(160) not null,
    sub_department_code nvarchar(50) null,
    default_supervisor_labor_id nvarchar(50) null,
    status nvarchar(30) not null constraint df_work_groups_status default 'Active',
    created_at datetime2 not null constraint df_work_groups_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_work_groups_updated default sysutcdatetime(),
    constraint fk_work_groups_site foreign key (site_code) references dbo.sites(site_code),
    constraint fk_work_groups_sub_department foreign key (sub_department_code) references dbo.departments(sub_department_code),
    constraint fk_work_groups_supervisor foreign key (default_supervisor_labor_id) references dbo.labor(labor_id)
  );
end;
go

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_groups') and name = 'uq_work_groups_scope_name')
  create unique index uq_work_groups_scope_name on dbo.work_groups(site_code, department_name, work_group_name);

if not exists (select 1 from sys.indexes where object_id = object_id('dbo.work_groups') and name = 'ix_work_groups_scope_status')
  create index ix_work_groups_scope_status on dbo.work_groups(site_code, department_name, sub_department_code, status) include(work_group_code, work_group_name, default_supervisor_labor_id);
go

if col_length('dbo.assets', 'system_name') is null
  alter table dbo.assets add system_name nvarchar(160) null;
go

;with unambiguous_labor_sites as (
  select labor.labor_id, min(work_order.site_code) as site_code
  from dbo.labor labor
  join dbo.work_orders work_order
    on (work_order.supervisor = labor.labor_id or lower(ltrim(rtrim(work_order.supervisor))) = lower(ltrim(rtrim(labor.display_name))))
   and lower(ltrim(rtrim(isnull(work_order.assigned_department_name, work_order.department_name)))) = lower(ltrim(rtrim(labor.department_name)))
  where labor.site_code is null
    and work_order.site_code is not null
  group by labor.labor_id
  having count(distinct work_order.site_code) = 1
)
update labor
set site_code = mapping.site_code,
    updated_at = sysutcdatetime()
from dbo.labor labor
join unambiguous_labor_sites mapping on mapping.labor_id = labor.labor_id;

update work_order
set supervisor = matching.labor_id,
    updated_at = sysutcdatetime()
from dbo.work_orders work_order
cross apply (
  select min(labor.labor_id) as labor_id, count_big(1) as matches
  from dbo.labor labor
  where (labor.labor_id = work_order.supervisor or lower(ltrim(rtrim(labor.display_name))) = lower(ltrim(rtrim(work_order.supervisor))))
    and labor.site_code = work_order.site_code
    and lower(ltrim(rtrim(labor.department_name))) = lower(ltrim(rtrim(isnull(work_order.assigned_department_name, work_order.department_name))))
    and (work_order.sub_department_code is null or labor.sub_department_code is null or labor.sub_department_code = work_order.sub_department_code)
) matching
where nullif(ltrim(rtrim(work_order.supervisor)), '') is not null
  and matching.matches = 1
  and work_order.supervisor <> matching.labor_id;
go

merge dbo.permission_modules as target
using (values ('Routing Masters')) as source(module_name)
on target.module_name = source.module_name
when not matched then insert(module_name) values(source.module_name);
go

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select distinct source.role_id, 'Routing Masters', 'view', 1
from dbo.role_permissions source
where source.allowed = 1
  and source.action_name = 'view'
  and source.module_name in ('Work Orders', 'Assets', 'Departments')
  and not exists (
    select 1
    from dbo.role_permissions existing
    where existing.role_id = source.role_id
      and existing.module_name = 'Routing Masters'
      and existing.action_name = 'view'
  );

insert into dbo.role_permissions(role_id, module_name, action_name, allowed)
select source.role_id, 'Routing Masters', source.action_name, 1
from dbo.role_permissions source
where source.allowed = 1
  and source.module_name = 'Departments'
  and source.action_name <> 'view'
  and not exists (
    select 1
    from dbo.role_permissions existing
    where existing.role_id = source.role_id
      and existing.module_name = 'Routing Masters'
      and existing.action_name = source.action_name
  );
go
