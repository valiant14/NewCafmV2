set nocount on;
go

if object_id('dbo.number_sequences', 'U') is null
begin
  create table dbo.number_sequences (
    sequence_key nvarchar(80) not null constraint pk_number_sequences primary key,
    next_value bigint not null,
    updated_at datetime2 not null constraint df_number_sequences_updated default sysutcdatetime(),
    constraint ck_number_sequences_positive check (next_value > 0)
  );
end;
go

declare @nextWorkOrder bigint = isnull((
  select max(try_convert(bigint, work_order_num))
  from dbo.work_orders
), 0) + 1;

merge dbo.number_sequences as target
using (values (N'WORK_ORDER', @nextWorkOrder)) as source(sequence_key, next_value)
on target.sequence_key = source.sequence_key
when matched and target.next_value < source.next_value then
  update set next_value = source.next_value, updated_at = sysutcdatetime()
when not matched then
  insert(sequence_key, next_value) values(source.sequence_key, source.next_value);
go

