if col_length('dbo.tools_equipment', 'location_code') is null
begin
  alter table dbo.tools_equipment add location_code nvarchar(80) null;
end;

if col_length('dbo.tools_equipment', 'quantity') is null
begin
  alter table dbo.tools_equipment add quantity decimal(18,4) not null constraint df_tools_equipment_quantity default 1;
end;

if col_length('dbo.tools_equipment', 'inspection_due') is null
begin
  alter table dbo.tools_equipment add inspection_due date null;
end;
