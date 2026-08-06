set nocount on;
set xact_abort on;
go

if col_length('dbo.labor', 'work_group_code') is null
  alter table dbo.labor add work_group_code nvarchar(80) null;
go

if not exists (
  select 1
  from sys.foreign_keys
  where parent_object_id = object_id('dbo.labor')
    and name = 'fk_labor_work_group'
)
  alter table dbo.labor with check
    add constraint fk_labor_work_group foreign key (work_group_code) references dbo.work_groups(work_group_code);
go

if not exists (
  select 1
  from sys.indexes
  where object_id = object_id('dbo.labor')
    and name = 'ix_labor_team_scope'
)
  create index ix_labor_team_scope
    on dbo.labor(work_group_code, site_code, department_name, sub_department_code, status)
    include(labor_id, display_name, craft_code, craft_name, availability);
go

;with matching_labor as (
  select planned.planned_labor_id, min(labor.labor_id) as labor_id, count_big(1) as matches
  from dbo.work_order_planned_labor planned
  join dbo.labor labor
    on labor.labor_id = planned.assigned_crew
    or lower(ltrim(rtrim(labor.display_name))) = lower(ltrim(rtrim(planned.assigned_crew)))
  where nullif(ltrim(rtrim(planned.assigned_crew)), '') is not null
    and (planned.site_code is null or labor.site_code = planned.site_code)
    and (
      nullif(ltrim(rtrim(planned.department_name)), '') is null
      or lower(ltrim(rtrim(labor.department_name))) = lower(ltrim(rtrim(planned.department_name)))
    )
  group by planned.planned_labor_id
)
update planned
set assigned_crew = matching.labor_id,
    updated_at = sysutcdatetime()
from dbo.work_order_planned_labor planned
join matching_labor matching on matching.planned_labor_id = planned.planned_labor_id
where matching.matches = 1
  and planned.assigned_crew <> matching.labor_id;
go
