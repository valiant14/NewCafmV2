set nocount on;
set xact_abort on;

if object_id('dbo.purchase_requisitions', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.purchase_requisitions') and name = 'ix_pr_resource_status')
begin
  create index ix_pr_resource_status
    on dbo.purchase_requisitions(resource_request_id, status, created_at desc)
    include(pr_num, po_num, work_order_num, item_code, requested_quantity, store_code, site_code, department_name);
end;
go

if object_id('dbo.purchase_orders', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.purchase_orders') and name = 'ix_po_pr_status')
begin
  create index ix_po_pr_status
    on dbo.purchase_orders(pr_num, status, created_at desc)
    include(po_num, resource_request_id, work_order_num, item_code, ordered_quantity, store_code, site_code, department_name);
end;
go

if object_id('dbo.inventory_reservations', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.inventory_reservations') and name = 'ix_reservations_resource_status')
begin
  create index ix_reservations_resource_status
    on dbo.inventory_reservations(resource_request_id, status, created_at)
    include(reservation_num, work_order_num, request_type, item_code, reserved_quantity, arranged_quantity, released_quantity, delivered_quantity, store_code, pr_num, po_num);
end;
go

if object_id('dbo.inventory_reservations', 'U') is not null
  and not exists (select 1 from sys.indexes where object_id = object_id('dbo.inventory_reservations') and name = 'ix_reservations_work_order_item')
begin
  create index ix_reservations_work_order_item
    on dbo.inventory_reservations(work_order_num, request_type, item_code, status)
    include(reservation_num, resource_request_id, reserved_quantity, released_quantity, delivered_quantity, store_code, pr_num, po_num);
end;
go
