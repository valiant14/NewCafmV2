if object_id('dbo.work_order_tasks', 'U') is null
begin
  create table dbo.work_order_tasks (
    work_order_task_id bigint identity(1,1) not null primary key,
    work_order_num nvarchar(80) not null,
    task_sequence int not null,
    task_description nvarchar(500) not null,
    duration_minutes decimal(18,4) not null constraint df_wot_duration default 0,
    site_code nvarchar(30) not null,
    department_name nvarchar(160) null,
    created_at datetime2 not null constraint df_wot_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_wot_updated default sysutcdatetime(),
    constraint fk_wot_work_order foreign key (work_order_num) references dbo.work_orders(work_order_num) on delete cascade,
    constraint fk_wot_site foreign key (site_code) references dbo.sites(site_code)
  );
end;
go
