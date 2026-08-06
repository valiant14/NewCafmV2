set nocount on;
set xact_abort on;
go

update dbo.work_orders
set target_finish_at = dateadd(
      second,
      convert(int, round(estimated_duration_minutes * 60, 0)),
      target_start_at
    ),
    updated_at = sysutcdatetime()
where work_type = 'PM'
  and target_start_at is not null
  and estimated_duration_minutes > 0
  and (target_finish_at is null or target_finish_at <= target_start_at);
go
