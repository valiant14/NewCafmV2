if col_length('dbo.purchase_orders', 'resource_request_id') is null
begin
  alter table dbo.purchase_orders add resource_request_id bigint null;
end;

if col_length('dbo.inventory_reservations', 'resource_request_id') is null
begin
  alter table dbo.inventory_reservations add resource_request_id bigint null;
end;
