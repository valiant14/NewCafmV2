if col_length('dbo.tools_equipment', 'low_level') is null
begin
  alter table dbo.tools_equipment add low_level decimal(18,4) not null constraint df_tools_equipment_low_level default 0;
end;
