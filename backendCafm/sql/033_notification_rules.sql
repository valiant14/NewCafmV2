set nocount on;
go

if object_id('dbo.notification_rules', 'U') is null
begin
  create table dbo.notification_rules (
    rule_id nvarchar(80) not null constraint pk_notification_rules primary key,
    event_name nvarchar(160) not null,
    channel_name nvarchar(40) not null,
    recipients nvarchar(max) null,
    notes nvarchar(500) null,
    status nvarchar(40) not null constraint df_notification_rules_status default 'Active',
    created_at datetime2 not null constraint df_notification_rules_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_notification_rules_updated default sysutcdatetime()
  );
end;
go

