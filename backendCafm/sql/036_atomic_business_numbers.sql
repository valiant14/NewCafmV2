set nocount on;
go

if col_length('dbo.inventory_reservations', 'request_type') is null
begin
  alter table dbo.inventory_reservations add request_type nvarchar(40) null;
end;
go

update dbo.inventory_reservations
set request_type = case when reservation_num like 'ALC-%' then 'Tool' else 'Material' end
where request_type is null;

if exists (
  select 1
  from sys.columns
  where object_id = object_id('dbo.inventory_reservations')
    and name = 'request_type'
    and is_nullable = 1
)
begin
  alter table dbo.inventory_reservations alter column request_type nvarchar(40) not null;
end;
go

if not exists (
  select 1
  from sys.default_constraints
  where parent_object_id = object_id('dbo.inventory_reservations')
    and name = 'df_res_request_type'
)
begin
  alter table dbo.inventory_reservations
    add constraint df_res_request_type default 'Material' for request_type;
end;
go
