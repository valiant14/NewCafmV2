if col_length('dbo.work_orders', 'work_group') is null
begin
  alter table dbo.work_orders add work_group nvarchar(160) null;
end;
go

if col_length('dbo.work_orders', 'system_name') is null
begin
  alter table dbo.work_orders add system_name nvarchar(160) null;
end;
go

if col_length('dbo.work_orders', 'supervisor') is null
begin
  alter table dbo.work_orders add supervisor nvarchar(160) null;
end;
go

if col_length('dbo.work_orders', 'labor_craft_code') is null
begin
  alter table dbo.work_orders add labor_craft_code nvarchar(80) null;
end;
go
