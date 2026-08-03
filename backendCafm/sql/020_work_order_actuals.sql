set nocount on;

if col_length('dbo.work_orders', 'technician_remarks') is null
begin
  alter table dbo.work_orders add technician_remarks nvarchar(max) null;
end;

if col_length('dbo.work_orders', 'completion_notes') is null
begin
  alter table dbo.work_orders add completion_notes nvarchar(max) null;
end;

if col_length('dbo.work_orders', 'actual_labor') is null
begin
  alter table dbo.work_orders add actual_labor nvarchar(180) null;
end;

if col_length('dbo.work_orders', 'actual_hours') is null
begin
  alter table dbo.work_orders add actual_hours decimal(18,4) null;
end;

if col_length('dbo.work_orders', 'actual_materials_json') is null
begin
  alter table dbo.work_orders add actual_materials_json nvarchar(max) null;
end;

if col_length('dbo.work_orders', 'actual_tools_json') is null
begin
  alter table dbo.work_orders add actual_tools_json nvarchar(max) null;
end;
