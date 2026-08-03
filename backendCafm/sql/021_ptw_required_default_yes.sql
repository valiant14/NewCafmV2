set nocount on;

if col_length('dbo.work_orders', 'ptw_required') is not null
begin
  declare @constraintName sysname;

  select @constraintName = dc.name
  from sys.default_constraints dc
  join sys.columns c
    on c.default_object_id = dc.object_id
  where dc.parent_object_id = object_id('dbo.work_orders')
    and c.name = 'ptw_required';

  if @constraintName is not null
  begin
    declare @sql nvarchar(max) = N'alter table dbo.work_orders drop constraint ' + quotename(@constraintName);
    exec sp_executesql @sql;
  end;

  alter table dbo.work_orders add constraint df_wo_ptw_required default 1 for ptw_required;

  update dbo.work_orders
  set ptw_required = 1
  where ptw_required = 0
    and isnull(status, '') not in ('CLOSE', 'CAN');
end;
