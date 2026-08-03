set nocount on;

declare @targetStore nvarchar(80) = N'DIWAN-MAIN';

if exists (select 1 from dbo.storerooms where store_code = @targetStore)
begin
  update dbo.tools_equipment
  set location_code = @targetStore,
      updated_at = sysutcdatetime()
  where try_convert(int, nullif(ltrim(rtrim(location_code)), N'')) is not null;

  if object_id(N'tempdb..#numeric_stock') is not null drop table #numeric_stock;

  select item_code,
         sum(balance) as balance,
         sum(reserved_quantity) as reserved_quantity,
         max(reorder_point) as reorder_point
  into #numeric_stock
  from dbo.inventory_stock
  where try_convert(int, nullif(ltrim(rtrim(store_code)), N'')) is not null
    and store_code <> @targetStore
  group by item_code;

  merge dbo.inventory_stock as target
  using #numeric_stock as source
    on target.store_code = @targetStore
   and target.item_code = source.item_code
  when matched then
    update set
      balance = target.balance + source.balance,
      reserved_quantity = target.reserved_quantity + source.reserved_quantity,
      reorder_point = coalesce(target.reorder_point, source.reorder_point),
      updated_at = sysutcdatetime()
  when not matched then
    insert (store_code, item_code, balance, reserved_quantity, reorder_point)
    values (@targetStore, source.item_code, source.balance, source.reserved_quantity, source.reorder_point);

  delete from dbo.inventory_stock
  where try_convert(int, nullif(ltrim(rtrim(store_code)), N'')) is not null
    and store_code <> @targetStore;

  update dbo.work_order_resource_requests
  set store_code = @targetStore,
      updated_at = sysutcdatetime()
  where try_convert(int, nullif(ltrim(rtrim(store_code)), N'')) is not null
    and store_code <> @targetStore;

  update dbo.purchase_requisitions
  set store_code = @targetStore,
      updated_at = sysutcdatetime()
  where try_convert(int, nullif(ltrim(rtrim(store_code)), N'')) is not null
    and store_code <> @targetStore;

  update dbo.purchase_orders
  set store_code = @targetStore,
      updated_at = sysutcdatetime()
  where try_convert(int, nullif(ltrim(rtrim(store_code)), N'')) is not null
    and store_code <> @targetStore;

  update dbo.inventory_reservations
  set store_code = @targetStore,
      updated_at = sysutcdatetime()
  where try_convert(int, nullif(ltrim(rtrim(store_code)), N'')) is not null
    and store_code <> @targetStore;

  delete from dbo.storerooms
  where try_convert(int, nullif(ltrim(rtrim(store_code)), N'')) is not null
    and store_code <> @targetStore;
end;
