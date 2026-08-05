set nocount on;
go

if col_length('dbo.tools_equipment', 'location_code') is null
  alter table dbo.tools_equipment add location_code nvarchar(80) null;

if col_length('dbo.tools_equipment', 'quantity') is null
  alter table dbo.tools_equipment add quantity decimal(18,4) not null constraint df_tools_equipment_quantity default 1;

if col_length('dbo.tools_equipment', 'low_level') is null
  alter table dbo.tools_equipment add low_level decimal(18,4) not null constraint df_tools_equipment_low_level default 0;
go

if col_length('dbo.tools_equipment', 'site_code') is null
  alter table dbo.tools_equipment add site_code nvarchar(30) null;
go

update tool
set site_code = store.site_code,
    updated_at = sysutcdatetime()
from dbo.tools_equipment tool
join dbo.storerooms store on store.store_code = tool.location_code
where tool.site_code is null or tool.site_code <> store.site_code;
go

if not exists (
  select 1 from sys.foreign_keys
  where parent_object_id = object_id('dbo.tools_equipment')
    and name = 'fk_tools_site'
)
  alter table dbo.tools_equipment
    add constraint fk_tools_site foreign key (site_code) references dbo.sites(site_code);
go

if not exists (
  select 1 from sys.indexes
  where object_id = object_id('dbo.tools_equipment')
    and name = 'ix_tools_site_store'
)
  create index ix_tools_site_store
    on dbo.tools_equipment(site_code, location_code)
    include(tool_code, description, category, quantity, low_level, status);
go
