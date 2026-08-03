if col_length('dbo.work_order_resource_requests', 'purchase_request_num') is null
  alter table dbo.work_order_resource_requests add purchase_request_num nvarchar(80) null;
go

if col_length('dbo.work_order_resource_requests', 'purchase_order_num') is null
  alter table dbo.work_order_resource_requests add purchase_order_num nvarchar(80) null;
go

if col_length('dbo.work_order_resource_requests', 'reservation_num') is null
  alter table dbo.work_order_resource_requests add reservation_num nvarchar(80) null;
go
