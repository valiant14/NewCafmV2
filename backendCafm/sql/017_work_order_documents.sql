set nocount on;

if col_length('dbo.work_orders', 'ptw_required') is null
begin
  alter table dbo.work_orders add ptw_required bit not null constraint df_wo_ptw_required default 0;
end;

if col_length('dbo.work_orders', 'ptw_files_json') is null
begin
  alter table dbo.work_orders add ptw_files_json nvarchar(max) null;
end;

if col_length('dbo.work_orders', 'general_files_json') is null
begin
  alter table dbo.work_orders add general_files_json nvarchar(max) null;
end;
