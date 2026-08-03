if col_length('dbo.inventory_reservations', 'stock_posted_at') is null
  alter table dbo.inventory_reservations add stock_posted_at datetime2 null;
go

update reservation
set item_code = material.item_code
from dbo.inventory_reservations reservation
join dbo.materials material
  on ltrim(rtrim(reservation.item_description)) = ltrim(rtrim(material.description))
where not exists (
  select 1
  from dbo.materials existing
  where existing.item_code = reservation.item_code
);
go

update stock
set balance = case
    when stock.balance >= movement.delivered_quantity then stock.balance - movement.delivered_quantity
    else 0
  end,
  reserved_quantity = case
    when stock.reserved_quantity >= movement.delivered_quantity then stock.reserved_quantity - movement.delivered_quantity
    else 0
  end,
  updated_at = sysutcdatetime()
from dbo.inventory_stock stock
join (
  select store_code, item_code, sum(delivered_quantity) as delivered_quantity
  from dbo.inventory_reservations
  where status = 'COMPLETE'
    and delivered_quantity > 0
    and stock_posted_at is null
    and store_code is not null
    and item_code is not null
  group by store_code, item_code
) movement
  on movement.store_code = stock.store_code
  and movement.item_code = stock.item_code;
go

update dbo.inventory_reservations
set stock_posted_at = sysutcdatetime()
where status = 'COMPLETE'
  and delivered_quantity > 0
  and stock_posted_at is null
  and store_code is not null
  and item_code is not null;
go
