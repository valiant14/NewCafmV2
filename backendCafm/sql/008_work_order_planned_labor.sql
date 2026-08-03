if object_id('dbo.work_order_planned_labor', 'U') is null
begin
  create table dbo.work_order_planned_labor (
    planned_labor_id bigint identity(1,1) not null primary key,
    work_order_num nvarchar(80) not null,
    line_order int not null,
    craft_name nvarchar(160) not null,
    estimated_hours decimal(18,4) not null,
    assigned_crew nvarchar(160) not null,
    site_code nvarchar(30) not null,
    department_name nvarchar(160) null,
    created_at datetime2 not null constraint df_wopl_created default sysutcdatetime(),
    updated_at datetime2 not null constraint df_wopl_updated default sysutcdatetime(),
    constraint fk_wopl_work_order foreign key (work_order_num) references dbo.work_orders(work_order_num) on delete cascade,
    constraint fk_wopl_site foreign key (site_code) references dbo.sites(site_code)
  );
end;
go
